import { createGateway, generateObject } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { z } from 'zod';
import type { MerchantData } from '../src/types';

export type VerificationStatus = 'Verified' | 'Discrepancies Found' | 'Unverified';

export type UnderwritingApiResult = {
  riskScore: number;
  riskCategory: 'Low' | 'Medium' | 'High';
  riskFactors: string[];
  recommendedProcessor: string;
  reason: string;
  documentSummary: string;
  verificationStatus: VerificationStatus;
  verificationNotes: string[];
};

const underwritingSchema = z.object({
  riskScore: z.number(),
  riskCategory: z.enum(['Low', 'Medium', 'High']),
  riskFactors: z.array(z.string()),
  recommendedProcessor: z.enum(['Stripe', 'Adyen', 'Nuvei', 'HighRiskPay']),
  reason: z.string(),
  documentSummary: z.string(),
  verificationStatus: z.enum(['Verified', 'Discrepancies Found', 'Unverified']),
  verificationNotes: z.array(z.string()),
});

const ALLOWED_PROCESSORS = ['Stripe', 'Adyen', 'Nuvei', 'HighRiskPay'] as const;

/** Default xAI model: low-cost, current-gen; supports multimodal/file-style inputs via AI SDK. Override with XAI_MODEL or AI_MODEL. */
const DEFAULT_XAI_MODEL = 'grok-3-mini-latest';

const DEFAULT_GATEWAY_MODEL = 'google/gemini-2.0-flash';

function normalizeRiskCategory(value: unknown, riskScore: number): 'Low' | 'Medium' | 'High' {
  if (value === 'Low' || value === 'Medium' || value === 'High') {
    return value;
  }
  const s = Number.isFinite(riskScore) ? riskScore : 50;
  if (s <= 33) return 'Low';
  if (s <= 66) return 'Medium';
  return 'High';
}

function normalizeRecommendedProcessor(value: unknown): string {
  if (typeof value === 'string' && (ALLOWED_PROCESSORS as readonly string[]).includes(value)) {
    return value;
  }
  return 'Nuvei';
}

function normalizeVerificationStatus(value: unknown): VerificationStatus {
  if (value === 'Verified' || value === 'Discrepancies Found' || value === 'Unverified') {
    return value;
  }
  return 'Unverified';
}

function nonEmptyString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return fallback;
}

const FILE_KEYS = [
  'financials',
  'idUpload',
  'enhancedVerification',
  'proofOfAddress',
  'registrationCertificate',
  'taxDocument',
  'proofOfFunds',
  'bankStatement',
  'complianceDocument',
] as const;

function buildPromptText(finalData: MerchantData): string {
  return `You are an expert payment processing underwriter. Analyze the following merchant profile and any provided documents.

Merchant Profile:
${JSON.stringify(Object.fromEntries(Object.entries(finalData).filter(([k, v]) => v && typeof v !== 'object')), null, 2)}

Based on the profile and the provided documents (if any), perform a comprehensive risk assessment.
1. Calculate a numerical "riskScore" from 0 to 100 (0 = lowest risk, 100 = highest risk). Use a baseline of 20. Add points for high-risk industries (+30), cross-border processing (+15), high volume >$250k (+15), lack of financial documents (+10), lack of ID (+10). Deduct points if documents are provided and look legitimate (-10 per valid document type).
2. Categorize the risk into "riskCategory" (0-33: Low, 34-66: Medium, 67-100: High).
3. Provide 2-3 specific "riskFactors" explaining the score (e.g., "High average ticket size increases chargeback exposure", "Regulated industry requires specialized underwriting", "Verified financial documents reduce risk"). Be specific to the data provided.
4. Recommend a payment processor from this list: Stripe, Adyen, Nuvei, HighRiskPay.
5. Provide a brief reason for your recommendation.
6. If any documents were uploaded (e.g., Financial Statements, ID, Business Licenses, Proof of Address), extract the key information from them and summarize all extracted information clearly in the "documentSummary" field. Format the summary with clear bullet points separated by newlines. If no documents are provided or readable, return "No document information extracted".
7. VERIFICATION AUDIT: Cross-reference the self-reported Merchant Profile data (like legalName, ownerName, address) against the information extracted from the uploaded documents.
   - Compare names, addresses, and business details.
   - Output "verificationStatus": "Verified" (if data matches), "Discrepancies Found" (if there are mismatches), or "Unverified" (if not enough documents to verify).
   - Output an array of "verificationNotes" explaining the audit results.

Return the result as structured fields matching the required schema exactly.`;
}

/**
 * xAI API key: explicit XAI_API_KEY, or any env var from Vercel's xAI integration (suffix `_XAI_API_KEY`).
 */
export function resolveXaiApiKey(): string | undefined {
  const direct = process.env.XAI_API_KEY?.trim();
  if (direct) return direct;
  const prefixed = Object.keys(process.env)
    .filter((k) => k.endsWith('_XAI_API_KEY'))
    .sort();
  for (const k of prefixed) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

// AI SDK v5 parts: ImagePart / FilePart use `mediaType` (not `mimeType`).
type UserContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; image: Uint8Array; mediaType?: string }
  | { type: 'file'; data: Uint8Array; mediaType: string; filename?: string };

function buildUserContent(finalData: MerchantData): UserContentPart[] {
  const promptText = buildPromptText(finalData);
  const content: UserContentPart[] = [{ type: 'text', text: promptText }];

  for (const key of FILE_KEYS) {
    const fileData = finalData[key as keyof MerchantData] as
      | { mimeType?: string; data?: string; name?: string }
      | null;
    if (!fileData?.mimeType || !fileData?.data) continue;
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(Buffer.from(fileData.data.replace(/^data:[^;]+;base64,/, ''), 'base64'));
    } catch {
      continue;
    }
    const mime = fileData.mimeType;
    const filename = typeof fileData.name === 'string' && fileData.name.trim() ? fileData.name.trim() : undefined;
    if (mime.startsWith('image/')) {
      content.push({ type: 'image', image: bytes, mediaType: mime });
    } else {
      const filePart: { type: 'file'; data: Uint8Array; mediaType: string; filename?: string } = {
        type: 'file',
        data: bytes,
        mediaType: mime,
      };
      if (filename) filePart.filename = filename;
      content.push(filePart);
    }
  }
  return content;
}

function resolveModelForXai(): string {
  return (
    (typeof process.env.XAI_MODEL === 'string' && process.env.XAI_MODEL.trim()) ||
    (typeof process.env.AI_MODEL === 'string' && process.env.AI_MODEL.trim()) ||
    DEFAULT_XAI_MODEL
  );
}

function resolveModelForGateway(): string {
  return (
    (typeof process.env.AI_GATEWAY_MODEL === 'string' && process.env.AI_GATEWAY_MODEL.trim()) ||
    (typeof process.env.AI_MODEL === 'string' && process.env.AI_MODEL.trim()) ||
    DEFAULT_GATEWAY_MODEL
  );
}

export async function runUnderwriting(finalData: MerchantData): Promise<UnderwritingApiResult> {
  const content = buildUserContent(finalData);

  const abortSignal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(120_000)
      : undefined;

  const xaiKey = resolveXaiApiKey();
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();

  let object;
  try {
    if (xaiKey) {
      const xai = createXai({ apiKey: xaiKey });
      const modelId = resolveModelForXai();
      console.log('[underwrite] xai', modelId, 'contentParts:', content.length);
      const result = await generateObject({
        model: xai(modelId),
        schema: underwritingSchema,
        messages: [{ role: 'user', content }],
        abortSignal,
      });
      object = result.object;
    } else {
      const gateway = createGateway(gatewayKey ? { apiKey: gatewayKey } : {});
      const modelId = resolveModelForGateway();
      console.log('[underwrite] gateway', modelId, 'contentParts:', content.length);
      const result = await generateObject({
        model: gateway(modelId),
        schema: underwritingSchema,
        messages: [{ role: 'user', content }],
        abortSignal,
      });
      object = result.object;
    }
  } catch (aiError) {
    console.error('[underwrite] generateObject error:', aiError);
    throw aiError;
  }

  const riskScore =
    typeof object.riskScore === 'number' && Number.isFinite(object.riskScore) ? object.riskScore : 50;

  const riskFactors = Array.isArray(object.riskFactors)
    ? object.riskFactors.filter((n): n is string => typeof n === 'string')
    : [];

  const verificationNotes = Array.isArray(object.verificationNotes)
    ? object.verificationNotes.filter((n): n is string => typeof n === 'string')
    : [];

  return {
    riskScore,
    riskCategory: normalizeRiskCategory(object.riskCategory, riskScore),
    riskFactors,
    recommendedProcessor: normalizeRecommendedProcessor(object.recommendedProcessor),
    reason: nonEmptyString(object.reason, 'No reason provided by the model.'),
    documentSummary: nonEmptyString(object.documentSummary, 'No document information extracted.'),
    verificationStatus: normalizeVerificationStatus(object.verificationStatus),
    verificationNotes,
  };
}
