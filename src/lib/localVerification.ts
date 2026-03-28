import type { MerchantData } from '@/src/types';
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

  if (!hasText(merchantData.legalName) || !hasText(merchantData.website)) {
    pushUnique(issues, {
      id: 'business-basics',
      reason: 'Business legal name and website should both be on file before final review.',
      target: {
        kind: 'intake',
        questionId: 'companyDetailsForm',
        whereLabel: 'Intake Assistant → Business profile → Company details',
      },
    });
  }

  if (!hasText(merchantData.ownerName) || !hasText(merchantData.ownerEmail)) {
    pushUnique(issues, {
      id: 'owner-details',
      reason: 'Primary owner identity details are incomplete.',
      target: {
        kind: 'intake',
        questionId: 'ownerDetailsForm',
        whereLabel: 'Intake Assistant → Business profile → Owner details',
      },
    });
  }

  if (!hasText(merchantData.bankName) || !hasText(merchantData.settlementCurrency)) {
    pushUnique(issues, {
      id: 'banking-details',
      reason: 'Settlement banking details are incomplete.',
      target: {
        kind: 'intake',
        questionId: 'bankAccountForm',
        whereLabel: 'Intake Assistant → Business profile → Bank account',
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
        ? 'Submission check passed. No follow-up items were found.'
        : `Submission check found ${issues.length} follow-up item${issues.length === 1 ? '' : 's'}.`,
    checkedAt,
  };
}
