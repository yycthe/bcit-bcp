import type { MerchantData, FileData } from '@/src/types';
import type { UnderwritingDisplayResult } from '@/src/lib/underwritingFallback';

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

function toDocRefs(documents: FileData[]): Array<{ name: string; mimeType?: string; documentType?: string }> {
  return documents
    .filter((d) => d && typeof d === 'object')
    .map((d) => ({
      name: d.name,
      mimeType: d.mimeType,
      documentType: d.documentType,
    }));
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
    documents: toDocRefs(documents),
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
