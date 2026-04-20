import type { MerchantData, FileData } from '@/src/types';
import type { UnderwritingDisplayResult } from '@/src/lib/underwritingFallback';

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
};

export type CombinedReview = {
  rule: UnderwritingDisplayResult;
  ai: AiReviewResult | null;
  aiError?: string;
};

type DocRef = { name: string; mimeType?: string; documentType?: string; url?: string };

function toDocRef(d: FileData, fallbackType?: string): DocRef {
  return {
    name: d.name,
    mimeType: d.mimeType,
    documentType: d.documentType || fallbackType,
    // `data` is a Vercel Blob HTTPS URL when uploaded via uploadFileToBlob.
    // Only forward the URL in that case — data: URLs would blow up the payload.
    url: typeof d.data === 'string' && /^https?:\/\//i.test(d.data) ? d.data : undefined,
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
  ruleResult: UnderwritingDisplayResult,
  documents: FileData[]
): Promise<AiReviewResult> {
  const payload = {
    merchantData,
    ruleResult: {
      riskScore: ruleResult.riskScore,
      riskCategory: ruleResult.riskCategory,
      riskFactors: ruleResult.riskFactors,
      recommendedProcessor: ruleResult.recommendedProcessor,
      missingItems: ruleResult.missingItems,
      reason: ruleResult.reason,
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

  return (await response.json()) as AiReviewResult;
}
