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

export async function requestIntakePlan(anchor: {
  businessType?: string;
  country?: string;
  industry?: string;
  monthlyVolume?: string;
  monthlyTransactions?: string;
}): Promise<IntakePlan> {
  const response = await fetch('/api/intake/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anchor }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody?.error || `Intake plan failed (${response.status})`);
  }

  return response.json() as Promise<IntakePlan>;
}
