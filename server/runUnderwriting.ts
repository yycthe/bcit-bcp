import { createGateway, generateObject } from 'ai';
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

/** @param gatewayApiKey Optional; when empty, AI SDK uses AI_GATEWAY_API_KEY from env or Vercel OIDC. */
export async function runUnderwriting(
  gatewayApiKey: string | undefined,
  finalData: MerchantData
): Promise<UnderwritingApiResult> {
  const gateway = createGateway(
    gatewayApiKey !== undefined && gatewayApiKey.length > 0 ? { apiKey: gatewayApiKey } : {}
  );

  const modelId =
    (typeof process.env.AI_GATEWAY_MODEL === 'string' && process.env.AI_GATEWAY_MODEL.trim()) ||
    'openai/gpt-4o';

  const promptText = buildPromptText(finalData);

  type UserContentPart =
    | { type: 'text'; text: string }
    | { type: 'image'; image: Uint8Array; mimeType?: string }
    | { type: 'file'; data: Uint8Array; mediaType: string };

  const content: UserContentPart[] = [{ type: 'text', text: promptText }];

  for (const key of FILE_KEYS) {
    const fileData = finalData[key as keyof MerchantData] as { mimeType?: string; data?: string } | null;
    if (!fileData?.mimeType || !fileData?.data) continue;
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(Buffer.from(fileData.data.replace(/^data:[^;]+;base64,/, ''), 'base64'));
    } catch {
      continue;
    }
    const mime = fileData.mimeType;
    if (mime.startsWith('image/')) {
      content.push({ type: 'image', image: bytes, mimeType: mime });
    } else {
      content.push({ type: 'file', data: bytes, mediaType: mime });
    }
  }

  const abortSignal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(60_000)
      : undefined;

  const { object } = await generateObject({
    model: gateway(modelId),
    schema: underwritingSchema,
    messages: [{ role: 'user', content }],
    abortSignal,
  });

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
