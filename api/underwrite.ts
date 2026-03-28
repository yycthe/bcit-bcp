export const runtime = 'nodejs';

type VerificationStatus = 'Verified' | 'Discrepancies Found' | 'Unverified';
type RiskCategory = 'Low' | 'Medium' | 'High';
type Processor = 'Stripe' | 'Adyen' | 'Nuvei' | 'HighRiskPay';

type UnderwritingApiResult = {
  riskScore: number;
  riskCategory: RiskCategory;
  riskFactors: string[];
  recommendedProcessor: Processor;
  reason: string;
  documentSummary: string;
  verificationStatus: VerificationStatus;
  verificationNotes: string[];
};

type MerchantFile = {
  name?: string;
  mimeType?: string;
  data?: string;
};

type MerchantDataLike = Record<string, unknown> & {
  additionalDocuments?: MerchantFile[];
};

type UploadedFileDescriptor = {
  field: string;
  name: string;
  mimeType: string;
  data?: string;
};

type XaiResponseTextPart = {
  type?: string;
  text?: string;
};

type XaiResponseOutputItem = {
  content?: XaiResponseTextPart[];
};

type XaiResponsesCreateResponse = {
  output?: XaiResponseOutputItem[];
};

const XAI_BASE_URL = 'https://api.x.ai/v1';
const DEFAULT_XAI_MODEL = 'grok-4-fast';
const ALLOWED_PROCESSORS: Processor[] = ['Stripe', 'Adyen', 'Nuvei', 'HighRiskPay'];
const XAI_UPLOAD_TIMEOUT_MS = 15_000;
const XAI_RESPONSE_TIMEOUT_MS = 35_000;
const MAX_BINARY_ATTACHMENTS = 2;
const MAX_BINARY_TOTAL_BYTES = 6_000_000;
const MAX_INLINE_IMAGE_BYTES = 4_000_000;
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function normalizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeRiskScore(value: unknown): number {
  const score = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(score)) return 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeRiskCategory(value: unknown, riskScore: number): RiskCategory {
  if (value === 'Low' || value === 'Medium' || value === 'High') return value;
  if (riskScore <= 33) return 'Low';
  if (riskScore <= 66) return 'Medium';
  return 'High';
}

function normalizeProcessor(value: unknown): Processor {
  if (typeof value === 'string' && ALLOWED_PROCESSORS.includes(value as Processor)) {
    return value as Processor;
  }
  return 'Nuvei';
}

function normalizeVerificationStatus(value: unknown): VerificationStatus {
  if (value === 'Verified' || value === 'Discrepancies Found' || value === 'Unverified') {
    return value;
  }
  return 'Unverified';
}

function parseUnderwritingResult(raw: unknown): UnderwritingApiResult {
  const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const riskScore = normalizeRiskScore(data.riskScore);
  return {
    riskScore,
    riskCategory: normalizeRiskCategory(data.riskCategory, riskScore),
    riskFactors: normalizeStringArray(data.riskFactors),
    recommendedProcessor: normalizeProcessor(data.recommendedProcessor),
    reason: normalizeString(data.reason, 'No reason provided by the model.'),
    documentSummary: normalizeString(data.documentSummary, 'No document information extracted.'),
    verificationStatus: normalizeVerificationStatus(data.verificationStatus),
    verificationNotes: normalizeStringArray(data.verificationNotes),
  };
}

function resolveXaiApiKey(): string | undefined {
  const direct = process.env.XAI_API_KEY?.trim();
  if (direct) return direct;

  const prefixed = Object.keys(process.env)
    .filter((key) => key.endsWith('_XAI_API_KEY'))
    .sort();

  for (const key of prefixed) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return undefined;
}

function resolveXaiModel(): string {
  return process.env.XAI_MODEL?.trim() || process.env.AI_MODEL?.trim() || DEFAULT_XAI_MODEL;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getUploadedFiles(merchantData: MerchantDataLike): UploadedFileDescriptor[] {
  const uploads: UploadedFileDescriptor[] = [];

  for (const key of FILE_KEYS) {
    const file = merchantData[key];
    if (!isPlainObject(file)) continue;
    uploads.push({
      field: key,
      name: normalizeString(file.name, key),
      mimeType: normalizeString(file.mimeType, 'application/octet-stream'),
      data: typeof file.data === 'string' ? file.data : undefined,
    });
  }

  const additionalDocuments = Array.isArray(merchantData.additionalDocuments)
    ? merchantData.additionalDocuments
    : [];

  additionalDocuments.forEach((file, index) => {
    if (!isPlainObject(file)) return;
    uploads.push({
      field: `additionalDocument${index + 1}`,
      name: normalizeString(file.name, `additional-document-${index + 1}`),
      mimeType: normalizeString(file.mimeType, 'application/octet-stream'),
      data: typeof file.data === 'string' ? file.data : undefined,
    });
  });

  return uploads;
}

function isImageFile(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/');
}

function isPdfFile(mimeType: string, fileName: string): boolean {
  const mime = mimeType.toLowerCase();
  return mime === 'application/pdf' || mime === 'application/x-pdf' || fileName.toLowerCase().endsWith('.pdf');
}

function decodeBase64DataUrl(data: string): Uint8Array {
  const base64 = data.replace(/^data:[^;]+;base64,/, '');
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

function buildMerchantProfileText(merchantData: MerchantDataLike): string {
  const scalarEntries = Object.entries(merchantData).filter(([, value]) => {
    return value !== null && value !== undefined && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean');
  });

  if (!scalarEntries.length) {
    return 'No scalar merchant profile fields were supplied.';
  }

  return JSON.stringify(Object.fromEntries(scalarEntries), null, 2);
}

function buildUploadInventoryText(
  merchantData: MerchantDataLike,
  deliveredFields: Set<string> = new Set(),
  skippedNotes: string[] = []
): string {
  const uploads = getUploadedFiles(merchantData);
  const lines = uploads.map((upload) => {
    const mode = deliveredFields.has(upload.field)
      ? 'sent to model'
      : upload.data?.trim()
        ? 'metadata only'
        : 'metadata only';
    return `- ${upload.field}: ${upload.name} (${upload.mimeType}, ${mode})`;
  });

  if (skippedNotes.length) {
    lines.push(...skippedNotes.map((note) => `- note: ${note}`));
  }

  if (!lines.length) {
    return 'No uploaded supporting documents were included in this request.';
  }

  return lines.join('\n');
}

function buildPromptText(
  merchantData: MerchantDataLike,
  deliveredFields: Set<string> = new Set(),
  skippedNotes: string[] = []
): string {
  return `You are an expert payment processing underwriter. Analyze the merchant profile and uploaded documents.

Merchant Profile:
${buildMerchantProfileText(merchantData)}

Uploaded Documents:
${buildUploadInventoryText(merchantData, deliveredFields, skippedNotes)}

Tasks:
1. Return a numerical riskScore from 0 to 100.
2. Return riskCategory as Low, Medium, or High.
3. Return 2-5 riskFactors.
4. Recommend one processor from Stripe, Adyen, Nuvei, HighRiskPay.
5. Explain the recommendation in reason.
6. Summarize what the uploaded files appear to contain in documentSummary. If only metadata was available, say that clearly.
7. Cross-check merchant profile against documents and return verificationStatus and verificationNotes.

Return JSON only with exactly these keys:
{
  "riskScore": number,
  "riskCategory": "Low" | "Medium" | "High",
  "riskFactors": string[],
  "recommendedProcessor": "Stripe" | "Adyen" | "Nuvei" | "HighRiskPay",
  "reason": string,
  "documentSummary": string,
  "verificationStatus": "Verified" | "Discrepancies Found" | "Unverified",
  "verificationNotes": string[]
}`;
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(`Timed out after ${timeoutMs}ms`), timeoutMs);
  return controller.signal;
}

function estimateBase64DataUrlBytes(data: string | undefined): number {
  if (!data?.trim()) return 0;
  const base64 = data.replace(/^data:[^;]+;base64,/, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function describeBinaryBudgetSkip(upload: UploadedFileDescriptor, reason: string): string {
  return `${upload.name} was not attached in binary form because ${reason}.`;
}

function shouldAttachInlineImage(upload: UploadedFileDescriptor): boolean {
  return estimateBase64DataUrlBytes(upload.data) <= MAX_INLINE_IMAGE_BYTES;
}

function shouldAttachBinaryDocument(
  upload: UploadedFileDescriptor,
  alreadyAttachedCount: number,
  alreadyAttachedBytes: number
): { ok: boolean; reason?: string; sizeBytes: number } {
  const sizeBytes = estimateBase64DataUrlBytes(upload.data);
  if (alreadyAttachedCount >= MAX_BINARY_ATTACHMENTS) {
    return {
      ok: false,
      reason: `the request already attached ${MAX_BINARY_ATTACHMENTS} binary documents`,
      sizeBytes,
    };
  }

  if (alreadyAttachedBytes + sizeBytes > MAX_BINARY_TOTAL_BYTES) {
    return {
      ok: false,
      reason: `adding it would exceed the ${Math.round(MAX_BINARY_TOTAL_BYTES / 1_000_000)}MB binary budget`,
      sizeBytes,
    };
  }

  return { ok: true, sizeBytes };
}

async function xaiFetch(
  path: string,
  apiKey: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  return fetch(`${XAI_BASE_URL}${path}`, {
    ...init,
    signal: init.signal ?? createTimeoutSignal(timeoutMs),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    },
  });
}

async function uploadFileToXai(file: UploadedFileDescriptor, apiKey: string): Promise<string> {
  if (!file.data?.trim()) {
    throw new Error(`Cannot upload ${file.name}: missing file bytes.`);
  }

  const bytes = decodeBase64DataUrl(file.data);
  const formData = new FormData();
  formData.append('purpose', 'assistants');
  formData.append('file', new Blob([bytes], { type: file.mimeType }), file.name);

  const response = await xaiFetch(
    '/files',
    apiKey,
    {
      method: 'POST',
      body: formData,
    },
    XAI_UPLOAD_TIMEOUT_MS
  );

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`xAI file upload failed (${response.status}): ${rawText.slice(0, 600)}`);
  }

  const payload = JSON.parse(rawText) as { id?: string };
  if (!payload.id) {
    throw new Error(`xAI file upload succeeded but returned no file id: ${rawText.slice(0, 600)}`);
  }

  return payload.id;
}

async function deleteXaiFile(fileId: string, apiKey: string): Promise<void> {
  try {
    await xaiFetch(`/files/${fileId}`, apiKey, { method: 'DELETE' }, XAI_UPLOAD_TIMEOUT_MS);
  } catch {
    // Best-effort cleanup only.
  }
}

function extractResponseText(payload: XaiResponsesCreateResponse): string {
  const texts: string[] = [];
  for (const item of payload.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && typeof part.text === 'string') {
        texts.push(part.text);
      }
    }
  }
  return texts.join('\n').trim();
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

async function runUnderwriting(merchantData: MerchantDataLike): Promise<UnderwritingApiResult> {
  const apiKey = resolveXaiApiKey();
  if (!apiKey) {
    throw new Error('Missing XAI_API_KEY or an environment variable ending in _XAI_API_KEY.');
  }

  const model = resolveXaiModel();
  const uploads = getUploadedFiles(merchantData);
  const uploadedFileIds: string[] = [];
  const deliveredFields = new Set<string>();
  const skippedNotes: string[] = [];

  try {
    const content: Array<Record<string, unknown>> = [];
    let attachedBinaryDocuments = 0;
    let attachedBinaryBytes = 0;

    for (const upload of uploads) {
      if (!upload.data?.trim()) continue;

      if (isImageFile(upload.mimeType)) {
        if (!shouldAttachInlineImage(upload)) {
          skippedNotes.push(describeBinaryBudgetSkip(upload, 'the image is too large for inline analysis in the current serverless budget'));
          continue;
        }
        content.push({
          type: 'input_image',
          image_url: upload.data,
        });
        deliveredFields.add(upload.field);
        continue;
      }

      if (isPdfFile(upload.mimeType, upload.name) || upload.mimeType === 'text/plain') {
        const attachmentDecision = shouldAttachBinaryDocument(
          upload,
          attachedBinaryDocuments,
          attachedBinaryBytes
        );
        if (!attachmentDecision.ok) {
          skippedNotes.push(describeBinaryBudgetSkip(upload, attachmentDecision.reason ?? 'it would exceed the runtime budget'));
          continue;
        }
        const fileId = await uploadFileToXai(upload, apiKey);
        uploadedFileIds.push(fileId);
        content.push({
          type: 'input_file',
          file_id: fileId,
        });
        deliveredFields.add(upload.field);
        attachedBinaryDocuments += 1;
        attachedBinaryBytes += attachmentDecision.sizeBytes;
      }
    }

    content.unshift({
      type: 'input_text',
      text: buildPromptText(merchantData, deliveredFields, skippedNotes),
    });

    const response = await xaiFetch(
      '/responses',
      apiKey,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          store: false,
          input: [
            {
              role: 'user',
              content,
            },
          ],
        }),
      },
      XAI_RESPONSE_TIMEOUT_MS
    );

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`xAI responses request failed (${response.status}): ${rawText.slice(0, 1000)}`);
    }

    const payload = JSON.parse(rawText) as XaiResponsesCreateResponse;
    const outputText = extractResponseText(payload);
    if (!outputText) {
      throw new Error(`xAI responses request succeeded but no output_text was returned: ${rawText.slice(0, 1000)}`);
    }

    return parseUnderwritingResult(JSON.parse(outputText));
  } finally {
    await Promise.all(uploadedFileIds.map((fileId) => deleteXaiFile(fileId, apiKey)));
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { merchantData?: MerchantDataLike };
    if (!isPlainObject(body) || !isPlainObject(body.merchantData)) {
      return jsonResponse({ error: 'Request body must include a merchantData object.' }, 400);
    }

    const result = await runUnderwriting(body.merchantData);
    return jsonResponse(result, 200);
  } catch (error) {
    const message = describeError(error);
    console.error('[underwrite] request failed:', message);
    return jsonResponse({ error: message }, 500);
  }
}

export default {
  async fetch(request: Request) {
    return POST(request);
  },
};
