import type { MerchantData } from '@/src/types';
import { decidePersonaInvites } from '@/src/lib/onboardingWorkflow';
import {
  MERCHANT_DOCUMENT_LABELS,
  getExpectedMerchantDocumentKeys,
  type MerchantDocumentKey,
} from '@/src/lib/documentChecklist';

export type VerificationTarget =
  | { kind: 'document'; documentKey: MerchantDocumentKey; whereLabel: string }
  | { kind: 'intake'; questionId: string; whereLabel: string };

export type VerificationIssue = {
  id: string;
  reason: string;
  target: VerificationTarget;
};

export type VerificationCheckResult = {
  status: 'clear' | 'needs_follow_up';
  issues: VerificationIssue[];
  summary: string;
  checkedAt: string;
};

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasFile(data: MerchantData, key: MerchantDocumentKey): boolean {
  const value = data[key];
  return value != null && typeof value === 'object';
}

function documentWhereLabel(key: MerchantDocumentKey): string {
  return `Intake Assistant → Documents → ${MERCHANT_DOCUMENT_LABELS[key]}`;
}

function pushUnique(issues: VerificationIssue[], issue: VerificationIssue) {
  if (!issues.some((item) => item.id === issue.id)) {
    issues.push(issue);
  }
}

export function runLocalVerificationCheck(merchantData: MerchantData): VerificationCheckResult {
  const issues: VerificationIssue[] = [];
  const checkedAt = new Date().toISOString();
  const isHighRisk = ['high_risk', 'crypto', 'gaming'].includes(merchantData.industry);
  const isInternational = merchantData.country !== 'CA' && merchantData.country !== 'US' && merchantData.country !== '';
  const isHighVolume = merchantData.monthlyVolume === '>250k' || merchantData.monthlyVolume === '50k-250k';
  const personaDecision = decidePersonaInvites(merchantData);

  if (!hasText(merchantData.legalName) || !hasText(merchantData.website) || !hasText(merchantData.legalBusinessEmail)) {
    pushUnique(issues, {
      id: 'business-basics',
      reason: 'Business legal name, legal email, and website should be on file before final review.',
      target: {
        kind: 'intake',
        questionId: 'legalBusinessForm',
        whereLabel: 'Intake Assistant → Common intake → Legal business information',
      },
    });
  }

  if (!hasText(merchantData.beneficialOwners) && (!hasText(merchantData.ownerName) || !hasText(merchantData.ownerEmail))) {
    pushUnique(issues, {
      id: 'owner-details',
      reason: 'Beneficial owner details are incomplete, so KYC invite targeting may be wrong.',
      target: {
        kind: 'intake',
        questionId: 'ownershipControlForm',
        whereLabel: 'Intake Assistant → Common intake → Ownership and control',
      },
    });
  }

  if (!hasText(merchantData.authorizedSignerName) || !hasText(merchantData.authorizedSignerEmail)) {
    pushUnique(issues, {
      id: 'authorized-signer',
      reason: 'Authorized signer details are incomplete, so signer KYC cannot be routed cleanly.',
      target: {
        kind: 'intake',
        questionId: 'ownershipControlForm',
        whereLabel: 'Intake Assistant → Common intake → Ownership and control',
      },
    });
  }

  if (personaDecision.action === 'none') {
    pushUnique(issues, {
      id: 'persona-routing',
      reason: 'KYC / KYB invite routing is not ready because entity, owner, or signer information is incomplete.',
      target: {
        kind: 'intake',
        questionId: 'ownershipControlForm',
        whereLabel: 'Intake Assistant → KYC / KYB routing',
      },
    });
  }

  if (
    !hasText(merchantData.websitePrivacyPolicy) ||
    !hasText(merchantData.websiteTerms) ||
    !hasText(merchantData.websiteRefundPolicy) ||
    !hasText(merchantData.websiteShippingPolicy) ||
    !hasText(merchantData.websiteCurrencyDisplay)
  ) {
    pushUnique(issues, {
      id: 'website-compliance',
      reason: 'Website compliance basics are incomplete: privacy policy, terms, refund policy, shipping policy, and currency display should be confirmed where applicable.',
      target: {
        kind: 'intake',
        questionId: 'websiteComplianceForm',
        whereLabel: 'Intake Assistant → Common intake → Website / PCI basics',
      },
    });
  }

  if (!hasText(merchantData.canProvideRegistration) || !hasText(merchantData.canProvideBankStatements) || !hasText(merchantData.canProvideOwnerIds)) {
    pushUnique(issues, {
      id: 'document-readiness',
      reason: 'Common document readiness is incomplete for registration, bank statements, or owner photo ID.',
      target: {
        kind: 'intake',
        questionId: 'documentReadinessForm',
        whereLabel: 'Intake Assistant → Common intake → Document readiness',
      },
    });
  }

  if (isHighRisk && !hasText(merchantData.complianceDetails) && !hasText(merchantData.regulatoryStatus)) {
    pushUnique(issues, {
      id: 'compliance-context',
      reason: 'High-risk businesses should include compliance or licensing context before approval.',
      target: {
        kind: 'intake',
        questionId: merchantData.industry === 'high_risk' ? 'highRiskForm' : 'complianceDetails',
        whereLabel: 'Intake Assistant → Business profile → Compliance details',
      },
    });
  }

  if (merchantData.industry === 'crypto' && !hasText(merchantData.amlKycProcedures)) {
    pushUnique(issues, {
      id: 'crypto-controls',
      reason: 'Crypto submissions should describe AML / KYC procedures.',
      target: {
        kind: 'intake',
        questionId: 'cryptoForm',
        whereLabel: 'Intake Assistant → Business profile → Crypto details',
      },
    });
  }

  for (const key of getExpectedMerchantDocumentKeys(merchantData)) {
    if (hasFile(merchantData, key)) continue;
    pushUnique(issues, {
      id: `document-${key}`,
      reason: `${MERCHANT_DOCUMENT_LABELS[key]} is still missing for this merchant profile.`,
      target: {
        kind: 'document',
        documentKey: key,
        whereLabel: documentWhereLabel(key),
      },
    });
  }

  if (isHighVolume && !hasText(merchantData.avgTicketSize)) {
    pushUnique(issues, {
      id: 'high-volume-ticket-size',
      reason: 'Higher-volume submissions should include an average ticket size.',
      target: {
        kind: 'intake',
        questionId: 'businessOperationsForm',
        whereLabel: 'Intake Assistant → Business profile → Business operations',
      },
    });
  }

  if ((isInternational || isHighRisk) && !hasText(merchantData.targetGeography)) {
    pushUnique(issues, {
      id: 'target-geography',
      reason: 'International or higher-risk merchants should specify target geography.',
      target: {
        kind: 'intake',
        questionId: 'businessOperationsForm',
        whereLabel: 'Intake Assistant → Business profile → Business operations',
      },
    });
  }

  return {
    status: issues.length === 0 ? 'clear' : 'needs_follow_up',
    issues,
    summary:
      issues.length === 0
        ? 'KYC / KYB review passed. No follow-up items were found.'
        : `KYC / KYB review found ${issues.length} follow-up item${issues.length === 1 ? '' : 's'}.`,
    checkedAt,
  };
}
