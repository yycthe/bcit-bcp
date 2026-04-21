import { GoogleGenAI, Type } from '@google/genai';

export const config = { runtime: 'nodejs', maxDuration: 30 };

const GEMINI_MODEL_FLASH = 'gemini-2.5-flash';

function resolvePlanModel(): string {
  const fromEnv =
    process.env.GEMINI_PLAN_MODEL?.trim() || process.env.GEMINI_INTAKE_PLAN_MODEL?.trim();
  return fromEnv || GEMINI_MODEL_FLASH;
}

const POLICY_SNIPPET = [
  'Merchant onboarding is AI-assisted; follow the same ordering rules as the live app.',
  'Common intake must stay processor-agnostic until routing.',
  'Common forms already hide irrelevant sub-questions in the UI, so prefer keeping core coverage and optimizing the section order.',
  'personaDecisionGate represents a virtual KYC / KYB checkpoint in the UI, not a required external integration.',
  'Include personaDecisionGate before document uploads unless you have a strong reason to reorder (explain in reason).',
  'Every document slot id must be one of the allowed upload keys.',
].join('\n');

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

type AnchorPayload = {
  businessType?: string;
  country?: string;
  industry?: string;
  monthlyVolume?: string;
  monthlyTransactions?: string;
};

type PlanSection = {
  kind: 'common_form' | 'persona_gate' | 'document';
  id?: string;
  required: boolean;
  reason: string;
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          kind: { type: Type.STRING, enum: ['common_form', 'persona_gate', 'document'] },
          id: { type: Type.STRING, description: 'common_form or document slot id; omit for persona_gate' },
          required: { type: Type.BOOLEAN },
          reason: { type: Type.STRING },
        },
        required: ['kind', 'required', 'reason'],
      },
    },
    summary: { type: Type.STRING },
  },
  required: ['sections', 'summary'],
};

function defaultPlan(): { sections: PlanSection[]; summary: string } {
  const sections: PlanSection[] = [
    ...COMMON_FORMS.map((id) => ({
      kind: 'common_form' as const,
      id,
      required: true,
      reason: 'Default full common intake.',
    })),
    { kind: 'persona_gate', required: true, reason: 'Standard virtual KYC / KYB checkpoint.' },
    ...DOC_SLOTS.map((id) => ({
      kind: 'document' as const,
      id,
      required: id !== 'financials' && id !== 'complianceDocument' && id !== 'enhancedVerification',
      reason: 'Default document package.',
    })),
  ];
  return {
    sections,
    summary: 'Applied default sequencing (API validation fallback).',
  };
}

function validateSection(s: PlanSection): PlanSection | null {
  if (!s || typeof s !== 'object') return null;
  if (s.kind === 'persona_gate') {
    return { kind: 'persona_gate', required: Boolean(s.required), reason: String(s.reason || '') };
  }
  if (s.kind === 'common_form') {
    const id = String(s.id || '');
    if (!COMMON_FORMS.includes(id as (typeof COMMON_FORMS)[number])) return null;
    return {
      kind: 'common_form',
      id,
      required: Boolean(s.required),
      reason: String(s.reason || ''),
    };
  }
  if (s.kind === 'document') {
    const id = String(s.id || '');
    if (!DOC_SLOTS.includes(id as (typeof DOC_SLOTS)[number])) return null;
    return {
      kind: 'document',
      id,
      required: Boolean(s.required),
      reason: String(s.reason || ''),
    };
  }
  return null;
}

function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 500, { error: 'GOOGLE_API_KEY not configured on the server.' });
  }

  let body: { anchor?: AnchorPayload };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  const anchor = body?.anchor || {};
  const anchorJson = JSON.stringify(anchor, null, 2);

  const SYSTEM_INSTRUCTION = `You build an ordered intake plan for a merchant onboarding wizard.

${POLICY_SNIPPET}

Allowed common_form ids (use exactly): ${COMMON_FORMS.join(', ')}
Allowed document ids (use exactly): ${DOC_SLOTS.join(', ')}

Rules:
- Include each common_form at most once unless you have an exceptional reason (avoid duplicates).
- Include persona_gate exactly once, typically after all common forms and before documents.
- Mark documents optional when risk is low and the doc is supplementary; mark required when policy implies KYB/KYC evidence is needed.
- Prefer fewer optional docs for clean Canadian retail; add financials / compliance / enhanced verification when industry is high-risk, cross-border, or volumes are large.
- Respond only as JSON matching the schema.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: resolvePlanModel(),
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Anchor answers (after the first 5 gate questions):\n${anchorJson}\n\nProduce sections[] in execution order.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.15,
      },
    });

    const text = response.text;
    if (!text) {
      return json(res, 200, defaultPlan());
    }

    let parsed: { sections?: PlanSection[]; summary?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      return json(res, 200, defaultPlan());
    }

    const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
    const cleaned: PlanSection[] = [];
    const seenForm = new Set<string>();
    const seenDoc = new Set<string>();
    let seenGate = false;

    for (const item of rawSections) {
      const v = validateSection(item as PlanSection);
      if (!v) continue;
      if (v.kind === 'common_form' && v.id) {
        if (seenForm.has(v.id)) continue;
        seenForm.add(v.id);
      }
      if (v.kind === 'document' && v.id) {
        if (seenDoc.has(v.id)) continue;
        seenDoc.add(v.id);
      }
      if (v.kind === 'persona_gate') {
        if (seenGate) continue;
        seenGate = true;
      }
      cleaned.push(v);
    }

    if (cleaned.length === 0) {
      return json(res, 200, defaultPlan());
    }

    return json(res, 200, {
      sections: cleaned,
      summary: parsed.summary || 'Tailored intake path from Gemini Flash.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json(res, 200, {
      ...defaultPlan(),
      _warning: `Planner fell back to default: ${message}`,
    });
  }
}
