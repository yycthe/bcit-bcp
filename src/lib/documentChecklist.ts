import type { MerchantData } from '@/src/types';

/** File slots that the intake flow may require (mirrors ChatApp `buildQuestionSequence` document steps). */
export const MERCHANT_FILE_QUESTION_KEYS = [
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

export type MerchantDocumentKey = (typeof MERCHANT_FILE_QUESTION_KEYS)[number];

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
const DOC_KEYS = MERCHANT_FILE_QUESTION_KEYS;

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

/** Missing document keys in checklist order (same as expected-doc sequence). */
export function getMissingDocumentKeys(data: MerchantData): MerchantDocumentKey[] {
  return getMerchantDocumentChecklist(data).filter((i) => !i.present).map((i) => i.key);
}

/**
 * Next missing slot to visit after `currentKey`, following `tourOrder`, wrapping so earlier slots stay reachable.
 */
export function getNextMissingInTourOrder(
  tourOrder: MerchantDocumentKey[],
  currentKey: MerchantDocumentKey,
  data: MerchantData
): MerchantDocumentKey | null {
  const missing = new Set(getMissingDocumentKeys(data));
  if (missing.size === 0) return null;
  const curIdx = tourOrder.indexOf(currentKey);
  if (curIdx === -1) {
    for (const k of tourOrder) {
      if (missing.has(k)) return k;
    }
    return [...missing][0] ?? null;
  }
  for (let i = curIdx + 1; i < tourOrder.length; i++) {
    if (missing.has(tourOrder[i])) return tourOrder[i];
  }
  for (let i = 0; i < curIdx; i++) {
    if (missing.has(tourOrder[i])) return tourOrder[i];
  }
  return [...missing][0] ?? null;
}

export function buildDefaultDocumentReminder(data: MerchantData): string {
  const missing = getMissingDocumentLabels(data);
  if (missing.length === 0) return 'All required documents for your profile are on file. Thank you!';
  return `Please upload the following in the Merchant Portal (Intake → document steps or re-open Review): ${missing.join('; ')}.`;
}
