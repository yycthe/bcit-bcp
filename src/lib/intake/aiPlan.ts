export type IntakePlanSection =
  | { kind: 'common_form'; id: string; required: boolean; reason: string }
  | { kind: 'persona_gate'; required: boolean; reason: string }
  | { kind: 'document'; id: string; required: boolean; reason: string };

export type IntakePlan = {
  sections: IntakePlanSection[];
  summary: string;
  /** Present when the API fell back to a default plan but still returned 200. */
  _warning?: string;
};

const COMMON_FORMS = [
  'legalBusinessForm',
  'businessModelForm',
  'ownershipControlForm',
  'processingHistoryForm',
  'salesProfileForm',
  'websiteComplianceForm',
  'documentReadinessForm',
] as const;

const DOC_SLOTS = [
  'registrationCertificate',
  'taxDocument',
  'bankStatement',
  'proofOfAddress',
  'proofOfFunds',
  'idUpload',
  'financials',
  'complianceDocument',
  'enhancedVerification',
] as const;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const PLAN_REQUEST_TIMEOUT_MS = 10_000;
const PLAN_RETRY_DELAYS_MS = [350, 900];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Client-side emergency fallback if API is unavailable after retries/timeouts. */
export function buildDefaultIntakePlanClient(reason: string): IntakePlan {
  const sections: IntakePlanSection[] = [
    ...COMMON_FORMS.map((id) => ({
      kind: 'common_form' as const,
      id,
      required: true,
      reason: 'Client fallback default common intake.',
    })),
    {
      kind: 'persona_gate' as const,
      required: true,
      reason: 'Client fallback virtual KYC / KYB checkpoint.',
    },
    ...DOC_SLOTS.map((id) => ({
      kind: 'document' as const,
      id,
      required: id !== 'financials' && id !== 'complianceDocument' && id !== 'enhancedVerification',
      reason: 'Client fallback default document package.',
    })),
  ];
  return {
    sections,
    summary: 'Using local default intake path.',
    _warning: reason,
  };
}

export async function requestIntakePlan(anchor: {
  businessType?: string;
  country?: string;
  industry?: string;
  monthlyVolume?: string;
  monthlyTransactions?: string;
}): Promise<IntakePlan> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= PLAN_RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PLAN_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch('/api/intake/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anchor }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const message = errBody?.error || `Intake plan failed (${response.status})`;
        if (RETRYABLE_STATUS.has(response.status) && attempt < PLAN_RETRY_DELAYS_MS.length) {
          await sleep(PLAN_RETRY_DELAYS_MS[attempt]!);
          continue;
        }
        throw new Error(message);
      }

      return (await response.json()) as IntakePlan;
    } catch (err: unknown) {
      const asError = err instanceof Error ? err : new Error('Unknown intake plan error');
      const isAbort = asError.name === 'AbortError';
      lastError = isAbort
        ? new Error('Intake planner request timed out.')
        : asError;
      if (attempt < PLAN_RETRY_DELAYS_MS.length) {
        await sleep(PLAN_RETRY_DELAYS_MS[attempt]!);
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  return buildDefaultIntakePlanClient(
    `Planner fallback after retries: ${lastError?.message || 'Unknown error'}`
  );
}
