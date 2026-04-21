import { GoogleGenAI, Type } from '@google/genai';
import {
  buildFallbackVerificationPlanFromProfile,
  type VerificationPlan,
  type VerificationPlannerProfile,
} from '@/src/lib/intake/verificationPlan';

export const config = { runtime: 'nodejs', maxDuration: 30 };

const GEMINI_MODEL_FLASH = 'gemini-2.5-flash';

function resolveVerificationModel(): string {
  const fromEnv = process.env.GEMINI_VERIFICATION_PLAN_MODEL?.trim();
  return fromEnv || GEMINI_MODEL_FLASH;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    placement: {
      type: Type.STRING,
      enum: ['early_checkpoint', 'standard_checkpoint', 'late_checkpoint'],
    },
    kyb_required: { type: Type.BOOLEAN },
    kyc_required: { type: Type.BOOLEAN },
    kyb_targets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          entity_key: { type: Type.STRING },
          entity_name: { type: Type.STRING },
          roles: { type: Type.ARRAY, items: { type: Type.STRING } },
          reason_code: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['entity_key', 'roles', 'reason_code', 'reason'],
      },
    },
    kyc_targets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          person_key: { type: Type.STRING },
          full_name: { type: Type.STRING },
          roles: { type: Type.ARRAY, items: { type: Type.STRING } },
          reason_code: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['person_key', 'roles', 'reason_code', 'reason'],
      },
    },
    reason_code: { type: Type.STRING },
    reason: { type: Type.STRING },
    blocking_items: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'placement',
    'kyb_required',
    'kyc_required',
    'kyb_targets',
    'kyc_targets',
    'reason_code',
    'reason',
    'blocking_items',
  ],
};

function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

function sanitizePlan(plan: VerificationPlan): VerificationPlan {
  const placement =
    plan.placement === 'early_checkpoint' ||
    plan.placement === 'standard_checkpoint' ||
    plan.placement === 'late_checkpoint'
      ? plan.placement
      : 'standard_checkpoint';

  const kybTargets = Array.isArray(plan.kyb_targets) ? plan.kyb_targets : [];
  const kycTargets = Array.isArray(plan.kyc_targets) ? plan.kyc_targets : [];

  return {
    placement,
    kyb_required: Boolean(plan.kyb_required),
    kyc_required: Boolean(plan.kyc_required),
    kyb_targets: kybTargets.map((target) => ({
      entity_key: String(target.entity_key || 'unknown_entity'),
      entity_name: typeof target.entity_name === 'string' ? target.entity_name : null,
      roles: Array.isArray(target.roles) ? (target.roles.map((role) => String(role)) as any) : [],
      reason_code: String(target.reason_code || 'unknown_reason'),
      reason: String(target.reason || ''),
    })),
    kyc_targets: kycTargets.map((target) => ({
      person_key: String(target.person_key || 'unknown_person'),
      full_name: typeof target.full_name === 'string' ? target.full_name : null,
      roles: Array.isArray(target.roles) ? (target.roles.map((role) => String(role)) as any) : [],
      reason_code: String(target.reason_code || 'unknown_reason'),
      reason: String(target.reason || ''),
    })),
    reason_code: String(plan.reason_code || 'default_midflow_multi_party_verification'),
    reason: String(plan.reason || ''),
    blocking_items: Array.isArray(plan.blocking_items)
      ? plan.blocking_items.map((item) => String(item))
      : [],
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  let body: { verificationProfile?: VerificationPlannerProfile };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  const profile = body?.verificationProfile;
  if (!profile) {
    return json(res, 400, { error: 'verificationProfile is required' });
  }

  const fallback = buildFallbackVerificationPlanFromProfile(profile);

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 200, fallback);
  }

  const systemInstruction = `You are deciding:
- where to place the KYC/KYB checkpoint
- which entities require KYB
- which individuals require KYC

Choose exactly one placement:
- early_checkpoint
- standard_checkpoint
- late_checkpoint

Rules:
- Prefer early_checkpoint for high-risk, regulated, international, parent-owned, or control-complex merchants.
- Prefer standard_checkpoint for most merchants once ownership, signer, and readiness context are known.
- Prefer late_checkpoint only for simple, low-risk merchants with straightforward ownership and strong readiness.
- Do not redesign the workflow. You are classifying within approved checkpoint positions only.
- Include all qualifying KYC individuals, not just one.
- Deduplicate people who hold multiple roles.
- Use the applicant legal entity as a KYB target whenever entity onboarding is in scope.
- If a parent-owned structure materially affects control, include the parent entity for review instead of ignoring it.
- If the signer is not already covered as a qualifying owner, include the signer.
- Include non-owner controllers when policy indicates they matter.
- Use only approved role labels: beneficial_owner, authorized_signer, non_owner_controller, significant_managerial_control, senior_manager, guarantor, delegate, applicant_legal_entity, parent_entity.
- Never invent facts. If an expected person exists but details are missing, return a placeholder target with a null name and explain the missing readiness item.
- If uncertain, choose standard_checkpoint.
- Return JSON only matching the schema.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: resolveVerificationModel(),
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Merchant verification profile:\n${JSON.stringify(profile, null, 2)}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) return json(res, 200, fallback);
    try {
      const parsed = JSON.parse(text) as VerificationPlan;
      return json(res, 200, sanitizePlan(parsed));
    } catch {
      return json(res, 200, fallback);
    }
  } catch {
    return json(res, 200, fallback);
  }
}
