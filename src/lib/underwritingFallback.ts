import type { MerchantData } from '@/src/types';
import { getMerchantDocumentChecklist, getMissingDocumentLabels } from '@/src/lib/documentChecklist';
import { runLocalVerificationCheck } from '@/src/lib/localVerification';

export type UnderwritingDisplayResult = {
  riskScore: number;
  riskCategory: 'Low' | 'Medium' | 'High';
  riskFactors: string[];
  recommendedProcessor: string;
  reason: string;
  documentSummary: string;
  verificationStatus: 'Verified' | 'Discrepancies Found' | 'Unverified';
  verificationNotes: string[];
};

const DOMESTIC_COUNTRIES = new Set(['US', 'CA']);
const HIGH_RISK_INDUSTRIES = new Set(['high_risk', 'crypto', 'gaming']);
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
const CONCERN_KEYWORDS = ['chargeback', 'fraud', 'reserve', 'terminated', 'mismatch', 'decline', 'high', 'review'];

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pushUnique(items: string[], value: string) {
  if (!items.includes(value)) {
    items.push(value);
  }
}

function containsConcern(text: string): boolean {
  const lower = text.toLowerCase();
  return CONCERN_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function countUploadedFiles(finalData: MerchantData): number {
  const slotCount = FILE_FIELDS.filter((field) => finalData[field] != null && typeof finalData[field] === 'object').length;
  const additionalCount = Array.isArray(finalData.additionalDocuments)
    ? finalData.additionalDocuments.filter((doc) => doc && typeof doc === 'object').length
    : 0;
  return slotCount + additionalCount;
}

/** Rule-based fallback when the server-side AI underwriting call fails or is unavailable. */
export function getFallbackUnderwriting(finalData: MerchantData): UnderwritingDisplayResult {
  const checklist = getMerchantDocumentChecklist(finalData);
  const missingDocuments = getMissingDocumentLabels(finalData);
  const verification = runLocalVerificationCheck(finalData);
  const uploadedFiles = countUploadedFiles(finalData);
  const billingModel = normalizeText(finalData.billingModel);
  const domesticVsInternational = normalizeText(finalData.domesticVsInternational);
  const domesticCrossBorderSplit = normalizeText(finalData.domesticCrossBorderSplit);
  const processingCurrencies = normalizeText(finalData.processingCurrencies);
  const chargebackHistory = normalizeText(finalData.chargebackHistory);
  const previousProcessors = normalizeText(finalData.previousProcessors);
  const criticalMissingCount = verification.issues.filter((issue) => issue.target.kind === 'intake').length;
  const isHighRiskIndustry = HIGH_RISK_INDUSTRIES.has(finalData.industry);
  const isInternational = hasText(finalData.country) && !DOMESTIC_COUNTRIES.has(finalData.country);
  const isHighVolume = finalData.monthlyVolume === '50k-250k' || finalData.monthlyVolume === '>250k';
  const isVeryHighVolume = finalData.monthlyVolume === '>250k';
  const hasRecurringExposure =
    hasText(finalData.recurringBillingDetails) ||
    hasText(finalData.trialPeriod) ||
    billingModel.toLowerCase().includes('subscription') ||
    billingModel.toLowerCase().includes('recurring');
  const hasCrossBorderExposure =
    isInternational ||
    domesticVsInternational.toLowerCase().includes('international') ||
    domesticCrossBorderSplit.toLowerCase().includes('cross') ||
    (processingCurrencies.length > 0 && processingCurrencies.includes(','));
  const disclosedChargebackRisk = chargebackHistory.length > 0;
  const disclosedProcessorIssues = previousProcessors.length > 0;
  const hasMitigatingCompliance =
    hasText(finalData.complianceDetails) ||
    hasText(finalData.regulatoryStatus) ||
    hasText(finalData.amlKycProcedures) ||
    hasText(finalData.cryptoLicenses) ||
    hasText(finalData.gamingLicenses);

  let riskScore = 18;
  const riskFactors: string[] = [];

  if (isHighRiskIndustry) {
    riskScore += 34;
    pushUnique(riskFactors, 'High-risk industry classification');
  }
  if (isInternational) {
    riskScore += 12;
    pushUnique(riskFactors, 'Merchant operates outside the core US/CA footprint');
  }
  if (isVeryHighVolume) {
    riskScore += 18;
    pushUnique(riskFactors, 'Very high monthly processing volume');
  } else if (isHighVolume) {
    riskScore += 10;
    pushUnique(riskFactors, 'Elevated monthly processing volume');
  }
  if (finalData.monthlyTransactions === '>10k') {
    riskScore += 10;
    pushUnique(riskFactors, 'Very high transaction count');
  } else if (finalData.monthlyTransactions === '1k-10k') {
    riskScore += 6;
    pushUnique(riskFactors, 'Higher transaction count');
  }
  if (hasRecurringExposure) {
    riskScore += 8;
    pushUnique(riskFactors, 'Recurring billing or trial exposure');
  }
  if (hasCrossBorderExposure) {
    riskScore += 8;
    pushUnique(riskFactors, 'Cross-border or multi-currency processing exposure');
  }
  if (disclosedChargebackRisk) {
    riskScore += containsConcern(chargebackHistory) ? 12 : 5;
    pushUnique(riskFactors, 'Chargeback history requires closer review');
  }
  if (disclosedProcessorIssues) {
    riskScore += containsConcern(previousProcessors) ? 10 : 4;
    pushUnique(riskFactors, 'Previous processor history may indicate onboarding friction');
  }
  if (criticalMissingCount > 0) {
    riskScore += Math.min(criticalMissingCount * 4, 20);
    pushUnique(riskFactors, 'Critical intake answers are incomplete');
  }
  if (missingDocuments.length > 0) {
    riskScore += Math.min(missingDocuments.length * 5, 25);
    pushUnique(riskFactors, 'Required supporting documents are still missing');
  }
  if (hasMitigatingCompliance && (isHighRiskIndustry || hasCrossBorderExposure)) {
    riskScore -= 6;
  }
  if (!isHighRiskIndustry && !isInternational && missingDocuments.length === 0 && verification.issues.length === 0) {
    riskScore -= 5;
  }

  riskScore = clamp(Math.round(riskScore), 8, 95);

  const riskCategory: 'Low' | 'Medium' | 'High' =
    riskScore <= 33 ? 'Low' : riskScore <= 66 ? 'Medium' : 'High';

  const recommendedProcessor =
    riskScore >= 75 || isHighRiskIndustry
      ? 'HighRiskPay'
      : riskScore >= 55 || isVeryHighVolume || hasCrossBorderExposure
        ? 'Adyen'
        : riskScore <= 33 && !isInternational
          ? 'Stripe'
          : 'Nuvei';

  const topFactors = riskFactors.slice(0, 4);
  const reasonParts = [
    `Local fallback scored this merchant at ${riskScore}/100 using intake answers, document coverage, and KYC / KYB review issues.`,
  ];
  if (topFactors.length > 0) {
    reasonParts.push(`Key drivers: ${topFactors.join('; ')}.`);
  }
  if (missingDocuments.length > 0) {
    reasonParts.push(`Missing required uploads: ${missingDocuments.join(', ')}.`);
  }
  if (hasMitigatingCompliance && (isHighRiskIndustry || hasCrossBorderExposure)) {
    reasonParts.push('Compliance and regulatory details were provided and slightly reduced the fallback score.');
  }
  const reason = reasonParts.join(' ');

  const expectedDocs = checklist.length;
  const presentDocs = checklist.filter((item) => item.present).length;
  const documentSummary =
    uploadedFiles === 0
      ? 'No supporting documents were uploaded, so the fallback review relied on intake answers only.'
      : missingDocuments.length > 0
        ? `Fallback review found ${uploadedFiles} uploaded file(s). Required checklist coverage is ${presentDocs}/${expectedDocs}; still missing: ${missingDocuments.join(', ')}.`
        : `Fallback review found ${uploadedFiles} uploaded file(s), and all ${expectedDocs} expected checklist item(s) are currently on file.`;

  const verificationStatus: 'Verified' | 'Discrepancies Found' | 'Unverified' =
    uploadedFiles === 0
      ? 'Unverified'
      : verification.issues.length === 0 && missingDocuments.length === 0
        ? 'Verified'
        : 'Discrepancies Found';

  const verificationNotes =
    verificationStatus === 'Verified'
      ? ['Local KYC / KYB checks passed and all expected supporting uploads were present.']
      : [
          ...verification.issues.slice(0, 5).map((issue) => issue.reason),
          ...(missingDocuments.length > 0 ? [`Missing required uploads: ${missingDocuments.join(', ')}.`] : []),
          ...(uploadedFiles === 0 ? ['No uploaded files were available for the local audit.'] : []),
        ];

  return {
    riskScore,
    riskCategory,
    riskFactors: riskFactors.length > 0 ? riskFactors.slice(0, 5) : ['Standard processing profile'],
    recommendedProcessor,
    reason,
    documentSummary,
    verificationStatus,
    verificationNotes,
  };
}
