import type { MerchantData } from '@/src/types';
import { getMerchantDocumentChecklist, getMissingDocumentLabels } from '@/src/lib/documentChecklist';
import { runLocalVerificationCheck } from '@/src/lib/localVerification';
import { buildWebsiteSignalSummary, decidePersonaInvites } from '@/src/lib/onboardingWorkflow';

export type UnderwritingDisplayResult = {
  riskScore: number;
  riskCategory: 'Low' | 'Medium' | 'High';
  riskFactors: string[];
  recommendedProcessor: string;
  reason: string;
  merchantSummary: string;
  missingItems: string[];
  readinessDecision: string;
  processorFitSuggestion: string;
  websiteReviewSummary: string;
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

/** Rule-based review engine: scores risk, recommends processor, and audits documents. */
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
  const priorTermination = normalizeText(finalData.priorTermination);
  const bankruptcyHistory = normalizeText(finalData.bankruptcyHistory);
  const riskProgramHistory = normalizeText(finalData.riskProgramHistory);
  const advancePayment = normalizeText(finalData.advancePayment);
  const advancePaymentPercent = normalizeText(finalData.advancePaymentPercent);
  const transactionChannelSplit = normalizeText(finalData.transactionChannelSplit);
  const foreignCardsPercent = normalizeText(finalData.foreignCardsPercent);
  const personaDecision = decidePersonaInvites(finalData);
  const criticalMissingCount = verification.issues.filter((issue) => issue.target.kind === 'intake').length;
  const isHighRiskIndustry = HIGH_RISK_INDUSTRIES.has(finalData.industry);
  const isInternational = hasText(finalData.country) && !DOMESTIC_COUNTRIES.has(finalData.country);
  const isHighVolume = finalData.monthlyVolume === '50k-250k' || finalData.monthlyVolume === '>250k';
  const isVeryHighVolume = finalData.monthlyVolume === '>250k';
  const hasRecurringExposure =
    hasText(finalData.recurringBillingDetails) ||
    hasText(finalData.recurringBilling) ||
    hasText(finalData.recurringSalesPercent) ||
    hasText(finalData.trialPeriod) ||
    billingModel.toLowerCase().includes('subscription') ||
    billingModel.toLowerCase().includes('recurring');
  const hasCrossBorderExposure =
    isInternational ||
    domesticVsInternational.toLowerCase().includes('international') ||
    domesticCrossBorderSplit.toLowerCase().includes('cross') ||
    foreignCardsPercent.length > 0 ||
    (processingCurrencies.length > 0 && processingCurrencies.includes(','));
  const hasAdvancePaymentExposure = advancePayment.length > 0 || advancePaymentPercent.length > 0;
  const hasCardNotPresentExposure =
    transactionChannelSplit.toLowerCase().includes('e-commerce') ||
    transactionChannelSplit.toLowerCase().includes('moto') ||
    transactionChannelSplit.toLowerCase().includes('keyed');
  const hasAdverseHistory =
    [priorTermination, bankruptcyHistory, riskProgramHistory].some((item) => item.length > 0 && !/^no\b/i.test(item));
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
  if (hasAdvancePaymentExposure) {
    riskScore += 8;
    pushUnique(riskFactors, 'Advance-payment or delayed-fulfillment exposure');
  }
  if (hasCardNotPresentExposure) {
    riskScore += 6;
    pushUnique(riskFactors, 'Card-not-present sales mix');
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
  if (hasAdverseHistory) {
    riskScore += 14;
    pushUnique(riskFactors, 'Prior termination, bankruptcy, or card-brand risk-program answer requires review');
  }
  if (personaDecision.action === 'none') {
    riskScore += 8;
    pushUnique(riskFactors, 'KYC / KYB invite routing is incomplete');
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
    riskScore >= 72 || hasAdverseHistory || isHighRiskIndustry
      ? 'Payroc / Peoples'
      : isVeryHighVolume || hasAdvancePaymentExposure || hasCardNotPresentExposure || hasCrossBorderExposure
        ? 'Chase'
        : 'Nuvei';

  const topFactors = riskFactors.slice(0, 4);
  const reasonParts = [
    `Rule-based engine scored this merchant at ${riskScore}/100 using intake answers, document coverage, and KYC / KYB review issues.`,
    `KYC / KYB routing: ${personaDecision.action.replace('_', ' ')}.`,
  ];
  if (topFactors.length > 0) {
    reasonParts.push(`Key drivers: ${topFactors.join('; ')}.`);
  }
  if (missingDocuments.length > 0) {
    reasonParts.push(`Missing required uploads: ${missingDocuments.join(', ')}.`);
  }
  if (hasMitigatingCompliance && (isHighRiskIndustry || hasCrossBorderExposure)) {
    reasonParts.push('Compliance and regulatory details were provided and slightly reduced the risk score.');
  }
  const reason = reasonParts.join(' ');
  const missingItems = [
    ...verification.issues.map((issue) => issue.reason),
    ...missingDocuments.map((label) => `Missing required upload: ${label}`),
  ];
  const readinessDecision =
    verification.status === 'clear' && missingDocuments.length === 0
      ? 'Ready for matching'
      : hasAdverseHistory || isHighRiskIndustry
        ? 'Hold for manual review'
        : 'Missing items needed';
  const merchantSummary = [
    `Legal entity: ${finalData.legalName || 'not supplied'}`,
    `Business model: ${finalData.productsServices || finalData.businessDescription || finalData.businessCategory || 'not supplied'}`,
    `Ownership / signer: ${finalData.beneficialOwners || finalData.ownerName || 'not supplied'}; signer ${finalData.authorizedSignerName || 'not supplied'}`,
    `Processing history: ${finalData.currentOrPreviousProcessor || finalData.previousProcessors || 'not supplied'}`,
    `Sales profile: ${finalData.monthlyVolume || 'unknown'} monthly volume, ${finalData.avgTicketSize || 'unknown'} average ticket, ${finalData.transactionChannelSplit || 'channel split not supplied'}`,
    `KYC / KYB status: ${finalData.personaVerificationSummary || 'not attached'}`,
  ].join('\n');
  const processorFitSuggestion = [
    `Nuvei: good fit for standard Canadian merchant setup when KYC/KYB and documents are clean.`,
    `Payroc / Peoples: stronger fit when risk, adverse history, or manual review follow-up is present.`,
    `Chase: stronger fit for larger, card-not-present, advance-payment, or structured ownership cases.`,
    `Selected recommendation: ${recommendedProcessor}.`,
  ].join('\n');
  const websiteReviewSummary = buildWebsiteSignalSummary(finalData);

  const expectedDocs = checklist.length;
  const presentDocs = checklist.filter((item) => item.present).length;
  const documentSummary =
    uploadedFiles === 0
      ? 'No supporting documents were uploaded, so the review relied on intake answers only.'
      : missingDocuments.length > 0
        ? `Review found ${uploadedFiles} uploaded file(s). Required checklist coverage is ${presentDocs}/${expectedDocs}; still missing: ${missingDocuments.join(', ')}.`
        : `Review found ${uploadedFiles} uploaded file(s), and all ${expectedDocs} expected checklist item(s) are currently on file.`;

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
          `Website signals captured from common intake: ${buildWebsiteSignalSummary(finalData).replace(/\n/g, '; ')}`,
        ];

  return {
    riskScore,
    riskCategory,
    riskFactors: riskFactors.length > 0 ? riskFactors.slice(0, 5) : ['Standard processing profile'],
    recommendedProcessor,
    reason,
    merchantSummary,
    missingItems,
    readinessDecision,
    processorFitSuggestion,
    websiteReviewSummary,
    documentSummary,
    verificationStatus,
    verificationNotes,
  };
}
