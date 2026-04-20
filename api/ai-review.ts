import { GoogleGenAI, Type } from '@google/genai';

export const config = { runtime: 'nodejs', maxDuration: 30 };

type DocumentRef = {
  name: string;
  url?: string;
  mimeType?: string;
  documentType?: string;
};

type ReviewRequest = {
  merchantData: Record<string, unknown>;
  ruleResult: {
    riskScore: number;
    riskCategory: string;
    riskFactors: string[];
    recommendedProcessor: string;
    missingItems: string[];
    reason: string;
  };
  documents?: DocumentRef[];
};

type ReviewResponse = {
  riskScore: number;
  riskCategory: 'Low' | 'Medium' | 'High';
  recommendedProcessor: 'Nuvei' | 'Payroc / Peoples' | 'Chase';
  confidence: number;
  redFlags: string[];
  strengths: string[];
  recommendedAction: 'approve' | 'approve_with_conditions' | 'hold_for_review' | 'request_more_info' | 'decline';
  adminNotes: string;
  merchantMessage: string;
  docConsistencyNotes: string[];
};

const SYSTEM_INSTRUCTION = `You are an expert payments underwriting analyst reviewing a merchant onboarding application.

You are given:
1. A rule-based engine's preliminary assessment (risk score, factors, processor recommendation).
2. The full merchant intake answers (business details, ownership, processing history, sales profile, website, documents readiness).
3. Any uploaded document references.

Your job:
- Independently assess the merchant's risk and processor fit.
- Either confirm the rule-based result or explain disagreement.
- Surface red flags the rules may have missed (subtle inconsistencies in answers, vague descriptions, unusual patterns).
- Surface strengths that mitigate risk.
- Recommend a concrete next action for the admin.
- Write a short professional message the merchant can read.

Processor routing guide:
- Nuvei: standard Canadian merchants, clean KYC/KYB, low-to-mid risk.
- Payroc / Peoples: adverse history, higher risk, needs manual review or specialized underwriting.
- Chase: larger enterprise, card-not-present heavy, advance-payment, structured ownership, international.

Rules:
- Base your decision on provided data only. Do not invent facts.
- If data is incomplete, say so and request specific missing items.
- Be concise. Admin notes: 2-4 sentences. Merchant message: 1-2 sentences, polite and actionable.
- Red flags and strengths: 2-5 short bullet points each.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    riskScore: { type: Type.INTEGER, description: 'Integer 0-100' },
    riskCategory: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
    recommendedProcessor: { type: Type.STRING, enum: ['Nuvei', 'Payroc / Peoples', 'Chase'] },
    confidence: { type: Type.NUMBER, description: '0.0-1.0 confidence in this recommendation' },
    redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    recommendedAction: {
      type: Type.STRING,
      enum: ['approve', 'approve_with_conditions', 'hold_for_review', 'request_more_info', 'decline'],
    },
    adminNotes: { type: Type.STRING, description: '2-4 sentence summary for the admin' },
    merchantMessage: { type: Type.STRING, description: '1-2 sentence message to show the merchant' },
    docConsistencyNotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Notes about whether uploaded documents align with intake answers',
    },
  },
  required: [
    'riskScore',
    'riskCategory',
    'recommendedProcessor',
    'confidence',
    'redFlags',
    'strengths',
    'recommendedAction',
    'adminNotes',
    'merchantMessage',
    'docConsistencyNotes',
  ],
};

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

  let body: ReviewRequest;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  if (!body?.merchantData || !body?.ruleResult) {
    return json(res, 400, { error: 'merchantData and ruleResult are required' });
  }

  const userPrompt = buildUserPrompt(body);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });

    const text = response.text;
    if (!text) {
      return json(res, 502, { error: 'Empty response from Gemini' });
    }

    let parsed: ReviewResponse;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json(res, 502, { error: 'Gemini returned non-JSON output', raw: text });
    }

    return json(res, 200, parsed);
  } catch (err: any) {
    const message = err?.message || 'Unknown error';
    return json(res, 502, { error: `Gemini call failed: ${message}` });
  }
}

function buildUserPrompt(body: ReviewRequest): string {
  const { merchantData, ruleResult, documents = [] } = body;

  const merchantJson = JSON.stringify(merchantData, redactSensitive, 2);
  const ruleJson = JSON.stringify(ruleResult, null, 2);
  const docLines = documents.length
    ? documents
        .map(
          (d) =>
            `- ${d.name} (${d.mimeType || 'unknown type'})${d.documentType ? ` — ${d.documentType}` : ''}${d.url ? ` [stored]` : ''}`
        )
        .join('\n')
    : '(no documents uploaded)';

  return `RULE-BASED ENGINE RESULT:
${ruleJson}

MERCHANT INTAKE DATA:
${merchantJson}

UPLOADED DOCUMENTS:
${docLines}

Produce your independent review now.`;
}

function redactSensitive(key: string, value: unknown): unknown {
  if (typeof key === 'string') {
    const k = key.toLowerCase();
    if (k === 'accountnumber' || k === 'routingnumber' || k === 'taxid' || k === 'ownerIdNumber'.toLowerCase()) {
      if (typeof value === 'string' && value.length > 4) return `***${value.slice(-4)}`;
    }
  }
  if (value && typeof value === 'object' && 'data' in (value as any) && 'mimeType' in (value as any)) {
    const v = value as any;
    return { name: v.name, mimeType: v.mimeType, status: v.status, uploadDate: v.uploadDate };
  }
  return value;
}
