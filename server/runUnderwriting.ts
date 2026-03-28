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
const DEFAULT_XAI_MODEL = 'grok-4-fast';
const XAI_BASE_URL = 'https://api.x.ai/v1';

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

type UploadedFileDescriptor = {
  field: string;
  name: string;
  mimeType: string;
  data?: string;
};

type XaiResponseTextPart = {
  type: 'output_text';
  text: string;
};

type XaiResponseOutputItem = {
  type?: string;
  content?: Array<XaiResponseTextPart | Record<string, unknown>>;
};

type XaiResponsesCreateResponse = {
  output?: XaiResponseOutputItem[];
};

function normalizeRiskCategory(value: unknown, riskScore: number): 'Low' | 'Medium' | 'High' {
  if (value === 'Low' || value === 'Medium' || value === 'High') return value;
  if (riskScore <= 33) return 'Low';
  if (riskScore <= 66) return 'Medium';
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
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function resolveXaiApiKey(): string | undefined {
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

function resolveModelForXai(): string {
  return process.env.XAI_MODEL?.trim() || process.env.AI_MODEL?.trim() || DEFAULT_XAI_MODEL;
}

function getAllUploadedFiles(finalData: MerchantData): UploadedFileDescriptor[] {
  const files: UploadedFileDescriptor[] = [];

  for (const key of FILE_KEYS) {
    const fileData = finalData[key as keyof MerchantData] as
      | { mimeType?: string; data?: string; name?: string }
      | null;
    if (!fileData) continue;
    files.push({
      field: key,
      name: typeof fileData.name === 'string' && fileData.name.trim() ? fileData.name.trim() : key,
      mimeType:
        typeof fileData.mimeType === 'string' && fileData.mimeType.trim()
          ? fileData.mimeType.trim()
          : 'application/octet-stream',
      data: typeof fileData.data === 'string' ? fileData.data : undefined,
    });
  }

  finalData.additionalDocuments?.forEach((file, index) => {
    files.push({
      field: `additionalDocument${index + 1}`,
      name: typeof file.name === 'string' && file.name.trim() ? file.name.trim() : `additional-document-${index + 1}`,
      mimeType:
        typeof file.mimeType === 'string' && file.mimeType.trim()
          ? file.mimeType.trim()
          : 'application/octet-stream',
      data: typeof file.data === 'string' ? file.data : undefined,
    });
  });

  return files;
}

function buildUploadInventoryText(finalData: MerchantData): string {
  const uploads = getAllUploadedFiles(finalData);
  if (!uploads.length) {
    return 'No uploaded supporting documents were included in this request.';
  }

  return uploads
    .map(
      (upload) =>
        `- ${upload.field}: ${upload.name} (${upload.mimeType})${upload.data?.trim() ? ' [content attached]' : ' [metadata only]'}`
    )
    .join('\n');
}

function buildPromptText(finalData: MerchantData): string {
  return `You are an expert payment processing underwriter. Analyze the following merchant profile and any provided documents.

Merchant Profile:
${JSON.stringify(Object.fromEntries(Object.entries(finalData).filter(([key, value]) => value && typeof value !== 'object')), null, 2)}

Uploaded Documents:
${buildUploadInventoryText(finalData)}

Based on the profile and the provided documents (if any), perform a comprehensive risk assessment.
1. Calculate a numerical "riskScore" from 0 to 100 (0 = lowest risk, 100 = highest risk). Use a baseline of 20. Add points for high-risk industries (+30), cross-border processing (+15), high volume >$250k (+15), lack of financial documents (+10), lack of ID (+10). Deduct points if documents are provided and look legitimate (-10 per valid document type).
2. Categorize the risk into "riskCategory" (0-33: Low, 34-66: Medium, 67-100: High).
3. Provide 2-3 specific "riskFactors" explaining the score.
4. Recommend a payment processor from this list: Stripe, Adyen, Nuvei, HighRiskPay.
5. Provide a brief reason for your recommendation.
6. Summarize uploaded files in "documentSummary" with clear bullets separated by newlines. If you cannot read them, say so plainly.
7. Cross-check profile fields against the uploaded documents and return "verificationStatus" and "verificationNotes".

Return only valid JSON matching the required schema.`;
}

function isPdfFile(mimeType: string, filename?: string): boolean {
  const mime = mimeType.toLowerCase();
  return mime === 'application/pdf' || mime === 'application/x-pdf' || filename?.toLowerCase().endsWith('.pdf') === true;
}

function isImageFile(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/');
}

function decodeBase64DataUrl(data: string): Uint8Array {
  return Uint8Array.from(Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64'));
}

function createUnderwritingJsonSchema() {
  return {
    name: 'underwriting_result',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        riskScore: { type: 'number' },
        riskCategory: { type: 'string', enum: ['Low', 'Medium', 'High'] },
        riskFactors: { type: 'array', items: { type: 'string' } },
        recommendedProcessor: { type: 'string', enum: [...ALLOWED_PROCESSORS] },
        reason: { type: 'string' },
        documentSummary: { type: 'string' },
        verificationStatus: {
          type: 'string',
          enum: ['Verified', 'Discrepancies Found', 'Unverified'],
        },
        verificationNotes: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'riskScore',
        'riskCategory',
        'riskFactors',
        'recommendedProcessor',
        'reason',
        'documentSummary',
        'verificationStatus',
        'verificationNotes',
      ],
    },
  };
}

async function xaiFetch(path: string, apiKey: string, init: RequestInit): Promise<Response> {
  return fetch(`${XAI_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    },
  });
}

async function uploadFileToXai(file: UploadedFileDescriptor, apiKey: string): Promise<string> {
  if (!file.data) {
    throw new Error(`Cannot upload ${file.name}: missing file bytes.`);
  }

  const bytes = decodeBase64DataUrl(file.data);
  const formData = new FormData();
  formData.append('purpose', 'assistants');
  formData.append('file', new Blob([bytes], { type: file.mimeType }), file.name);

  const response = await xaiFetch('/files', apiKey, {
    method: 'POST',
    body: formData,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`xAI file upload failed (${response.status}): ${text.slice(0, 400)}`);
  }

  const payload = JSON.parse(text) as { id?: string };
  if (!payload.id) {
    throw new Error(`xAI file upload succeeded but no file id was returned: ${text.slice(0, 400)}`);
  }

  return payload.id;
}

async function deleteXaiFile(fileId: string, apiKey: string): Promise<void> {
  try {
    await xaiFetch(`/files/${fileId}`, apiKey, { method: 'DELETE' });
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

function describeUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : JSON.stringify(error);
}

export async function runUnderwriting(finalData: MerchantData): Promise<UnderwritingApiResult> {
  const apiKey = resolveXaiApiKey();
  if (!apiKey) {
    throw new Error('Missing XAI_API_KEY or an environment variable ending in _XAI_API_KEY.');
  }

  const model = resolveModelForXai();
  const uploadedFiles = getAllUploadedFiles(finalData);
  const uploadedFileIds: string[] = [];

  try {
    const userContent: Array<Record<string, unknown>> = [
      {
        type: 'input_text',
        text: buildPromptText(finalData),
      },
    ];

    for (const file of uploadedFiles) {
      if (!file.data?.trim()) continue;
      if (isImageFile(file.mimeType)) {
        userContent.push({
          type: 'input_image',
          image_url: file.data,
        });
        continue;
      }

      if (isPdfFile(file.mimeType, file.name) || file.mimeType === 'text/plain') {
        const fileId = await uploadFileToXai(file, apiKey);
        uploadedFileIds.push(fileId);
        userContent.push({
          type: 'input_file',
          file_id: fileId,
        });
      }
    }

    const response = await xaiFetch('/responses', apiKey, {
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
            content: userContent,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            json_schema: createUnderwritingJsonSchema(),
          },
        },
      }),
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`xAI responses request failed (${response.status}): ${rawText.slice(0, 800)}`);
    }

    const payload = JSON.parse(rawText) as XaiResponsesCreateResponse;
    const responseText = extractResponseText(payload);
    if (!responseText) {
      throw new Error(`xAI responses request succeeded but no output_text was returned: ${rawText.slice(0, 800)}`);
    }

    const parsed = underwritingSchema.parse(JSON.parse(responseText));
    return {
      riskScore: parsed.riskScore,
      riskCategory: normalizeRiskCategory(parsed.riskCategory, parsed.riskScore),
      riskFactors: parsed.riskFactors,
      recommendedProcessor: normalizeRecommendedProcessor(parsed.recommendedProcessor),
      reason: nonEmptyString(parsed.reason, 'No reason provided by the model.'),
      documentSummary: nonEmptyString(parsed.documentSummary, 'No document information extracted.'),
      verificationStatus: normalizeVerificationStatus(parsed.verificationStatus),
      verificationNotes: parsed.verificationNotes,
    };
  } catch (error) {
    console.error('[underwrite] xAI REST error:', describeUnknownError(error));
    throw new Error(describeUnknownError(error));
  } finally {
    await Promise.all(uploadedFileIds.map((fileId) => deleteXaiFile(fileId, apiKey)));
  }
}
