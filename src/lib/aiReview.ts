import type { MerchantData, FileData } from '@/src/types';

// Structured slots inside merchantData that may hold a FileData blob.
// Keep this in sync with FILE_FIELDS in underwritingFallback.ts.
const MERCHANT_FILE_SLOTS = [
  'idUpload',
  'proofOfAddress',
  'registrationCertificate',
  'taxDocument',
  'proofOfFunds',
  'bankStatement',
  'financials',
  'complianceDocument',
  'enhancedVerification',
] as const;

export type AiReviewResult = {
  riskScore: number;
  riskCategory: 'Low' | 'Medium' | 'High';
  recommendedProcessor: 'Nuvei' | 'Payroc / Peoples' | 'Chase';
  confidence: number;
  redFlags: string[];
  strengths: string[];
  recommendedAction:
    | 'approve'
    | 'approve_with_conditions'
    | 'hold_for_review'
    | 'request_more_info'
    | 'decline';
  adminNotes: string;
  merchantMessage: string;
  docConsistencyNotes: string[];
  /** Claim → intake field path or document name (+ page if known). */
  evidenceCitations?: { claim: string; source: string }[];
};

type DocRef = {
  name: string;
  mimeType?: string;
  documentType?: string;
  url?: string;
  dataUrl?: string;
  contentEncoding?: 'gzip';
};

const MAX_INLINE_DOC_BYTES = 5 * 1024 * 1024;

function estimateDataUrlBytes(data: string): number {
  const base64 = data.replace(/^data:[^;]+;base64,/, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function toDocRef(d: FileData, fallbackType?: string): DocRef {
  const isRemote = typeof d.data === 'string' && /^https?:\/\//i.test(d.data);
  const isDataUrl = typeof d.data === 'string' && /^data:[^;]+;base64,/i.test(d.data);
  const canInlineDataUrl =
    isDataUrl && d.contentEncoding !== 'gzip' && estimateDataUrlBytes(d.data) <= MAX_INLINE_DOC_BYTES;

  return {
    name: d.name,
    mimeType: d.mimeType,
    documentType: d.documentType || fallbackType,
    // `data` is a Vercel Blob HTTPS URL when uploaded via uploadFileToBlob.
    url: isRemote ? d.data : undefined,
    // Small in-browser uploads are data URLs. Forward them so Gemini can still inspect them.
    dataUrl: canInlineDataUrl ? d.data : undefined,
    contentEncoding: d.contentEncoding,
  };
}

/** Gather every uploaded document: structured slots inside merchantData + extra documents. */
function collectAllDocuments(merchantData: MerchantData, extra: FileData[]): DocRef[] {
  const refs: DocRef[] = [];
  const seen = new Set<string>();

  for (const slot of MERCHANT_FILE_SLOTS) {
    const candidate = (merchantData as unknown as Record<string, unknown>)[slot];
    if (candidate && typeof candidate === 'object' && 'name' in candidate && 'mimeType' in candidate) {
      const ref = toDocRef(candidate as FileData, slot);
      if (!seen.has(ref.name)) {
        refs.push(ref);
        seen.add(ref.name);
      }
    }
  }

  for (const d of extra) {
    if (!d || typeof d !== 'object') continue;
    const ref = toDocRef(d);
    if (!seen.has(ref.name)) {
      refs.push(ref);
      seen.add(ref.name);
    }
  }

  const additional = Array.isArray(merchantData.additionalDocuments) ? merchantData.additionalDocuments : [];
  for (const d of additional) {
    if (!d || typeof d !== 'object') continue;
    const ref = toDocRef(d as FileData);
    if (!seen.has(ref.name)) {
      refs.push(ref);
      seen.add(ref.name);
    }
  }

  return refs;
}

export async function requestAiReview(
  merchantData: MerchantData,
  documents: FileData[]
): Promise<AiReviewResult> {
  const payload = {
    merchantData,
    aiContext: {
      verificationCheckpointPlacement: merchantData.verificationCheckpointPlacement,
      verificationTargetsJson: merchantData.verificationTargetsJson,
      personaInvitePlan: merchantData.personaInvitePlan,
      personaVerificationSummary: merchantData.personaVerificationSummary,
      websiteReviewSummary: merchantData.websiteReviewSummary,
      personaKybStatus: merchantData.personaKybStatus,
      personaKycStatuses: merchantData.personaKycStatuses,
      personaVerificationIssues: merchantData.personaVerificationIssues,
    },
    documents: collectAllDocuments(merchantData, documents),
  };

  const response = await fetch('/api/ai-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody?.error || `AI review failed (${response.status})`);
  }

  const raw = (await response.json()) as AiReviewResult & {
    evidenceCitations?: { claim: string; source: string }[];
  };
  return {
    ...raw,
    evidenceCitations: raw.evidenceCitations ?? [],
  };
}
