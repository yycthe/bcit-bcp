export const runtime = 'nodejs';

type VerificationStatus = 'Verified' | 'Discrepancies Found' | 'Unverified';
type RiskCategory = 'Low' | 'Medium' | 'High';
type Processor = 'Stripe' | 'Adyen' | 'Nuvei' | 'HighRiskPay';

type UnderwritingApiResult = {
  riskScore: number;
  riskCategory: RiskCategory;
  riskFactors: string[];
  recommendedProcessor: Processor;
  reason: string;
  documentSummary: string;
  verificationStatus: VerificationStatus;
  verificationNotes: string[];
};

type MerchantFile = {
  name?: string;
  mimeType?: string;
  data?: string;
  uploadDate?: string;
  documentType?: string;
  status?: string;
  extractedFields?: Record<string, string>;
  confidence?: number;
  linkedRequirement?: string;
};

type MerchantDataLike = Record<string, unknown> & {
  additionalDocuments?: MerchantFile[];
};

type UploadedFileDescriptor = {
  field: string;
  name: string;
  mimeType: string;
  data?: string;
  uploadDate?: string;
  documentType?: string;
  status?: string;
  extractedFields: Record<string, string>;
  confidence?: number;
  linkedRequirement?: string;
};

type ScalarValue = string | number | boolean;

type IntakeSectionDefinition = {
  title: string;
  fields: string[];
};

type XaiResponseTextPart = {
  type?: string;
  text?: string;
};

type XaiResponseOutputItem = {
  content?: XaiResponseTextPart[];
};

type XaiResponsesCreateResponse = {
  output?: XaiResponseOutputItem[];
};

const XAI_BASE_URL = 'https://api.x.ai/v1';
const DEFAULT_XAI_MODEL = 'grok-4-1-fast-non-reasoning';
const ALLOWED_PROCESSORS: Processor[] = ['Stripe', 'Adyen', 'Nuvei', 'HighRiskPay'];
const XAI_UPLOAD_TIMEOUT_MS = 15_000;
const XAI_RESPONSE_TIMEOUT_MS = 35_000;
const MAX_BINARY_ATTACHMENTS = 2;
const MAX_BINARY_TOTAL_BYTES = 6_000_000;
const MAX_INLINE_IMAGE_BYTES = 4_000_000;
const FILE_KEYS = [
  'financials',
  'idUpload',
  'enhancedVerification',
  'proofOfAddress',
  'registrationCertificate',
  'taxDocument',
  'proofOfFunds',
  'bankStatement',
  'complianceDocument',
] as const;
const DOMESTIC_COUNTRIES = new Set(['US', 'CA']);
const HIGH_RISK_INDUSTRIES = new Set(['high_risk', 'crypto', 'gaming']);
const SENSITIVE_FIELD_KEYS = new Set(['taxId', 'ownerIdNumber', 'accountNumber', 'routingNumber']);
const CRITICAL_INTAKE_FIELDS = [
  'businessType',
  'country',
  'industry',
  'monthlyVolume',
  'monthlyTransactions',
  'legalName',
  'website',
  'ownerName',
  'ownerEmail',
  'targetGeography',
  'avgTicketSize',
  'bankName',
  'settlementCurrency',
] as const;
const UPLOAD_FIELD_LABELS: Record<string, string> = {
  financials: 'Financial statements',
  idUpload: 'Government ID',
  enhancedVerification: 'Enhanced verification',
  proofOfAddress: 'Proof of address',
  registrationCertificate: 'Registration certificate',
  taxDocument: 'Tax document',
  proofOfFunds: 'Proof of funds',
  bankStatement: 'Bank statement',
  complianceDocument: 'Compliance document',
};
const FIELD_LABELS: Record<string, string> = {
  businessType: 'Business type',
  country: 'Country / registration jurisdiction',
  industry: 'Industry',
  monthlyVolume: 'Monthly processing volume',
  monthlyTransactions: 'Monthly transactions',
  legalName: 'Legal business name',
  taxId: 'Tax ID / EIN',
  website: 'Website',
  staffSize: 'Staff size',
  paymentProducts: 'Payment products',
  businessCategory: 'Business subcategory',
  generalEmail: 'General email',
  supportEmail: 'Support email',
  disputesEmail: 'Disputes email',
  phone: 'Phone',
  preferredContact: 'Preferred contact method',
  socialPresence: 'Social presence',
  registeredAddress: 'Registered address',
  operatingAddress: 'Operating address',
  city: 'City',
  region: 'Region',
  province: 'Province / state',
  operatingDiffers: 'Operating address differs',
  timeInBusiness: 'Time in business',
  targetGeography: 'Target geography',
  deliveryMethod: 'Delivery method',
  domesticVsInternational: 'Domestic vs international mix',
  avgTxnCount: 'Average monthly transactions',
  minTxnCount: 'Minimum transaction amount',
  maxTxnCount: 'Maximum transaction amount',
  avgTicketSize: 'Average ticket size',
  domesticCrossBorderSplit: 'Domestic vs cross-border split',
  processingCurrencies: 'Processing currencies',
  recurringBillingDetails: 'Recurring billing details',
  refundPolicy: 'Refund policy',
  shippingPolicy: 'Shipping policy',
  trialPeriod: 'Trial period',
  churnRate: 'Churn rate',
  avgDeliveryTime: 'Average delivery time',
  cryptoServices: 'Crypto services',
  amlKycProcedures: 'AML / KYC procedures',
  cryptoLicenses: 'Crypto licenses',
  custodyArrangement: 'Custody arrangement',
  gamingType: 'Gaming type',
  gamingLicenses: 'Gaming licenses',
  responsibleGaming: 'Responsible gaming controls',
  ageVerification: 'Age verification',
  serviceType: 'Service type',
  billingModel: 'Billing model',
  contractLength: 'Contract length',
  businessDescription: 'Business description',
  regulatoryStatus: 'Regulatory status',
  chargebackHistory: 'Chargeback history',
  previousProcessors: 'Previous processors',
  ownershipPercentage: 'Ownership percentage',
  ownerName: 'Owner name',
  ownerRole: 'Owner role',
  ownerEmail: 'Owner email',
  ownerIdNumber: 'Owner ID number',
  ownerIdExpiry: 'Owner ID expiry',
  ownerCountryOfResidence: 'Owner country of residence',
  bankName: 'Bank name',
  accountHolderName: 'Account holder name',
  accountNumber: 'Account number / IBAN',
  routingNumber: 'Routing number / branch code',
  settlementCurrency: 'Settlement currency',
  complianceDetails: 'Compliance details',
};
const INTAKE_SECTIONS: IntakeSectionDefinition[] = [
  {
    title: 'Qualification snapshot',
    fields: ['businessType', 'country', 'industry', 'monthlyVolume', 'monthlyTransactions'],
  },
  {
    title: 'Business details',
    fields: ['legalName', 'taxId', 'website', 'timeInBusiness', 'staffSize', 'businessCategory'],
  },
  {
    title: 'Contact and presence',
    fields: ['generalEmail', 'supportEmail', 'disputesEmail', 'phone', 'preferredContact', 'socialPresence'],
  },
  {
    title: 'Registered and operating footprint',
    fields: ['registeredAddress', 'operatingAddress', 'city', 'region', 'province', 'operatingDiffers'],
  },
  {
    title: 'Business operations',
    fields: ['targetGeography', 'deliveryMethod', 'domesticVsInternational', 'paymentProducts', 'processingCurrencies'],
  },
  {
    title: 'Transaction profile',
    fields: [
      'avgTxnCount',
      'minTxnCount',
      'maxTxnCount',
      'avgTicketSize',
      'domesticCrossBorderSplit',
      'recurringBillingDetails',
      'trialPeriod',
      'churnRate',
      'refundPolicy',
      'shippingPolicy',
    ],
  },
  {
    title: 'Ownership and settlement',
    fields: [
      'ownerName',
      'ownerEmail',
      'ownerRole',
      'ownershipPercentage',
      'ownerIdNumber',
      'ownerIdExpiry',
      'ownerCountryOfResidence',
      'bankName',
      'accountHolderName',
      'accountNumber',
      'routingNumber',
      'settlementCurrency',
    ],
  },
  {
    title: 'Industry-specific risk context',
    fields: [
      'serviceType',
      'billingModel',
      'contractLength',
      'avgDeliveryTime',
      'cryptoServices',
      'amlKycProcedures',
      'cryptoLicenses',
      'custodyArrangement',
      'gamingType',
      'gamingLicenses',
      'responsibleGaming',
      'ageVerification',
      'businessDescription',
      'regulatoryStatus',
      'chargebackHistory',
      'previousProcessors',
      'complianceDetails',
    ],
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function normalizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeStringRecord(value: unknown): Record<string, string> {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => typeof entryValue === 'string' && entryValue.trim().length > 0)
      .map(([entryKey, entryValue]) => [entryKey, entryValue.trim()])
  );
}

function normalizeRiskScore(value: unknown): number {
  const score = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(score)) return 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeRiskCategory(value: unknown, riskScore: number): RiskCategory {
  if (value === 'Low' || value === 'Medium' || value === 'High') return value;
  if (riskScore <= 33) return 'Low';
  if (riskScore <= 66) return 'Medium';
  return 'High';
}

function normalizeProcessor(value: unknown): Processor {
  if (typeof value === 'string' && ALLOWED_PROCESSORS.includes(value as Processor)) {
    return value as Processor;
  }
  return 'Nuvei';
}

function normalizeVerificationStatus(value: unknown): VerificationStatus {
  if (value === 'Verified' || value === 'Discrepancies Found' || value === 'Unverified') {
    return value;
  }
  return 'Unverified';
}

function parseUnderwritingResult(raw: unknown): UnderwritingApiResult {
  const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const riskScore = normalizeRiskScore(data.riskScore);
  return {
    riskScore,
    riskCategory: normalizeRiskCategory(data.riskCategory, riskScore),
    riskFactors: normalizeStringArray(data.riskFactors),
    recommendedProcessor: normalizeProcessor(data.recommendedProcessor),
    reason: normalizeString(data.reason, 'No reason provided by the model.'),
    documentSummary: normalizeString(data.documentSummary, 'No document information extracted.'),
    verificationStatus: normalizeVerificationStatus(data.verificationStatus),
    verificationNotes: normalizeStringArray(data.verificationNotes),
  };
}

function resolveXaiApiKey(): string | undefined {
  const direct = process.env.XAI_API_KEY?.trim();
  if (direct) return direct;

  const prefixed = Object.keys(process.env)
    .filter((key) => key.endsWith('_XAI_API_KEY'))
    .sort();

  for (const key of prefixed) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return undefined;
}

function resolveXaiModel(): string {
  return process.env.XAI_MODEL?.trim() || process.env.AI_MODEL?.trim() || DEFAULT_XAI_MODEL;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getUploadedFiles(merchantData: MerchantDataLike): UploadedFileDescriptor[] {
  const uploads: UploadedFileDescriptor[] = [];

  for (const key of FILE_KEYS) {
    const file = merchantData[key];
    if (!isPlainObject(file)) continue;
    uploads.push({
      field: key,
      name: normalizeString(file.name, key),
      mimeType: normalizeString(file.mimeType, 'application/octet-stream'),
      data: typeof file.data === 'string' ? file.data : undefined,
      uploadDate: normalizeString(file.uploadDate),
      documentType: normalizeString(file.documentType),
      status: normalizeString(file.status),
      extractedFields: normalizeStringRecord(file.extractedFields),
      confidence: normalizeOptionalNumber(file.confidence),
      linkedRequirement: normalizeString(file.linkedRequirement),
    });
  }

  const additionalDocuments = Array.isArray(merchantData.additionalDocuments)
    ? merchantData.additionalDocuments
    : [];

  additionalDocuments.forEach((file, index) => {
    if (!isPlainObject(file)) return;
    uploads.push({
      field: `additionalDocument${index + 1}`,
      name: normalizeString(file.name, `additional-document-${index + 1}`),
      mimeType: normalizeString(file.mimeType, 'application/octet-stream'),
      data: typeof file.data === 'string' ? file.data : undefined,
      uploadDate: normalizeString(file.uploadDate),
      documentType: normalizeString(file.documentType),
      status: normalizeString(file.status),
      extractedFields: normalizeStringRecord(file.extractedFields),
      confidence: normalizeOptionalNumber(file.confidence),
      linkedRequirement: normalizeString(file.linkedRequirement),
    });
  });

  return uploads;
}

function hasBinaryAttachmentData(merchantData: MerchantDataLike): boolean {
  return getUploadedFiles(merchantData).some((upload) => typeof upload.data === 'string' && upload.data.trim().length > 0);
}

function stripBinaryMerchantData(merchantData: MerchantDataLike): MerchantDataLike {
  const next: MerchantDataLike = { ...merchantData };

  for (const key of FILE_KEYS) {
    const file = next[key];
    if (!isPlainObject(file)) continue;
    next[key] = {
      ...file,
      data: '',
    };
  }

  if (Array.isArray(next.additionalDocuments)) {
    next.additionalDocuments = next.additionalDocuments.map((file) =>
      isPlainObject(file)
        ? {
            ...file,
            data: '',
          }
        : file
    );
  }

  return next;
}

function isImageFile(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/');
}

function isPdfFile(mimeType: string, fileName: string): boolean {
  const mime = mimeType.toLowerCase();
  return mime === 'application/pdf' || mime === 'application/x-pdf' || fileName.toLowerCase().endsWith('.pdf');
}

function decodeBase64DataUrl(data: string): Uint8Array {
  const base64 = data.replace(/^data:[^;]+;base64,/, '');
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

function prettifyFieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function isMeaningfulScalar(value: unknown): value is ScalarValue {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'boolean';
}

function getMeaningfulScalarEntries(merchantData: MerchantDataLike): Array<[string, ScalarValue]> {
  const entries: Array<[string, ScalarValue]> = [];

  for (const [field, value] of Object.entries(merchantData)) {
    if (!isMeaningfulScalar(value)) continue;
    entries.push([field, value]);
  }

  return entries;
}

function maskSensitiveValue(raw: string): string {
  const compact = raw.replace(/\s+/g, '');
  if (compact.length <= 4) return 'Provided';
  return `Provided (ending ${compact.slice(-4)})`;
}

function formatScalarValue(field: string, value: ScalarValue): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (!raw) return '';
  if (SENSITIVE_FIELD_KEYS.has(field)) return maskSensitiveValue(raw);
  return raw;
}

function buildSectionText(title: string, entries: Array<[string, ScalarValue]>): string {
  if (!entries.length) return '';
  const lines = entries.map(([field, value]) => `- ${prettifyFieldLabel(field)}: ${formatScalarValue(field, value)}`);
  return `${title}:\n${lines.join('\n')}`;
}

function getExpectedDocumentFields(merchantData: MerchantDataLike): string[] {
  const industry = normalizeString(merchantData.industry);
  const country = normalizeString(merchantData.country);
  const monthlyVolume = normalizeString(merchantData.monthlyVolume);
  const isHighRisk = HIGH_RISK_INDUSTRIES.has(industry);
  const isInternational = country.length > 0 && !DOMESTIC_COUNTRIES.has(country);
  const isHighVolume = monthlyVolume === '>250k' || monthlyVolume === '50k-250k';

  const expected = ['idUpload', 'registrationCertificate'];

  if (isInternational || isHighRisk) expected.push('proofOfAddress');
  if (isHighVolume || isHighRisk) expected.push('bankStatement', 'financials');
  if (isHighRisk) expected.push('complianceDocument', 'proofOfFunds');
  if (isInternational) expected.push('enhancedVerification');

  return expected;
}

function buildIntakeCoverageText(merchantData: MerchantDataLike): string {
  const scalarEntries = getMeaningfulScalarEntries(merchantData);
  const criticalMissing = CRITICAL_INTAKE_FIELDS.filter((field) => !isMeaningfulScalar(merchantData[field])).map(prettifyFieldLabel);
  const expectedDocuments = getExpectedDocumentFields(merchantData);
  const presentDocuments = expectedDocuments.filter((field) => isPlainObject(merchantData[field]));
  const missingDocuments = expectedDocuments
    .filter((field) => !isPlainObject(merchantData[field]))
    .map((field) => UPLOAD_FIELD_LABELS[field] ?? prettifyFieldLabel(field));
  const uploadsWithMetadata = getUploadedFiles(merchantData).filter(
    (upload) =>
      Object.keys(upload.extractedFields).length > 0 ||
      typeof upload.confidence === 'number' ||
      Boolean(upload.status) ||
      Boolean(upload.documentType)
  ).length;

  const lines = [
    `- Non-empty intake fields provided: ${scalarEntries.length}`,
    `- Expected supporting documents present: ${presentDocuments.length}/${expectedDocuments.length}`,
    `- Uploaded files with extraction metadata: ${uploadsWithMetadata}`,
  ];

  if (criticalMissing.length) {
    lines.push(`- Critical intake gaps: ${criticalMissing.join(', ')}`);
  }

  if (missingDocuments.length) {
    lines.push(`- Missing expected documents: ${missingDocuments.join(', ')}`);
  }

  return lines.join('\n');
}

function buildDerivedRiskSignalsText(merchantData: MerchantDataLike): string {
  const industry = normalizeString(merchantData.industry);
  const country = normalizeString(merchantData.country);
  const monthlyVolume = normalizeString(merchantData.monthlyVolume);
  const monthlyTransactions = normalizeString(merchantData.monthlyTransactions);
  const domesticCrossBorderSplit = normalizeString(merchantData.domesticCrossBorderSplit);
  const domesticVsInternational = normalizeString(merchantData.domesticVsInternational);
  const recurringBillingDetails = normalizeString(merchantData.recurringBillingDetails);
  const trialPeriod = normalizeString(merchantData.trialPeriod);
  const complianceDetails = normalizeString(merchantData.complianceDetails);
  const regulatoryStatus = normalizeString(merchantData.regulatoryStatus);
  const chargebackHistory = normalizeString(merchantData.chargebackHistory);
  const previousProcessors = normalizeString(merchantData.previousProcessors);

  const signals: string[] = [];

  if (HIGH_RISK_INDUSTRIES.has(industry)) {
    signals.push(`Industry is on the elevated-risk route: ${industry}.`);
  }
  if (country && !DOMESTIC_COUNTRIES.has(country)) {
    signals.push(`Merchant is registered outside US/CA: ${country}.`);
  }
  if (monthlyVolume === '>250k' || monthlyVolume === '50k-250k') {
    signals.push(`Processing volume is substantial: ${monthlyVolume} per month.`);
  }
  if (monthlyTransactions === '1k-10k' || monthlyTransactions === '>10k') {
    signals.push(`Transaction count is moderately high to high: ${monthlyTransactions} per month.`);
  }
  if (domesticCrossBorderSplit || domesticVsInternational || country === 'EU' || country === 'UK' || country === 'Other') {
    signals.push('Cross-border or international processing exposure is present or implied.');
  }
  if (recurringBillingDetails || trialPeriod) {
    signals.push('Recurring or subscription billing behavior is present.');
  }
  if (complianceDetails || regulatoryStatus) {
    signals.push('The merchant supplied compliance or licensing narrative that should be weighed in the score.');
  }
  if (chargebackHistory) {
    signals.push(`Chargeback history disclosed: ${chargebackHistory}.`);
  }
  if (previousProcessors) {
    signals.push(`Previous processor history supplied: ${previousProcessors}.`);
  }
  if (!signals.length) {
    signals.push('No additional derived intake signals were detected beyond the raw questionnaire answers.');
  }

  return signals.map((signal) => `- ${signal}`).join('\n');
}

function buildMerchantProfileText(merchantData: MerchantDataLike): string {
  const scalarEntries = getMeaningfulScalarEntries(merchantData);
  if (!scalarEntries.length) {
    return 'No scalar merchant profile fields were supplied.';
  }

  const entryMap = new Map<string, ScalarValue>(scalarEntries);
  const usedFields = new Set<string>();
  const sections: string[] = [];

  for (const section of INTAKE_SECTIONS) {
    const entries = section.fields
      .filter((field) => entryMap.has(field))
      .map((field) => {
        usedFields.add(field);
        return [field, entryMap.get(field) as ScalarValue] as [string, ScalarValue];
      });
    const text = buildSectionText(section.title, entries);
    if (text) sections.push(text);
  }

  const remainingEntries = scalarEntries.filter(([field]) => !usedFields.has(field));
  const remainingText = buildSectionText('Other provided intake fields', remainingEntries);
  if (remainingText) sections.push(remainingText);

  return sections.join('\n\n');
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function formatConfidence(confidence: number | undefined): string | undefined {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return undefined;
  const normalized = confidence > 1 ? confidence : confidence * 100;
  return `${Math.max(0, Math.min(100, Math.round(normalized)))}%`;
}

function summarizeExtractedFields(extractedFields: Record<string, string>): string {
  const entries = Object.entries(extractedFields);
  if (!entries.length) return '';

  const preview = entries.slice(0, 6).map(([field, value]) => `${prettifyFieldLabel(field)}=${truncateText(value, 80)}`);
  const hiddenCount = entries.length - preview.length;
  if (hiddenCount > 0) {
    preview.push(`+${hiddenCount} more extracted field(s)`);
  }

  return preview.join('; ');
}

function buildUploadInventoryText(
  merchantData: MerchantDataLike,
  deliveredFields: Set<string> = new Set(),
  skippedNotes: string[] = []
): string {
  const uploads = getUploadedFiles(merchantData);
  const lines = uploads.map((upload) => {
    const mode = deliveredFields.has(upload.field) ? 'sent to model' : 'metadata only';
    const descriptors = [upload.mimeType, mode];
    if (upload.documentType) descriptors.push(`doc type ${upload.documentType}`);
    if (upload.status) descriptors.push(`status ${upload.status}`);
    const confidenceLabel = formatConfidence(upload.confidence);
    if (confidenceLabel) descriptors.push(`confidence ${confidenceLabel}`);
    if (upload.linkedRequirement) descriptors.push(`requirement ${upload.linkedRequirement}`);
    if (upload.uploadDate) descriptors.push(`uploaded ${upload.uploadDate}`);

    const fileLines = [
      `- ${UPLOAD_FIELD_LABELS[upload.field] ?? upload.field}: ${upload.name} (${descriptors.join(', ')})`,
    ];

    const extractedSummary = summarizeExtractedFields(upload.extractedFields);
    if (extractedSummary) {
      fileLines.push(`  extracted fields: ${extractedSummary}`);
    }

    return fileLines.join('\n');
  });

  if (skippedNotes.length) {
    lines.push(...skippedNotes.map((note) => `- note: ${note}`));
  }

  if (!lines.length) {
    return 'No uploaded supporting documents were included in this request.';
  }

  return lines.join('\n');
}

function buildPromptText(
  merchantData: MerchantDataLike,
  deliveredFields: Set<string> = new Set(),
  skippedNotes: string[] = []
): string {
  return `You are an expert payment processing underwriter. Analyze the merchant profile and uploaded documents.

Merchant Profile:
${buildMerchantProfileText(merchantData)}

Intake Coverage:
${buildIntakeCoverageText(merchantData)}

Derived Risk Signals:
${buildDerivedRiskSignalsText(merchantData)}

Uploaded Documents:
${buildUploadInventoryText(merchantData, deliveredFields, skippedNotes)}

Tasks:
1. Return a numerical riskScore from 0 to 100.
2. Return riskCategory as Low, Medium, or High.
3. Return 2-5 riskFactors.
4. Recommend one processor from Stripe, Adyen, Nuvei, HighRiskPay.
5. Explain the recommendation in reason, citing the intake facts, completeness gaps, and document evidence that drove the score.
6. Summarize what the uploaded files appear to contain in documentSummary. If only metadata was available, say that clearly.
7. Cross-check merchant profile, intake completeness, document metadata, and documents against each other and return verificationStatus and verificationNotes.
8. Treat missing critical intake fields, missing expected documents, extraction mismatches, and regulated-industry answers as real scoring signals.

Return JSON only with exactly these keys:
{
  "riskScore": number,
  "riskCategory": "Low" | "Medium" | "High",
  "riskFactors": string[],
  "recommendedProcessor": "Stripe" | "Adyen" | "Nuvei" | "HighRiskPay",
  "reason": string,
  "documentSummary": string,
  "verificationStatus": "Verified" | "Discrepancies Found" | "Unverified",
  "verificationNotes": string[]
}`;
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(`Timed out after ${timeoutMs}ms`), timeoutMs);
  return controller.signal;
}

function estimateBase64DataUrlBytes(data: string | undefined): number {
  if (!data?.trim()) return 0;
  const base64 = data.replace(/^data:[^;]+;base64,/, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function describeBinaryBudgetSkip(upload: UploadedFileDescriptor, reason: string): string {
  return `${upload.name} was not attached in binary form because ${reason}.`;
}

function shouldAttachInlineImage(upload: UploadedFileDescriptor): boolean {
  return estimateBase64DataUrlBytes(upload.data) <= MAX_INLINE_IMAGE_BYTES;
}

function shouldAttachBinaryDocument(
  upload: UploadedFileDescriptor,
  alreadyAttachedCount: number,
  alreadyAttachedBytes: number
): { ok: boolean; reason?: string; sizeBytes: number } {
  const sizeBytes = estimateBase64DataUrlBytes(upload.data);
  if (alreadyAttachedCount >= MAX_BINARY_ATTACHMENTS) {
    return {
      ok: false,
      reason: `the request already attached ${MAX_BINARY_ATTACHMENTS} binary documents`,
      sizeBytes,
    };
  }

  if (alreadyAttachedBytes + sizeBytes > MAX_BINARY_TOTAL_BYTES) {
    return {
      ok: false,
      reason: `adding it would exceed the ${Math.round(MAX_BINARY_TOTAL_BYTES / 1_000_000)}MB binary budget`,
      sizeBytes,
    };
  }

  return { ok: true, sizeBytes };
}

async function xaiFetch(
  path: string,
  apiKey: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  return fetch(`${XAI_BASE_URL}${path}`, {
    ...init,
    signal: init.signal ?? createTimeoutSignal(timeoutMs),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    },
  });
}

async function uploadFileToXai(file: UploadedFileDescriptor, apiKey: string): Promise<string> {
  if (!file.data?.trim()) {
    throw new Error(`Cannot upload ${file.name}: missing file bytes.`);
  }

  const bytes = decodeBase64DataUrl(file.data);
  const formData = new FormData();
  formData.append('purpose', 'assistants');
  formData.append('file', new Blob([bytes], { type: file.mimeType }), file.name);

  const response = await xaiFetch(
    '/files',
    apiKey,
    {
      method: 'POST',
      body: formData,
    },
    XAI_UPLOAD_TIMEOUT_MS
  );

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`xAI file upload failed (${response.status}): ${rawText.slice(0, 600)}`);
  }

  const payload = JSON.parse(rawText) as { id?: string };
  if (!payload.id) {
    throw new Error(`xAI file upload succeeded but returned no file id: ${rawText.slice(0, 600)}`);
  }

  return payload.id;
}

async function deleteXaiFile(fileId: string, apiKey: string): Promise<void> {
  try {
    await xaiFetch(`/files/${fileId}`, apiKey, { method: 'DELETE' }, XAI_UPLOAD_TIMEOUT_MS);
  } catch {
    // Best-effort cleanup only.
  }
}

function extractResponseText(payload: XaiResponsesCreateResponse): string {
  const texts: string[] = [];
  for (const item of payload.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && typeof part.text === 'string') {
        texts.push(part.text);
      }
    }
  }
  return texts.join('\n').trim();
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

async function runUnderwriting(merchantData: MerchantDataLike): Promise<UnderwritingApiResult> {
  const apiKey = resolveXaiApiKey();
  if (!apiKey) {
    throw new Error('Missing XAI_API_KEY or an environment variable ending in _XAI_API_KEY.');
  }

  const model = resolveXaiModel();
  const uploads = getUploadedFiles(merchantData);
  const uploadedFileIds: string[] = [];
  const deliveredFields = new Set<string>();
  const skippedNotes: string[] = [];

  try {
    const content: Array<Record<string, unknown>> = [];
    let attachedBinaryDocuments = 0;
    let attachedBinaryBytes = 0;

    for (const upload of uploads) {
      if (!upload.data?.trim()) continue;

      if (isImageFile(upload.mimeType)) {
        if (!shouldAttachInlineImage(upload)) {
          skippedNotes.push(describeBinaryBudgetSkip(upload, 'the image is too large for inline analysis in the current serverless budget'));
          continue;
        }
        content.push({
          type: 'input_image',
          image_url: upload.data,
        });
        deliveredFields.add(upload.field);
        continue;
      }

      if (isPdfFile(upload.mimeType, upload.name) || upload.mimeType === 'text/plain') {
        const attachmentDecision = shouldAttachBinaryDocument(
          upload,
          attachedBinaryDocuments,
          attachedBinaryBytes
        );
        if (!attachmentDecision.ok) {
          skippedNotes.push(describeBinaryBudgetSkip(upload, attachmentDecision.reason ?? 'it would exceed the runtime budget'));
          continue;
        }
        const fileId = await uploadFileToXai(upload, apiKey);
        uploadedFileIds.push(fileId);
        content.push({
          type: 'input_file',
          file_id: fileId,
        });
        deliveredFields.add(upload.field);
        attachedBinaryDocuments += 1;
        attachedBinaryBytes += attachmentDecision.sizeBytes;
      }
    }

    content.unshift({
      type: 'input_text',
      text: buildPromptText(merchantData, deliveredFields, skippedNotes),
    });

    const response = await xaiFetch(
      '/responses',
      apiKey,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          store: false,
          input: [
            {
              role: 'user',
              content,
            },
          ],
        }),
      },
      XAI_RESPONSE_TIMEOUT_MS
    );

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`xAI responses request failed (${response.status}): ${rawText.slice(0, 1000)}`);
    }

    const payload = JSON.parse(rawText) as XaiResponsesCreateResponse;
    const outputText = extractResponseText(payload);
    if (!outputText) {
      throw new Error(`xAI responses request succeeded but no output_text was returned: ${rawText.slice(0, 1000)}`);
    }

    return parseUnderwritingResult(JSON.parse(outputText));
  } finally {
    await Promise.all(uploadedFileIds.map((fileId) => deleteXaiFile(fileId, apiKey)));
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { merchantData?: MerchantDataLike };
    if (!isPlainObject(body) || !isPlainObject(body.merchantData)) {
      return jsonResponse({ error: 'Request body must include a merchantData object.' }, 400);
    }

    try {
      const result = await runUnderwriting(body.merchantData);
      return jsonResponse(result, 200);
    } catch (error) {
      const firstMessage = describeError(error);

      if (!hasBinaryAttachmentData(body.merchantData)) {
        throw error;
      }

      console.warn('[underwrite] primary attempt failed, retrying metadata-only:', firstMessage);
      const retriedResult = await runUnderwriting(stripBinaryMerchantData(body.merchantData));
      return jsonResponse(retriedResult, 200);
    }
  } catch (error) {
    const message = describeError(error);
    console.error('[underwrite] request failed:', message);
    return jsonResponse({ error: message }, 500);
  }
}

export default {
  async fetch(request: Request) {
    return POST(request);
  },
};
