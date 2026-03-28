import type { MerchantData } from '@/src/types';

/** File slots that the intake flow may require (mirrors ChatApp `buildQuestionSequence` document steps). */
const DOC_KEYS = [
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

export type MerchantDocumentKey = (typeof DOC_KEYS)[number];

export const MERCHANT_DOCUMENT_LABELS: Record<MerchantDocumentKey, string> = {
  idUpload: 'Government-issued ID (owner)',
  proofOfAddress: 'Proof of address',
  registrationCertificate: 'Business registration / certificate',
  taxDocument: 'Tax document',
  proofOfFunds: 'Proof of funds',
  bankStatement: 'Bank statement',
  financials: 'Financial statements',
  complianceDocument: 'Compliance document',
  enhancedVerification: 'Enhanced verification / secondary ID',
};

/**
 * Which document fields apply to this merchant profile (same branching as intake).
 */
export function getExpectedMerchantDocumentKeys(data: MerchantData): MerchantDocumentKey[] {
  const isHighRisk = ['high_risk', 'crypto', 'gaming'].includes(data.industry);
  const isCrypto = data.industry === 'crypto';
  const isGaming = data.industry === 'gaming';
  const isInternational = data.country !== 'CA' && data.country !== 'US' && data.country !== '';
  const isHighVolume = data.monthlyVolume === '>250k' || data.monthlyVolume === '50k-250k';

  const keys: MerchantDocumentKey[] = ['idUpload', 'registrationCertificate'];

  if (isInternational || isHighRisk) keys.push('proofOfAddress');
  if (isHighVolume || isHighRisk) keys.push('bankStatement', 'financials');
  if (isHighRisk) keys.push('complianceDocument', 'proofOfFunds');
  if (isInternational) keys.push('enhancedVerification');

  return keys;
}

export type DocumentChecklistItem = {
  key: MerchantDocumentKey;
  label: string;
  present: boolean;
};

export function getMerchantDocumentChecklist(data: MerchantData): DocumentChecklistItem[] {
  const expected = getExpectedMerchantDocumentKeys(data);
  return expected.map((key) => ({
    key,
    label: MERCHANT_DOCUMENT_LABELS[key],
    present: data[key] != null && typeof data[key] === 'object',
  }));
}

export function getMissingDocumentLabels(data: MerchantData): string[] {
  return getMerchantDocumentChecklist(data).filter((i) => !i.present).map((i) => i.label);
}

export function buildDefaultDocumentReminder(data: MerchantData): string {
  const missing = getMissingDocumentLabels(data);
  if (missing.length === 0) return 'All required documents for your profile are on file. Thank you!';
  return `Please upload the following in the Merchant Portal (Intake → document steps or re-open Review): ${missing.join('; ')}.`;
}
