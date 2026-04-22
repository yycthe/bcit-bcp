import { GoogleGenAI, Type } from '@google/genai';

export const config = { runtime: 'nodejs', maxDuration: 60 };

// Kept inline to guarantee the serverless bundler never needs to resolve src/ path aliases.
// Mirrors src/lib/ruleBasedWorkflow.ts. Update both sides if policy changes.
const ONBOARDING_POLICY_PROMPT = [
  'Operate this merchant onboarding app as an AI-assisted workflow governed by explicit policy rules. AI reviews every submitted application; a human admin always confirms the final decision.',
  '',
  'Required app flow:',
  '1. Merchant Portal collects only the Common Questions first.',
  '2. Controlled verification planning decides where KYC / KYB belongs and which parties require KYB or KYC before processor routing.',
  '3. Admin Portal records local KYC / KYB verification status and follow-up issues.',
  '4. AI reviews the application end-to-end (intake answers, uploaded documents, website, verification context) and produces the risk score, recommended processor, and recommended action.',
  '5. Merchant Portal asks only the matched processor-specific second-layer questions.',
  '6. System assembles a processor-ready package for Admin approval and routing — admin has final say.',
  '',
  'Global rules (enforced regardless of AI output):',
  '- Do not ask Nuvei, Payroc / Peoples, or Chase-specific questions during Common Intake.',
  '- Do not route to a processor until Common Intake and KYC / KYB readiness checks are sufficiently complete.',
  '- AI produces all underwriting recommendations; every final processor assignment and merchant-facing message must be explicitly confirmed by a human admin.',
  '- Deterministic checks may produce readiness context, but they must not supply the final risk score, processor route, or approval recommendation.',
  '- Prefer dropdowns and short structured answers. Use free text only for names, addresses, explanations, contacts, and narrative business descriptions.',
  '- Admin advanced overrides remain available; the policy text is the audit source of truth.',
  '',
  'Processor routing guide for AI review:',
  '- Nuvei: standard Canadian merchants, clean KYC / KYB, low-to-mid risk.',
  '- Payroc / Peoples: adverse history, higher risk, needs manual review or specialized underwriting.',
  '- Chase: larger enterprise, card-not-present heavy, advance-payment, structured ownership, international.',
].join('\n');

type DocumentRef = {
  name: string;
  url?: string;
  dataUrl?: string;
  mimeType?: string;
  documentType?: string;
  contentEncoding?: 'gzip';
};

type ReviewRequest = {
  merchantData: Record<string, unknown>;
  aiContext?: Record<string, unknown>;
  documents?: DocumentRef[];
};

type EvidenceCitation = { claim: string; source: string };

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
  evidenceCitations: EvidenceCitation[];
};

// Gemini inline_data caps — keep total request payload safe inside the serverless limit.
const MAX_DOC_BYTES = 6 * 1024 * 1024; // per document (6MB)
const MAX_TOTAL_DOC_BYTES = 15 * 1024 * 1024; // aggregate (15MB)
const SUPPORTED_INLINE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const SYSTEM_INSTRUCTION = `You are the senior underwriting analyst for a payments onboarding platform. You review every submitted merchant application end-to-end and recommend a decision — but a human admin always has the final say.

You will receive:
1. The policy rules that govern the workflow (authoritative — you must never contradict them).
2. A structured AI review context containing verification placement, KYB/KYC targets, readiness summaries, and admin-entered local verification results.
3. The full merchant intake answers (business details, ownership, processing history, sales profile, website URL, banking, documents status).
4. The actual contents of any uploaded documents (PDFs or images) — inspect them directly.
5. Optional merchant website URL for additional signal (reason about the domain / what the merchant says they sell).

Your job:
- Produce an independent decision: risk score, risk category, recommended processor, recommended action, confidence.
- Whenever you cite a substantive finding (risk factor, contradiction, inconsistency), add an evidenceCitation entry naming the intake field path (e.g. merchantData.legalName) or the document filename (page number if discernible from the PDF viewer context).
- Explicitly check uploaded documents against intake answers (legal name, address, ownership, bank account, tax ID, processing volume). Surface every inconsistency in docConsistencyNotes.
- Surface red flags the intake or readiness context may have missed (subtle inconsistencies in answers, vague descriptions, unusual patterns, claims not supported by uploaded docs, misleading website).
- Surface strengths that mitigate risk.
- Do not copy any app-side readiness context as a risk score, processor route, or approval action. You must produce those recommendations yourself from the evidence.
- If required data or documents are missing, set recommendedAction to request_more_info and enumerate the exact missing items in redFlags.
- Never invent facts. If data is incomplete, say so.
- Admin notes: 3-6 sentences covering what you saw and why you recommend the action.
- Merchant message: 1-2 sentences, polite and actionable — this will be shown to the merchant if admin accepts your plan.

POLICY PROMPT (authoritative):
---
${ONBOARDING_POLICY_PROMPT}
---`;

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
    adminNotes: { type: Type.STRING, description: '3-6 sentence summary for the admin' },
    merchantMessage: { type: Type.STRING, description: '1-2 sentence message to show the merchant' },
    docConsistencyNotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Notes about whether uploaded documents align with intake answers',
    },
    evidenceCitations: {
      type: Type.ARRAY,
      description: 'Each substantive claim mapped to intake field path or document filename (+ page if known)',
      items: {
        type: Type.OBJECT,
        properties: {
          claim: { type: Type.STRING },
          source: { type: Type.STRING },
        },
        required: ['claim', 'source'],
      },
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
    'evidenceCitations',
  ],
};

function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

const GEMINI_MODEL_FLASH = 'gemini-2.5-flash';

function resolveReviewModel(): string {
  const fromEnv =
    process.env.GEMINI_REVIEW_MODEL?.trim() || process.env.AI_REVIEW_MODEL?.trim();
  return fromEnv || GEMINI_MODEL_FLASH;
}

function isGeminiQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();
  if (lower.includes('resource_exhausted')) return true;
  if (lower.includes('"code":429') || lower.includes(' 429') || lower.includes('status":429')) return true;
  if (lower.includes('quota') && (lower.includes('exceeded') || lower.includes('limit: 0'))) return true;
  return false;
}

async function runStructuredReview(
  ai: GoogleGenAI,
  model: string,
  userParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
): Promise<ReviewResponse> {
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: userParts,
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Empty response from Gemini');
  }
  try {
    return JSON.parse(text) as ReviewResponse;
  } catch {
    throw new Error(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
  }
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

  if (!body?.merchantData) {
    return json(res, 400, { error: 'merchantData is required' });
  }

  // Build parts: a) header text, b) inlined document contents, c) footer instruction.
  const headerText = buildUserHeader(body);
  const { parts: docParts, inspected, skipped } = await loadDocumentParts(body.documents || []);
  const footerText = `\n\nINSPECTION SUMMARY:\n- documents_inlined: ${inspected}\n- documents_skipped: ${skipped.length}${
    skipped.length ? `\n- skipped_reasons: ${skipped.join('; ')}` : ''
  }\n\nProduce your independent review now as JSON per schema.`;

  const userParts = [{ text: headerText }, ...docParts, { text: footerText }];
  const primaryModel = resolveReviewModel();

  try {
    const ai = new GoogleGenAI({ apiKey });
    let parsed: ReviewResponse;
    try {
      parsed = await runStructuredReview(ai, primaryModel, userParts);
    } catch (firstErr) {
      if (primaryModel !== GEMINI_MODEL_FLASH && isGeminiQuotaError(firstErr)) {
        parsed = await runStructuredReview(ai, GEMINI_MODEL_FLASH, userParts);
      } else {
        throw firstErr;
      }
    }

    return json(res, 200, parsed);
  } catch (err: any) {
    const message = err?.message || 'Unknown error';
    return json(res, 502, { error: `Gemini call failed: ${message}` });
  }
}

function buildUserHeader(body: ReviewRequest): string {
  const { merchantData, aiContext = {}, documents = [] } = body;

  const merchantJson = JSON.stringify(merchantData, redactSensitive, 2);
  const contextJson = JSON.stringify(aiContext, null, 2);
  const docManifest = documents.length
    ? documents
        .map(
          (d) =>
            `- ${d.name} · ${d.mimeType || 'unknown type'}${d.documentType ? ` · ${d.documentType}` : ''}${d.url || d.dataUrl ? ' · [content attached below]' : ' · [reference only, no content]'}`
        )
        .join('\n')
    : '(no documents uploaded)';
  const website = (merchantData as { website?: string })?.website || '';
  const websiteLine = website ? `MERCHANT WEBSITE: ${website}` : 'MERCHANT WEBSITE: (not provided)';

  return `AI REVIEW CONTEXT (readiness and verification context only; not a recommendation):
${contextJson}

MERCHANT INTAKE DATA (sensitive fields redacted):
${merchantJson}

${websiteLine}

UPLOADED DOCUMENTS MANIFEST:
${docManifest}

`;
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string; bytes: number } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;
  const base64 = match[2];
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return {
    mimeType: match[1].toLowerCase(),
    base64,
    bytes: Math.max(0, Math.floor((base64.length * 3) / 4) - padding),
  };
}

async function loadDocumentParts(
  documents: DocumentRef[]
): Promise<{ parts: any[]; inspected: number; skipped: string[] }> {
  const parts: any[] = [];
  const skipped: string[] = [];
  let inspected = 0;
  let used = 0;

  for (const d of documents) {
    try {
      if (d.contentEncoding === 'gzip') {
        skipped.push(`${d.name}: compressed inline upload cannot be inspected`);
        continue;
      }
      let mime = (d.mimeType || 'application/pdf').toLowerCase();
      let base64: string;
      let size: number;

      if (d.url) {
        const resp = await fetch(d.url);
        if (!resp.ok) {
          skipped.push(`${d.name}: fetch ${resp.status}`);
          continue;
        }
        const buf = await resp.arrayBuffer();
        size = buf.byteLength;
        base64 = Buffer.from(buf).toString('base64');
      } else if (d.dataUrl) {
        const parsed = parseDataUrl(d.dataUrl);
        if (!parsed) {
          skipped.push(`${d.name}: invalid data URL`);
          continue;
        }
        mime = parsed.mimeType || mime;
        base64 = parsed.base64;
        size = parsed.bytes;
      } else {
        skipped.push(`${d.name}: no inspectable content`);
        continue;
      }

      if (!SUPPORTED_INLINE_TYPES.has(mime)) {
        skipped.push(`${d.name}: unsupported mime ${mime}`);
        continue;
      }
      if (used >= MAX_TOTAL_DOC_BYTES) {
        skipped.push(`${d.name}: aggregate size cap reached`);
        continue;
      }
      if (size > MAX_DOC_BYTES) {
        skipped.push(`${d.name}: ${Math.round(size / 1024 / 1024)}MB exceeds per-doc cap`);
        continue;
      }
      if (used + size > MAX_TOTAL_DOC_BYTES) {
        skipped.push(`${d.name}: would exceed aggregate cap`);
        continue;
      }
      used += size;
      inspected += 1;

      parts.push({
        text: `---\nBEGIN DOCUMENT: ${d.name}${d.documentType ? ` (${d.documentType})` : ''}\n---`,
      });
      parts.push({
        inlineData: {
          mimeType: mime,
          data: base64,
        },
      });
      parts.push({ text: `---\nEND DOCUMENT: ${d.name}\n---` });
    } catch (err: any) {
      skipped.push(`${d.name}: ${err?.message || 'fetch error'}`);
    }
  }

  return { parts, inspected, skipped };
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
