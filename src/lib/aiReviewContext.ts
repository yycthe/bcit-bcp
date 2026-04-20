import type { MerchantData } from '@/src/types';
import { getMerchantDocumentChecklist } from '@/src/lib/documentChecklist';
import { runLocalVerificationCheck } from '@/src/lib/localVerification';
import {
  buildPersonaSummary,
  buildWebsiteSignalSummary,
} from '@/src/lib/onboardingWorkflow';
import {
  ONBOARDING_POLICY_RULES,
  ONBOARDING_WORKFLOW_STEPS,
} from '@/src/lib/aiPolicyWorkflow';

const FILE_FIELDS = [
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

export type AiReviewContext = {
  generatedAt: string;
  purpose: string;
  nonDecisionNotice: string;
  workflowSteps: string[];
  policyRules: string[];
  processorRoutingGuide: string[];
  personaInvitePlan: string;
  kycKybReadiness: {
    status: 'clear' | 'needs_follow_up';
    summary: string;
    issues: Array<{
      id: string;
      reason: string;
      where: string;
    }>;
  };
  documentReviewContext: {
    expectedCount: number;
    presentCount: number;
    uploadedFileCount: number;
    checklist: Array<{
      key: string;
      label: string;
      present: boolean;
    }>;
    missingLabels: string[];
  };
  websiteSignalSummary: string;
};

function countUploadedFiles(finalData: MerchantData): number {
  const slotCount = FILE_FIELDS.filter((field) => finalData[field] != null && typeof finalData[field] === 'object').length;
  const additionalCount = Array.isArray(finalData.additionalDocuments)
    ? finalData.additionalDocuments.filter((doc) => doc && typeof doc === 'object').length
    : 0;
  return slotCount + additionalCount;
}

/**
 * Builds the non-decision packet sent to Gemini. It can include app-collected
 * readiness facts, but it never scores risk, recommends a processor, or decides
 * approval. Those outputs belong only to the AI review response.
 */
export function buildAiReviewContext(finalData: MerchantData): AiReviewContext {
  const checklist = getMerchantDocumentChecklist(finalData);
  const verification = runLocalVerificationCheck(finalData);
  const presentCount = checklist.filter((item) => item.present).length;
  const missingLabels = checklist.filter((item) => !item.present).map((item) => item.label);

  return {
    generatedAt: new Date().toISOString(),
    purpose:
      'Provide facts, policy constraints, document coverage, and KYC / KYB readiness signals for the AI underwriter.',
    nonDecisionNotice:
      'This packet is context only. It must not be treated as a risk score, processor recommendation, approval decision, or merchant-facing message.',
    workflowSteps: ONBOARDING_WORKFLOW_STEPS,
    policyRules: ONBOARDING_POLICY_RULES,
    processorRoutingGuide: [
      'Nuvei: standard Canadian merchants, clean KYC / KYB, low-to-mid risk.',
      'Payroc / Peoples: adverse history, higher risk, needs manual review or specialized underwriting.',
      'Chase: larger enterprise, card-not-present heavy, advance-payment, structured ownership, international.',
    ],
    personaInvitePlan: finalData.personaInvitePlan || buildPersonaSummary(finalData),
    kycKybReadiness: {
      status: verification.status,
      summary:
        verification.status === 'clear'
          ? `KYC / KYB readiness context is clear. ${verification.summary}`
          : `KYC / KYB readiness context needs follow-up. ${verification.summary}`,
      issues: verification.issues.map((issue) => ({
        id: issue.id,
        reason: issue.reason,
        where: issue.target.whereLabel,
      })),
    },
    documentReviewContext: {
      expectedCount: checklist.length,
      presentCount,
      uploadedFileCount: countUploadedFiles(finalData),
      checklist: checklist.map((item) => ({
        key: item.key,
        label: item.label,
        present: item.present,
      })),
      missingLabels,
    },
    websiteSignalSummary: finalData.websiteReviewSummary || buildWebsiteSignalSummary(finalData),
  };
}
