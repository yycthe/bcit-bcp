/**
 * Merchant underwriting calls xAI through the Vercel AI SDK.
 * We prefer the provider's Responses API path for structured output, while keeping the payload conservative:
 * - merchant profile as text
 * - PDF content as locally extracted text (`unpdf`)
 * - images as image parts when present
 *
 * This avoids relying on chat/file-part PDF behavior, since xAI's current official "chat with files"
 * guidance centers on uploaded files / agentic search rather than raw PDF bytes inside chat content.
 *
 * @see https://docs.x.ai/docs/guides/structured-outputs
 * @see https://docs.x.ai/developers/model-capabilities/files/chat-with-files
 */
import { generateObject } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { extractText } from 'unpdf';
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

/**
 * Default xAI model: Grok 4 Fast Non-Reasoning.
 * This is currently listed by xAI as a Grok 4 family model with structured outputs, image understanding,
 * and chat-with-files capability, while being faster/safer for serverless time budgets than reasoning-heavy defaults.
 * Override with `XAI_MODEL` / `AI_MODEL` if you want a different Grok 4 family model.
 */
const DEFAULT_XAI_MODEL = 'grok-4-fast-non-reasoning';

const MAX_PDF_TEXT_CHARS = 80_000;

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

type UploadSummary = {
  field: typeof FILE_KEYS[number];
  name: string;
  mimeType: string;
  hasBinary: boolean;
};

function getUploadSummaries(finalData: MerchantData): UploadSummary[] {
  const summaries: UploadSummary[] = [];
  for (const key of FILE_KEYS) {
    const fileData = finalData[key as keyof MerchantData] as
      | { mimeType?: string; data?: string; name?: string }
      | null;
    if (!fileData) continue;
    const name = typeof fileData.name === 'string' && fileData.name.trim() ? fileData.name.trim() : key;
    const mimeType =
      typeof fileData.mimeType === 'string' && fileData.mimeType.trim()
        ? fileData.mimeType.trim()
        : 'application/octet-stream';
    summaries.push({
      field: key,
      name,
      mimeType,
      hasBinary: typeof fileData.data === 'string' && fileData.data.trim().length > 0,
    });
  }
  return summaries;
}

function buildUploadInventoryText(finalData: MerchantData): string {
  const uploads = getUploadSummaries(finalData);
  if (!uploads.length) {
    return 'No uploaded supporting documents were included in this request.';
  }

  return uploads
    .map(
      (upload) =>
        `- ${upload.field}: ${upload.name} (${upload.mimeType})${upload.hasBinary ? ' [content attached]' : ' [metadata only]'}`
    )
    .join('\n');
}

function buildPromptText(finalData: MerchantData): string {
  return `You are an expert payment processing underwriter. Analyze the following merchant profile and any provided documents.

Merchant Profile:
${JSON.stringify(Object.fromEntries(Object.entries(finalData).filter(([k, v]) => v && typeof v !== 'object')), null, 2)}

Uploaded Documents:
${buildUploadInventoryText(finalData)}

Based on the profile and the provided documents (if any), perform a comprehensive risk assessment.
1. Calculate a numerical "riskScore" from 0 to 100 (0 = lowest risk, 100 = highest risk). Use a baseline of 20. Add points for high-risk industries (+30), cross-border processing (+15), high volume >$250k (+15), lack of financial documents (+10), lack of ID (+10). Deduct points if documents are provided and look legitimate (-10 per valid document type).
2. Categorize the risk into "riskCategory" (0-33: Low, 34-66: Medium, 67-100: High).
3. Provide 2-3 specific "riskFactors" explaining the score (e.g., "High average ticket size increases chargeback exposure", "Regulated industry requires specialized underwriting", "Verified financial documents reduce risk"). Be specific to the data provided.
4. Recommend a payment processor from this list: Stripe, Adyen, Nuvei, HighRiskPay.
5. Provide a brief reason for your recommendation.
6. If any documents were uploaded (e.g., Financial Statements, ID, Business Licenses, Proof of Address), use the provided PDF text extracts and any attached images to extract key information, then summarize it clearly in the "documentSummary" field. Format the summary with clear bullet points separated by newlines. If no documents are provided or readable, return "No document information extracted".
7. VERIFICATION AUDIT: Cross-reference the self-reported Merchant Profile data (like legalName, ownerName, address) against the information extracted from the uploaded documents.
   - Compare names, addresses, and business details.
   - Output "verificationStatus": "Verified" (if data matches), "Discrepancies Found" (if there are mismatches), or "Unverified" (if not enough documents to verify).
   - Output an array of "verificationNotes" explaining the audit results.

Return the result as structured fields matching the required schema exactly.`;
}

/**
 * xAI API key resolution (server-only; never use VITE_* or client env):
 * 1) `XAI_API_KEY` if set
 * 2) Else the first non-empty env var whose name ends with `_XAI_API_KEY` (sorted by name).
 *    Vercel’s xAI integration injects names like `AI123456789_XAI_API_KEY` — no code change needed.
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

function isPdfFile(mime: string, filename?: string): boolean {
  const m = mime.toLowerCase();
  if (m === 'application/pdf' || m === 'application/x-pdf') return true;
  if (filename?.toLowerCase().endsWith('.pdf')) return true;
  return false;
}

// AI SDK v5 parts: ImagePart / FilePart use `mediaType` (not `mimeType`).
type UserContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; image: Uint8Array; mediaType?: string };

/**
 * Build multimodal user content conservatively:
 * - text always
 * - images when present
 * - no raw PDF/file parts by default
 */
function buildUserContent(finalData: MerchantData, opts?: { omitImages?: boolean }): UserContentPart[] {
  const promptText = buildPromptText(finalData);
  const content: UserContentPart[] = [{ type: 'text', text: promptText }];

  for (const key of FILE_KEYS) {
    const fileData = finalData[key as keyof MerchantData] as
      | { mimeType?: string; data?: string; name?: string }
      | null;
    if (!fileData?.data) continue;
    const filename = typeof fileData.name === 'string' && fileData.name.trim() ? fileData.name.trim() : undefined;
    const nameLo = filename?.toLowerCase() ?? '';
    const mime =
      (fileData.mimeType && fileData.mimeType.trim()) ||
      (nameLo.endsWith('.pdf') ? 'application/pdf' : '') ||
      (/\.(png|jpe?g|gif|webp)$/i.test(nameLo) ? 'image/jpeg' : '');
    if (!mime) continue;
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(Buffer.from(fileData.data.replace(/^data:[^;]+;base64,/, ''), 'base64'));
    } catch {
      continue;
    }
    if (isPdfFile(mime, filename)) {
      continue;
    }
    if (!opts?.omitImages && mime.startsWith('image/')) {
      content.push({ type: 'image', image: bytes, mediaType: mime });
    }
  }
  return content;
}

async function buildPdfTextAppendixForXai(finalData: MerchantData): Promise<string> {
  const sections: string[] = [];
  for (const key of FILE_KEYS) {
    const fileData = finalData[key as keyof MerchantData] as
      | { mimeType?: string; data?: string; name?: string }
      | null;
    if (!fileData?.data) continue;
    const name = typeof fileData.name === 'string' ? fileData.name : '';
    const mimeGuess = (fileData.mimeType && fileData.mimeType.trim()) || '';
    if (!isPdfFile(mimeGuess, name)) continue;
    try {
      const raw = fileData.data.replace(/^data:[^;]+;base64,/, '');
      const bytes = Uint8Array.from(Buffer.from(raw, 'base64'));
      const { text, totalPages } = await extractText(bytes, { mergePages: true });
      let body = typeof text === 'string' ? text.trim() : '';
      if (!body) {
        body =
          '(No text layer in this PDF — it may be a scan. Consider XAI_MODEL with a vision-capable workflow or upload images.)';
      } else if (body.length > MAX_PDF_TEXT_CHARS) {
        body = body.slice(0, MAX_PDF_TEXT_CHARS) + '\n\n[PDF text truncated for length]';
      }
      sections.push(
        `\n\n--- PDF "${name || key}" (${key}, ~${totalPages} page(s)) — extracted text ---\n${body}\n`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      sections.push(`\n\n--- PDF "${name || key}" (${key}) — extraction failed ---\n${msg}\n`);
    }
  }
  return sections.join('');
}

function resolveModelForXai(): string {
  return (
    (typeof process.env.XAI_MODEL === 'string' && process.env.XAI_MODEL.trim()) ||
    (typeof process.env.AI_MODEL === 'string' && process.env.AI_MODEL.trim()) ||
    DEFAULT_XAI_MODEL
  );
}

function serializeErrorPayload(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[max-depth]';
  if (value == null) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: serializeErrorPayload((value as Error & { cause?: unknown }).cause, depth + 1),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => serializeErrorPayload(item, depth + 1));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of ['name', 'message', 'cause', 'status', 'statusCode', 'responseBody', 'body', 'error']) {
      if (key in record) {
        out[key] = serializeErrorPayload(record[key], depth + 1);
      }
    }
    if (Object.keys(out).length) return out;
  }
  return String(value);
}

function describeAiError(error: unknown): string {
  if (error instanceof Error && error.message) {
    const extra = serializeErrorPayload(error);
    if (typeof extra === 'object' && extra && 'statusCode' in (extra as Record<string, unknown>)) {
      return `${error.message} (${JSON.stringify(extra)})`;
    }
    return error.message;
  }
  const serialized = serializeErrorPayload(error);
  return typeof serialized === 'string' ? serialized : JSON.stringify(serialized);
}

function countImageParts(content: UserContentPart[]): number {
  return content.filter((part) => part.type === 'image').length;
}

function mergePdfAppendixIntoFirstText(content: UserContentPart[], pdfAppendix: string): void {
  if (!pdfAppendix) return;
  const head = content[0];
  if (head?.type !== 'text') return;
  content[0] = {
    type: 'text',
    text:
      head.text +
      `\n\nThe following is text extracted from uploaded PDFs (supplement; use with the attached PDFs if present):\n${pdfAppendix}`,
  };
}

export async function runUnderwriting(finalData: MerchantData): Promise<UnderwritingApiResult> {
  const abortSignal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(45_000)
      : undefined;

  const xaiKey = resolveXaiApiKey();
  if (!xaiKey) {
    throw new Error('Missing XAI_API_KEY or an environment variable ending in _XAI_API_KEY.');
  }

  const xaiProvider = createXai({ apiKey: xaiKey });
  const modelId = resolveModelForXai();

  let object;
  const pdfAppendix = await buildPdfTextAppendixForXai(finalData);
  try {
    let content = buildUserContent(finalData);
    mergePdfAppendixIntoFirstText(content, pdfAppendix);
    console.log(
      '[underwrite] xai',
      modelId,
      'mode:responses-text+images',
      'contentParts:',
      content.length,
      'imageParts:',
      countImageParts(content),
      'pdfAppendixChars:',
      pdfAppendix.length
    );
    try {
      const result = await generateObject({
        model: xaiProvider.responses(modelId),
        schema: underwritingSchema,
        messages: [{ role: 'user', content }],
        abortSignal,
      });
      object = result.object;
    } catch (imageErr) {
      if (countImageParts(content) === 0) {
        throw imageErr;
      }
      console.warn('[underwrite] multimodal request failed; retrying without images:', describeAiError(imageErr));
      const fallback = buildUserContent(finalData, { omitImages: true });
      mergePdfAppendixIntoFirstText(fallback, pdfAppendix);
      console.log(
        '[underwrite] xai',
        modelId,
        'mode:responses-text-only',
        'contentParts:',
        fallback.length,
        'imageParts:',
        countImageParts(fallback),
        'pdfAppendixChars:',
        pdfAppendix.length
      );
      const result = await generateObject({
        model: xaiProvider.responses(modelId),
        schema: underwritingSchema,
        messages: [{ role: 'user', content: fallback }],
        abortSignal,
      });
      object = result.object;
    }
  } catch (aiError) {
    console.error('[underwrite] generateObject error:', describeAiError(aiError));
    throw new Error(describeAiError(aiError));
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
