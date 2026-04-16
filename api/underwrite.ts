import { gunzipSync } from 'node:zlib';

export const runtime = 'nodejs';

type VerificationStatus = 'Verified' | 'Discrepancies Found' | 'Unverified';
type RiskCategory = 'Low' | 'Medium' | 'High';
type Processor = 'Nuvei' | 'Payroc / Peoples' | 'Chase';

type UnderwritingApiResult = {
  riskScore: number;
  riskCategory: RiskCategory;
  riskFactors: string[];
  recommendedProcessor: Processor;
  reason: string;
  merchantSummary: string;
  missingItems: string[];
  readinessDecision: string;
  processorFitSuggestion: string;
  websiteReviewSummary: string;
  documentSummary: string;
  verificationStatus: VerificationStatus;
  verificationNotes: string[];
};

type MerchantFile = {
  name?: string;
  mimeType?: string;
  data?: string;
  contentEncoding?: string;
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
  contentEncoding?: string;
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
  type?: string;
  text?: string;
  content?: string | XaiResponseTextPart[];
};

type XaiResponsesCreateResponse = {
  output_text?: string;
  output?: XaiResponseOutputItem[];
};

const XAI_BASE_URL = 'https://api.x.ai/v1';
const DEFAULT_XAI_MODEL = 'grok-4-1-fast-non-reasoning';
const FALLBACK_XAI_MODELS = ['grok-4-fast-non-reasoning', 'grok-4.20-reasoning'] as const;
const ALLOWED_PROCESSORS: Processor[] = ['Nuvei', 'Payroc / Peoples', 'Chase'];
const XAI_UPLOAD_TIMEOUT_MS = 15_000;
const XAI_RESPONSE_TIMEOUT_MS = 35_000;
const WEBSITE_REVIEW_TIMEOUT_MS = 5_000;
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
const CONCERN_KEYWORDS = ['chargeback', 'fraud', 'reserve', 'terminated', 'mismatch', 'decline', 'high', 'review'];
const CRITICAL_INTAKE_FIELDS = [
  'businessType',
  'country',
  'industry',
  'monthlyVolume',
  'monthlyTransactions',
  'legalName',
  'website',
  'legalBusinessEmail',
  'productsServices',
  'beneficialOwners',
  'authorizedSignerName',
  'authorizedSignerEmail',
  'ownerEmail',
  'avgTicketSize',
  'highestTicketAmount',
  'websitePrivacyPolicy',
  'websiteTerms',
  'websiteRefundPolicy',
  'websiteShippingPolicy',
  'websiteCurrencyDisplay',
] as const;
const UPLOAD_FIELD_LABELS: Record<string, string> = {
  financials: 'Recent processing statements / financial statements',
  idUpload: 'Government ID',
  enhancedVerification: 'Enhanced verification',
  proofOfAddress: 'Proof of address',
  registrationCertificate: 'Registration certificate',
  taxDocument: 'Void cheque / bank letter',
  proofOfFunds: 'Proof of ownership',
  bankStatement: 'Recent business bank statements',
  complianceDocument: 'Compliance document',
};
const FIELD_LABELS: Record<string, string> = {
  businessType: 'Business type',
  country: 'Country / registration jurisdiction',
  industry: 'Industry',
  monthlyVolume: 'Monthly processing volume',
  monthlyTransactions: 'Monthly transactions',
  legalName: 'Legal business name',
  dbaName: 'DBA / operating / trade name',
  taxId: 'Tax ID / EIN',
  businessRegistrationNumber: 'Business registration / corporation / GST/HST number',
  establishedDate: 'Established / incorporated date',
  legalBusinessAddress: 'Legal business address',
  operatingAddressDifferent: 'Operating address differs',
  businessPhone: 'Business phone',
  legalBusinessEmail: 'Legal business email',
  website: 'Website',
  staffSize: 'Staff size',
  paymentProducts: 'Payment products',
  businessCategory: 'Business subcategory',
  productsServices: 'Products or services sold',
  goodsOrServicesType: 'Physical / digital / services mix',
  customerType: 'B2B / B2C mix',
  advancePayment: 'Payment taken in advance',
  advancePaymentPercent: 'Advance-payment percentage',
  recurringBilling: 'Recurring billing offered',
  recurringSalesPercent: 'Recurring sales percentage',
  fulfillmentTimeline: 'Fulfillment timeline',
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
  beneficialOwners: '25%+ beneficial owners',
  parentOwned: 'Parent-owned business',
  parentCompanyName: 'Parent company name',
  nonOwnerController: 'Non-owner controller disclosed',
  nonOwnerControllerDetails: 'Non-owner controller details',
  authorizedSignerName: 'Authorized signer name',
  authorizedSignerTitle: 'Authorized signer title',
  authorizedSignerEmail: 'Authorized signer email',
  signerIsOwner: 'Signer is owner',
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
  currentlyProcessesCards: 'Currently processes card payments',
  currentOrPreviousProcessor: 'Current or previous processor',
  processorExitReason: 'Reason for leaving current / previous processor',
  priorTermination: 'Prior merchant account termination',
  priorTerminationExplanation: 'Prior termination explanation',
  bankruptcyHistory: 'Bankruptcy history',
  bankruptcyExplanation: 'Bankruptcy explanation',
  riskProgramHistory: 'Visa / Mastercard risk program history',
  riskProgramExplanation: 'Risk program explanation',
  highestTicketAmount: 'Highest transaction amount',
  transactionChannelSplit: 'Card-present / ecommerce / MOTO split',
  paymentTypesWanted: 'Payment types wanted',
  recurringTransactionsPercent: 'Recurring transaction percentage',
  foreignCardsPercent: 'Foreign-card percentage',
  websitePrivacyPolicy: 'Website Privacy Policy present',
  websiteTerms: 'Website Terms present',
  websiteRefundPolicy: 'Website refund policy present',
  websiteShippingPolicy: 'Website shipping policy present',
  websiteContactInfo: 'Website customer service contact present',
  websiteCurrencyDisplay: 'Website transaction currency display present',
  websiteSsl: 'Website SSL / encrypted payment page',
  storesCardNumbers: 'Stores card numbers',
  thirdPartyCardApps: 'Third-party cardholder-data apps',
  dataBreachHistory: 'Data breach / card compromise history',
  regulatedBusiness: 'MSB / regulated business',
  canProvideRegistration: 'Can provide registration / articles',
  canProvideVoidCheque: 'Can provide void cheque / bank letter',
  canProvideBankStatements: 'Can provide recent bank statements',
  canProvideProofOfAddress: 'Can provide proof of address',
  canProvideProofOfOwnership: 'Can provide proof of ownership',
  canProvideOwnerIds: 'Can provide owner/signer photo ID',
  canProvideProcessingStatements: 'Can provide processing statements',
  personaInvitePlan: 'Persona invite trigger plan',
  personaVerificationSummary: 'Persona verification result summary',
  websiteReviewSummary: 'Website review signal summary',
  matchedProcessor: 'Matched processor',
  processorSpecificAnswers: 'Processor-specific follow-up answers',
  processorReadyPackageSummary: 'Processor-ready package summary',
  complianceDetails: 'Compliance details',
};
const INTAKE_SECTIONS: IntakeSectionDefinition[] = [
  {
    title: 'Qualification snapshot',
    fields: ['businessType', 'country', 'industry', 'monthlyVolume', 'monthlyTransactions'],
  },
  {
    title: 'Legal business information',
    fields: [
      'legalName',
      'dbaName',
      'businessRegistrationNumber',
      'taxId',
      'establishedDate',
      'legalBusinessAddress',
      'operatingAddressDifferent',
      'registeredAddress',
      'operatingAddress',
      'city',
      'region',
      'province',
      'businessPhone',
      'legalBusinessEmail',
      'website',
      'timeInBusiness',
      'staffSize',
    ],
  },
  {
    title: 'Contact and presence',
    fields: ['generalEmail', 'supportEmail', 'disputesEmail', 'phone', 'preferredContact', 'socialPresence'],
  },
  {
    title: 'Business model',
    fields: [
      'productsServices',
      'businessDescription',
      'businessCategory',
      'goodsOrServicesType',
      'customerType',
      'advancePayment',
      'advancePaymentPercent',
      'recurringBilling',
      'recurringSalesPercent',
      'fulfillmentTimeline',
      'targetGeography',
      'deliveryMethod',
      'domesticVsInternational',
      'paymentProducts',
      'processingCurrencies',
    ],
  },
  {
    title: 'Transaction profile',
    fields: [
      'avgTxnCount',
      'minTxnCount',
      'maxTxnCount',
      'avgTicketSize',
      'highestTicketAmount',
      'transactionChannelSplit',
      'domesticCrossBorderSplit',
      'paymentTypesWanted',
      'recurringTransactionsPercent',
      'foreignCardsPercent',
      'recurringBillingDetails',
      'trialPeriod',
      'churnRate',
      'refundPolicy',
      'shippingPolicy',
    ],
  },
  {
    title: 'Ownership, control, and signer',
    fields: [
      'beneficialOwners',
      'parentOwned',
      'parentCompanyName',
      'nonOwnerController',
      'nonOwnerControllerDetails',
      'authorizedSignerName',
      'authorizedSignerTitle',
      'authorizedSignerEmail',
      'signerIsOwner',
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
    title: 'Processing history',
    fields: [
      'currentlyProcessesCards',
      'currentOrPreviousProcessor',
      'processorExitReason',
      'priorTermination',
      'priorTerminationExplanation',
      'bankruptcyHistory',
      'bankruptcyExplanation',
      'riskProgramHistory',
      'riskProgramExplanation',
      'previousProcessors',
      'chargebackHistory',
    ],
  },
  {
    title: 'Website, security, and PCI basics',
    fields: [
      'websitePrivacyPolicy',
      'websiteTerms',
      'websiteRefundPolicy',
      'websiteShippingPolicy',
      'websiteContactInfo',
      'websiteCurrencyDisplay',
      'websiteSsl',
      'storesCardNumbers',
      'thirdPartyCardApps',
      'dataBreachHistory',
      'regulatedBusiness',
      'websiteReviewSummary',
    ],
  },
  {
    title: 'Document readiness and workflow routing',
    fields: [
      'canProvideRegistration',
      'canProvideVoidCheque',
      'canProvideBankStatements',
      'canProvideProofOfAddress',
      'canProvideProofOfOwnership',
      'canProvideOwnerIds',
      'canProvideProcessingStatements',
      'personaInvitePlan',
      'personaVerificationSummary',
      'matchedProcessor',
      'processorSpecificAnswers',
      'processorReadyPackageSummary',
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
const UNDERWRITING_RESULT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'riskScore',
    'riskCategory',
    'riskFactors',
    'recommendedProcessor',
    'reason',
    'merchantSummary',
    'missingItems',
    'readinessDecision',
    'processorFitSuggestion',
    'websiteReviewSummary',
    'documentSummary',
    'verificationStatus',
    'verificationNotes',
  ],
  properties: {
    riskScore: {
      type: 'number',
      description: 'Overall underwriting risk score from 0 to 100.',
    },
    riskCategory: {
      type: 'string',
      enum: ['Low', 'Medium', 'High'],
    },
    riskFactors: {
      type: 'array',
      items: { type: 'string' },
      description: 'Two to five concrete underwriting risk drivers.',
    },
    recommendedProcessor: {
      type: 'string',
      enum: ['Nuvei', 'Payroc / Peoples', 'Chase'],
    },
    reason: {
      type: 'string',
      description: 'Evidence-based explanation for score and processor recommendation.',
    },
    merchantSummary: {
      type: 'string',
      description: 'Structured merchant summary covering entity, model, owners, signer, sales, website, documents, and verification.',
    },
    missingItems: {
      type: 'array',
      items: { type: 'string' },
    },
    readinessDecision: {
      type: 'string',
      description: 'One of: Ready for matching, Hold for manual review, or Missing items needed.',
    },
    processorFitSuggestion: {
      type: 'string',
      description: 'Fit notes for Nuvei, Payroc / Peoples, and Chase.',
    },
    websiteReviewSummary: {
      type: 'string',
      description: 'Structured website legitimacy and compliance summary.',
    },
    documentSummary: {
      type: 'string',
      description: 'Summary of uploaded document evidence or metadata-only limitations.',
    },
    verificationStatus: {
      type: 'string',
      enum: ['Verified', 'Discrepancies Found', 'Unverified'],
    },
    verificationNotes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const;

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(extraHeaders ?? {}),
    },
  });
}

function toPublicErrorMessage(message: string): string {
  if (message.includes('Missing XAI_API_KEY') || message.includes('_XAI_API_KEY')) {
    return 'AI service is not configured on the server.';
  }

  if (isXaiRateLimitMessage(message)) {
    return 'xAI is rate-limiting this project right now (429). Please wait about a minute and try again, or increase the xAI/Vercel Integration limits if this repeats.';
  }

  if (isLikelyXaiModelMessage(message)) {
    return 'The configured xAI model is unavailable for this project. The server tried its safe fallback model list, but xAI still rejected the request.';
  }

  return 'AI underwriting request failed. Please try again.';
}

function toPublicErrorStatus(message: string): number {
  return isXaiRateLimitMessage(message) ? 429 : 500;
}

function toServerLogErrorMessage(message: string): string {
  if (!message.startsWith('xAI ')) {
    return message;
  }

  const firstColon = message.indexOf(':');
  return firstColon === -1 ? message : message.slice(0, firstColon);
}

function resolveAllowedOrigins(requestOrigin?: string): Set<string> {
  const allowed = new Set<string>();
  if (requestOrigin) {
    allowed.add(requestOrigin);
  }

  const candidates = [process.env.APP_URL, process.env.UNDERWRITE_ALLOWED_ORIGINS]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      allowed.add(new URL(candidate).origin);
    } catch {
      // Ignore malformed origin configuration instead of crashing the route.
    }
  }

  return allowed;
}

function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function validateOrigin(request: Request): string | undefined {
  const requestOrigin = (() => {
    try {
      return new URL(request.url).origin;
    } catch {
      return undefined;
    }
  })();

  const allowedOrigins = resolveAllowedOrigins(requestOrigin);
  const originHeader = request.headers.get('origin')?.trim();
  const refererHeader = request.headers.get('referer')?.trim();
  const secFetchSiteHeader = request.headers.get('sec-fetch-site')?.trim();
  const secFetchSite = secFetchSiteHeader ? secFetchSiteHeader.toLowerCase() : undefined;

  if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) {
    return 'Cross-site requests are not allowed.';
  }

  if (originHeader) {
    try {
      if (!allowedOrigins.has(new URL(originHeader).origin)) {
        return 'Request origin is not allowed.';
      }
    } catch {
      return 'Request origin is invalid.';
    }
    return undefined;
  }

  if (refererHeader) {
    try {
      if (!allowedOrigins.has(new URL(refererHeader).origin)) {
        return 'Request referer is not allowed.';
      }
    } catch {
      return 'Request referer is invalid.';
    }
    return undefined;
  }

  if (requestOrigin && isLocalOrigin(requestOrigin)) {
    return undefined;
  }

  return 'Missing origin for protected request.';
}

function protectUnderwriteRoute(request: Request): Response | undefined {
  const originError = validateOrigin(request);
  if (originError) {
    console.warn('[underwrite] blocked request:', originError);
    return jsonResponse({ error: 'Request blocked by API protection.' }, 403);
  }

  return undefined;
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
  const entries: Array<[string, string]> = [];
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue === 'string' && entryValue.trim()) {
      entries.push([entryKey, entryValue.trim()]);
    }
  }
  return Object.fromEntries(entries);
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
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower.includes('payroc') || lower.includes('peoples')) return 'Payroc / Peoples';
    if (lower.includes('chase')) return 'Chase';
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
    merchantSummary: normalizeString(data.merchantSummary, 'No merchant summary provided by the model.'),
    missingItems: normalizeStringArray(data.missingItems),
    readinessDecision: normalizeString(data.readinessDecision, 'No readiness decision provided by the model.'),
    processorFitSuggestion: normalizeString(data.processorFitSuggestion, 'No processor fit suggestion provided by the model.'),
    websiteReviewSummary: normalizeString(data.websiteReviewSummary, 'No website review summary provided by the model.'),
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

function resolveXaiModels(): string[] {
  const configuredFallbacks = (process.env.XAI_MODEL_FALLBACKS ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);

  return [...new Set([resolveXaiModel(), ...configuredFallbacks, ...FALLBACK_XAI_MODELS])];
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
      contentEncoding: normalizeString(file.contentEncoding),
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
      contentEncoding: normalizeString(file.contentEncoding),
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

function decodeUploadBytes(upload: UploadedFileDescriptor): Uint8Array {
  const bytes = decodeBase64DataUrl(upload.data ?? '');
  if (upload.contentEncoding === 'gzip') {
    return Uint8Array.from(gunzipSync(bytes));
  }
  return bytes;
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
  const currentlyProcessesCards = normalizeString(merchantData.currentlyProcessesCards).toLowerCase();
  const isHighRisk = HIGH_RISK_INDUSTRIES.has(industry);
  const isInternational = country.length > 0 && !DOMESTIC_COUNTRIES.has(country);
  const isHighVolume = monthlyVolume === '>250k' || monthlyVolume === '50k-250k';
  const currentlyProcesses = currentlyProcessesCards.includes('yes');

  const expected = ['registrationCertificate', 'taxDocument', 'bankStatement', 'proofOfAddress', 'proofOfFunds', 'idUpload'];

  if (currentlyProcesses || isHighVolume || isHighRisk) expected.push('financials');
  if (isHighRisk) expected.push('complianceDocument');
  if (isInternational) expected.push('enhancedVerification');

  return [...new Set(expected)];
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
  const recurringBilling = normalizeString(merchantData.recurringBilling);
  const recurringSalesPercent = normalizeString(merchantData.recurringSalesPercent);
  const advancePayment = normalizeString(merchantData.advancePayment);
  const advancePaymentPercent = normalizeString(merchantData.advancePaymentPercent);
  const transactionChannelSplit = normalizeString(merchantData.transactionChannelSplit);
  const foreignCardsPercent = normalizeString(merchantData.foreignCardsPercent);
  const trialPeriod = normalizeString(merchantData.trialPeriod);
  const complianceDetails = normalizeString(merchantData.complianceDetails);
  const regulatoryStatus = normalizeString(merchantData.regulatoryStatus);
  const chargebackHistory = normalizeString(merchantData.chargebackHistory);
  const previousProcessors = normalizeString(merchantData.previousProcessors);
  const priorTermination = normalizeString(merchantData.priorTermination);
  const bankruptcyHistory = normalizeString(merchantData.bankruptcyHistory);
  const riskProgramHistory = normalizeString(merchantData.riskProgramHistory);

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
  if (domesticCrossBorderSplit || domesticVsInternational || foreignCardsPercent || country === 'EU' || country === 'UK' || country === 'Other') {
    signals.push('Cross-border or international processing exposure is present or implied.');
  }
  if (recurringBillingDetails || recurringBilling || recurringSalesPercent || trialPeriod) {
    signals.push('Recurring or subscription billing behavior is present.');
  }
  if (advancePayment || advancePaymentPercent) {
    signals.push('Advance-payment or delayed-fulfillment exposure is present.');
  }
  if (transactionChannelSplit.toLowerCase().includes('e-commerce') || transactionChannelSplit.toLowerCase().includes('moto') || transactionChannelSplit.toLowerCase().includes('keyed')) {
    signals.push('Card-not-present volume is present in the channel mix.');
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
  if (priorTermination || bankruptcyHistory || riskProgramHistory) {
    signals.push('Adverse processing, bankruptcy, or card-brand risk-program history was answered and should be considered.');
  }
  if (!signals.length) {
    signals.push('No additional derived intake signals were detected beyond the raw questionnaire answers.');
  }

  return signals.map((signal) => `- ${signal}`).join('\n');
}

function hasProvidedText(value: unknown): boolean {
  return normalizeString(value).length > 0;
}

function containsConcernKeyword(value: string): boolean {
  const lower = value.toLowerCase();
  return CONCERN_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildRuleBasedBaselineText(merchantData: MerchantDataLike): string {
  const industry = normalizeString(merchantData.industry);
  const country = normalizeString(merchantData.country);
  const monthlyVolume = normalizeString(merchantData.monthlyVolume);
  const monthlyTransactions = normalizeString(merchantData.monthlyTransactions);
  const billingModel = normalizeString(merchantData.billingModel);
  const chargebackHistory = normalizeString(merchantData.chargebackHistory);
  const previousProcessors = normalizeString(merchantData.previousProcessors);
  const currentOrPreviousProcessor = normalizeString(merchantData.currentOrPreviousProcessor);
  const priorTermination = normalizeString(merchantData.priorTermination);
  const priorTerminationExplanation = normalizeString(merchantData.priorTerminationExplanation);
  const bankruptcyHistory = normalizeString(merchantData.bankruptcyHistory);
  const bankruptcyExplanation = normalizeString(merchantData.bankruptcyExplanation);
  const riskProgramHistory = normalizeString(merchantData.riskProgramHistory);
  const riskProgramExplanation = normalizeString(merchantData.riskProgramExplanation);
  const recurringBillingDetails = normalizeString(merchantData.recurringBillingDetails);
  const recurringBilling = normalizeString(merchantData.recurringBilling);
  const recurringSalesPercent = normalizeString(merchantData.recurringSalesPercent);
  const advancePayment = normalizeString(merchantData.advancePayment);
  const advancePaymentPercent = normalizeString(merchantData.advancePaymentPercent);
  const transactionChannelSplit = normalizeString(merchantData.transactionChannelSplit);
  const foreignCardsPercent = normalizeString(merchantData.foreignCardsPercent);
  const trialPeriod = normalizeString(merchantData.trialPeriod);
  const domesticVsInternational = normalizeString(merchantData.domesticVsInternational);
  const domesticCrossBorderSplit = normalizeString(merchantData.domesticCrossBorderSplit);
  const processingCurrencies = normalizeString(merchantData.processingCurrencies);

  const isHighRisk = HIGH_RISK_INDUSTRIES.has(industry);
  const isInternational = country.length > 0 && !DOMESTIC_COUNTRIES.has(country);
  const isHighVolume = monthlyVolume === '50k-250k' || monthlyVolume === '>250k';
  const isVeryHighVolume = monthlyVolume === '>250k';
  const hasRecurringExposure =
    recurringBillingDetails.length > 0 ||
    recurringBilling.length > 0 ||
    recurringSalesPercent.length > 0 ||
    trialPeriod.length > 0 ||
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
    [priorTermination, priorTerminationExplanation, bankruptcyHistory, bankruptcyExplanation, riskProgramHistory, riskProgramExplanation]
      .some((item) => item.length > 0 && !/^no\b/i.test(item));
  const hasMitigatingCompliance =
    hasProvidedText(merchantData.complianceDetails) ||
    hasProvidedText(merchantData.regulatoryStatus) ||
    hasProvidedText(merchantData.amlKycProcedures) ||
    hasProvidedText(merchantData.cryptoLicenses) ||
    hasProvidedText(merchantData.gamingLicenses);

  const expectedDocuments = getExpectedDocumentFields(merchantData);
  const presentDocuments = expectedDocuments.filter((field) => isPlainObject(merchantData[field]));
  const missingDocuments = expectedDocuments
    .filter((field) => !isPlainObject(merchantData[field]))
    .map((field) => UPLOAD_FIELD_LABELS[field] ?? prettifyFieldLabel(field));
  const criticalMissing = CRITICAL_INTAKE_FIELDS.filter((field) => !isMeaningfulScalar(merchantData[field])).map(prettifyFieldLabel);
  const ruleFindings: string[] = [];
  const uploads = getUploadedFiles(merchantData);
  const flaggedUploads = uploads
    .filter(
      (upload) =>
        upload.status === 'Needs review' ||
        upload.status === 'Mismatch' ||
        (typeof upload.confidence === 'number' && upload.confidence < 0.75)
    )
    .map((upload) => {
      const details: string[] = [];
      if (upload.status) details.push(`status ${upload.status}`);
      if (typeof upload.confidence === 'number' && upload.confidence < 0.75) {
        details.push(`confidence ${formatConfidence(upload.confidence) ?? 'low'}`);
      }
      return `${upload.name} (${details.join(', ')})`;
    });

  let baselineScore = 18;
  const concernSignals: string[] = [];
  const mitigatingSignals: string[] = [];

  if (isHighRisk) {
    baselineScore += 34;
    concernSignals.push(`High-risk industry route: ${industry}`);
  }
  if (isInternational) {
    baselineScore += 12;
    concernSignals.push(`Registered outside US/CA: ${country}`);
  }
  if (isVeryHighVolume) {
    baselineScore += 18;
    concernSignals.push(`Very high monthly volume: ${monthlyVolume}`);
  } else if (isHighVolume) {
    baselineScore += 10;
    concernSignals.push(`Elevated monthly volume: ${monthlyVolume}`);
  }
  if (monthlyTransactions === '>10k') {
    baselineScore += 10;
    concernSignals.push(`Very high monthly transaction count: ${monthlyTransactions}`);
  } else if (monthlyTransactions === '1k-10k') {
    baselineScore += 6;
    concernSignals.push(`Higher transaction count: ${monthlyTransactions}`);
  }
  if (hasRecurringExposure) {
    baselineScore += 8;
    concernSignals.push('Recurring billing or trial exposure present');
  }
  if (hasAdvancePaymentExposure) {
    baselineScore += 8;
    concernSignals.push('Advance-payment / delayed-fulfillment exposure present');
  }
  if (hasCardNotPresentExposure) {
    baselineScore += 6;
    concernSignals.push('Card-not-present channel exposure present');
  }
  if (hasCrossBorderExposure) {
    baselineScore += 8;
    concernSignals.push('Cross-border or multi-currency exposure present');
  }
  if (chargebackHistory.length > 0) {
    baselineScore += containsConcernKeyword(chargebackHistory) ? 12 : 5;
    concernSignals.push(`Chargeback history disclosed: ${truncateText(chargebackHistory, 100)}`);
  }
  if (previousProcessors.length > 0) {
    baselineScore += containsConcernKeyword(previousProcessors) ? 10 : 4;
    concernSignals.push(`Previous processor history disclosed: ${truncateText(previousProcessors, 100)}`);
  }
  if (currentOrPreviousProcessor.length > 0) {
    concernSignals.push(`Current / previous processor supplied: ${truncateText(currentOrPreviousProcessor, 100)}`);
  }
  if (hasAdverseHistory) {
    baselineScore += 14;
    concernSignals.push('Prior termination, bankruptcy, or card-brand risk-program answer requires manual review');
  }
  if (criticalMissing.length > 0) {
    baselineScore += Math.min(criticalMissing.length * 4, 20);
  }
  if (missingDocuments.length > 0) {
    baselineScore += Math.min(missingDocuments.length * 5, 25);
  }
  if (flaggedUploads.length > 0) {
    baselineScore += Math.min(flaggedUploads.length * 4, 12);
  }
  if (isHighRisk && !hasProvidedText(merchantData.complianceDetails) && !hasProvidedText(merchantData.regulatoryStatus)) {
    ruleFindings.push('High-risk profile is missing compliance or licensing narrative');
  }
  if (industry === 'crypto' && !hasProvidedText(merchantData.amlKycProcedures)) {
    ruleFindings.push('Crypto profile is missing AML / KYC procedures');
  }
  if (isHighVolume && !hasProvidedText(merchantData.avgTicketSize)) {
    ruleFindings.push('Higher-volume merchant is missing average ticket size');
  }
  if ((isInternational || isHighRisk) && !hasProvidedText(merchantData.targetGeography)) {
    ruleFindings.push('Target geography is missing for an international or higher-risk profile');
  }
  if (!hasProvidedText(merchantData.personaInvitePlan)) {
    ruleFindings.push('Persona/KYC/KYB trigger plan is missing');
  }
  if (
    !hasProvidedText(merchantData.websitePrivacyPolicy) ||
    !hasProvidedText(merchantData.websiteTerms) ||
    !hasProvidedText(merchantData.websiteRefundPolicy) ||
    !hasProvidedText(merchantData.websiteShippingPolicy) ||
    !hasProvidedText(merchantData.websiteCurrencyDisplay)
  ) {
    ruleFindings.push('Website compliance basics are incomplete');
  }
  if (hasMitigatingCompliance && (isHighRisk || hasCrossBorderExposure)) {
    baselineScore -= 6;
    mitigatingSignals.push('Compliance / licensing context was supplied');
  }
  if (!isHighRisk && !isInternational && criticalMissing.length === 0 && missingDocuments.length === 0) {
    baselineScore -= 5;
    mitigatingSignals.push('Core intake and required uploads appear complete for a domestic merchant');
  }

  const lines = [
    `- Deterministic baseline score before model judgment: ${Math.round(clampNumber(baselineScore, 8, 95))}/100`,
    `- Expected document coverage: ${presentDocuments.length}/${expectedDocuments.length}`,
  ];

  if (concernSignals.length > 0) {
    lines.push(`- Main concern signals: ${concernSignals.join('; ')}`);
  }
  if (mitigatingSignals.length > 0) {
    lines.push(`- Mitigating signals: ${mitigatingSignals.join('; ')}`);
  }
  if (criticalMissing.length > 0) {
    lines.push(`- Critical intake gaps to penalize: ${criticalMissing.join(', ')}`);
  }
  if (missingDocuments.length > 0) {
    lines.push(`- Missing expected documents to penalize: ${missingDocuments.join(', ')}`);
  }
  if (ruleFindings.length > 0) {
    lines.push(`- Local business-rule follow-up items: ${ruleFindings.join('; ')}`);
  }
  if (flaggedUploads.length > 0) {
    lines.push(`- Uploaded document metadata that suggests follow-up: ${flaggedUploads.join('; ')}`);
  }

  return lines.join('\n');
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

function normalizeWebsiteUrl(value: unknown): URL | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const raw = value.trim();
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function isUnsafeWebsiteHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return true;
  if (/^(127|10|0)\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d+)\./);
  return private172 ? Number(private172[1]) >= 16 && Number(private172[1]) <= 31 : false;
}

function htmlContainsAny(html: string, patterns: string[]): boolean {
  const lower = html.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

async function buildWebsiteReviewText(merchantData: MerchantDataLike): Promise<string> {
  const url = normalizeWebsiteUrl(merchantData.website);
  const declaredSignals = [
    `- Merchant-supplied URL: ${typeof merchantData.website === 'string' && merchantData.website.trim() ? merchantData.website.trim() : 'not supplied'}`,
    `- Privacy Policy declared: ${normalizeString(merchantData.websitePrivacyPolicy) || 'unknown'}`,
    `- Terms declared: ${normalizeString(merchantData.websiteTerms) || 'unknown'}`,
    `- Return / Refund Policy declared: ${normalizeString(merchantData.websiteRefundPolicy) || 'unknown'}`,
    `- Shipping Policy declared if applicable: ${normalizeString(merchantData.websiteShippingPolicy) || 'unknown'}`,
    `- Customer service contact declared visible: ${normalizeString(merchantData.websiteContactInfo) || 'unknown'}`,
    `- Transaction currency display declared if applicable: ${normalizeString(merchantData.websiteCurrencyDisplay) || 'unknown'}`,
    `- SSL / encrypted payment declared: ${normalizeString(merchantData.websiteSsl) || 'unknown'}`,
    `- Stores card numbers: ${normalizeString(merchantData.storesCardNumbers) || 'unknown'}`,
    `- Third-party cardholder-data apps: ${normalizeString(merchantData.thirdPartyCardApps) || 'none disclosed'}`,
    `- Prior data breach / compromise: ${normalizeString(merchantData.dataBreachHistory) || 'unknown'}`,
    `- Regulated / MSB business: ${normalizeString(merchantData.regulatedBusiness) || 'unknown'}`,
  ];

  if (!url) {
    return ['Website reachability: not checked because no valid http(s) URL was supplied.', ...declaredSignals].join('\n');
  }

  if (isUnsafeWebsiteHost(url.hostname)) {
    return ['Website reachability: skipped because the submitted hostname is not safe for server-side review.', ...declaredSignals].join('\n');
  }

  try {
    const response = await fetch(url.href, {
      method: 'GET',
      redirect: 'follow',
      signal: createTimeoutSignal(WEBSITE_REVIEW_TIMEOUT_MS),
      headers: {
        'User-Agent': 'BCIT-BCP-underwriting-review/1.0',
      },
    });
    const contentType = response.headers.get('content-type') ?? '';
    const html = contentType.includes('text/html') ? (await response.text()).slice(0, 120_000) : '';
    const detected = [
      `- Reachable: ${response.ok ? 'yes' : 'no'} (HTTP ${response.status})`,
      `- Final URL: ${response.url}`,
      `- Homepage HTML inspected: ${html ? 'yes' : 'no'}`,
      `- Privacy Policy detected in page text/links: ${html ? (htmlContainsAny(html, ['privacy policy', '/privacy']) ? 'yes' : 'no') : 'unknown'}`,
      `- Terms detected in page text/links: ${html ? (htmlContainsAny(html, ['terms and conditions', 'terms of use', '/terms']) ? 'yes' : 'no') : 'unknown'}`,
      `- Refund / return language detected: ${html ? (htmlContainsAny(html, ['refund', 'return policy', 'returns']) ? 'yes' : 'no') : 'unknown'}`,
      `- Shipping language detected: ${html ? (htmlContainsAny(html, ['shipping', 'delivery', 'fulfillment']) ? 'yes' : 'no') : 'unknown'}`,
      `- Contact/support language detected: ${html ? (htmlContainsAny(html, ['contact', 'support', 'customer service', 'mailto:']) ? 'yes' : 'no') : 'unknown'}`,
      `- Currency language detected: ${html ? (htmlContainsAny(html, ['cad', 'usd', '$', 'currency']) ? 'yes' : 'no') : 'unknown'}`,
    ];
    return ['Structured Website Review:', ...detected, ...declaredSignals].join('\n');
  } catch (error) {
    return [
      `Website reachability: failed or timed out (${truncateText(describeError(error), 120)}).`,
      ...declaredSignals,
    ].join('\n');
  }
}

function buildPromptText(
  merchantData: MerchantDataLike,
  deliveredFields: Set<string> = new Set(),
  skippedNotes: string[] = [],
  websiteReviewText = 'Website review was not performed.'
): string {
  return `You are an expert payment processing underwriter. Analyze the merchant profile and uploaded documents.

Merchant Profile:
${buildMerchantProfileText(merchantData)}

Intake Coverage:
${buildIntakeCoverageText(merchantData)}

Derived Risk Signals:
${buildDerivedRiskSignalsText(merchantData)}

Rules-Based Screening Baseline:
${buildRuleBasedBaselineText(merchantData)}

Website Review:
${websiteReviewText}

Uploaded Documents:
${buildUploadInventoryText(merchantData, deliveredFields, skippedNotes)}

Tasks:
1. Start from the rules-based screening baseline, then adjust the score using your own underwriting judgment from the full merchant context, Persona/KYC/KYB routing or results, website review, document readiness, and uploaded evidence.
2. Return a numerical riskScore from 0 to 100.
3. Return riskCategory as Low, Medium, or High.
4. Return merchantSummary covering legal entity, business model, ownership structure, signer, processing history, sales profile, website readiness, document readiness, and Persona verification status.
5. Return 2-5 riskFactors.
6. Return missingItems as concrete follow-up items that block matching or submission.
7. Return readinessDecision as one clear decision: Ready for matching, Hold for manual review, or Missing items needed.
8. Recommend one processor from Nuvei, Payroc / Peoples, Chase.
9. Return processorFitSuggestion explaining likely fit for Nuvei, Payroc / Peoples, and Chase, not just the chosen one.
10. Explain the recommendation in reason, citing the intake facts, Persona/KYC/KYB status, website signals, completeness gaps, document evidence, and why your final score did or did not differ from the baseline.
11. Summarize structured website legitimacy and compliance review in websiteReviewSummary, including reachability, business consistency, privacy policy, terms, refund policy, contact info, shipping policy if applicable, currency display if applicable, and risk observations.
12. Summarize what the uploaded files appear to contain in documentSummary. If only metadata was available, say that clearly.
13. Cross-check merchant profile, intake completeness, document metadata, and documents against each other and return verificationStatus and verificationNotes.
14. Treat missing critical intake fields, missing expected documents, low-confidence uploads, extraction mismatches, recurring billing exposure, prior processor issues, and regulated-industry answers as real scoring signals.
15. Do not return Verified if material intake gaps, Persona/KYC/KYB gaps, website compliance gaps, or expected-document gaps remain unresolved.

Return JSON only with exactly these keys:
{
  "riskScore": number,
  "riskCategory": "Low" | "Medium" | "High",
  "riskFactors": string[],
  "recommendedProcessor": "Nuvei" | "Payroc / Peoples" | "Chase",
  "reason": string,
  "merchantSummary": string,
  "missingItems": string[],
  "readinessDecision": string,
  "processorFitSuggestion": string,
  "websiteReviewSummary": string,
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

  const bytes = decodeUploadBytes(file);
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
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    texts.push(payload.output_text);
  }

  for (const item of payload.output ?? []) {
    if (typeof item.text === 'string' && item.text.trim()) {
      texts.push(item.text);
    }

    const content = item.content;
    if (typeof content === 'string' && content.trim()) {
      texts.push(content);
      continue;
    }

    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (typeof part.text === 'string' && part.text.trim()) {
        texts.push(part.text);
      }
    }
  }
  return texts.join('\n').trim();
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json|js|javascript)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```[^\n]*\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

function findBalancedJsonObjectText(value: string): string | undefined {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (start === -1) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return undefined;
}

function parseModelJson(outputText: string): unknown {
  const stripped = stripJsonFence(outputText);
  const candidates = [
    outputText.trim(),
    stripped,
    findBalancedJsonObjectText(outputText),
    findBalancedJsonObjectText(stripped),
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()));

  for (const candidate of [...new Set(candidates)]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next recovery shape; the public error stays generic.
    }
  }

  throw new Error('xAI returned output that was not valid JSON for the underwriting schema.');
}

function isXaiRateLimitMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('xai') && (lower.includes('(429)') || lower.includes('rate limit') || lower.includes('too many requests'));
}

function isLikelyXaiModelMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('xai responses request failed') &&
    lower.includes('model') &&
    (lower.includes('not found') ||
      lower.includes('does not exist') ||
      lower.includes('unavailable') ||
      lower.includes('not supported') ||
      lower.includes('unsupported') ||
      lower.includes('invalid'))
  );
}

function shouldRetryWithFallbackModel(error: unknown): boolean {
  const message = describeError(error);
  if (isXaiRateLimitMessage(message)) return false;
  return isLikelyXaiModelMessage(message);
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

  const models = resolveXaiModels();
  const uploads = getUploadedFiles(merchantData);
  const uploadedFileIds: string[] = [];
  const deliveredFields = new Set<string>();
  const skippedNotes: string[] = [];
  const websiteReviewText = await buildWebsiteReviewText(merchantData);

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
      text: buildPromptText(merchantData, deliveredFields, skippedNotes, websiteReviewText),
    });

    let lastError: unknown;
    for (const model of models) {
      try {
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
              text: {
                format: {
                  type: 'json_schema',
                  name: 'underwriting_result',
                  schema: UNDERWRITING_RESULT_JSON_SCHEMA,
                  strict: true,
                },
              },
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
          throw new Error(`xAI responses request failed (${response.status}) for model ${model}: ${rawText.slice(0, 1000)}`);
        }

        const payload = JSON.parse(rawText) as XaiResponsesCreateResponse;
        const outputText = extractResponseText(payload);
        if (!outputText) {
          throw new Error(`xAI responses request succeeded but no output_text was returned for model ${model}: ${rawText.slice(0, 1000)}`);
        }

        return parseUnderwritingResult(parseModelJson(outputText));
      } catch (error) {
        lastError = error;
        if (!shouldRetryWithFallbackModel(error)) {
          throw error;
        }
        console.warn('[underwrite] model failed, trying xAI fallback model:', toServerLogErrorMessage(describeError(error)));
      }
    }

    throw lastError instanceof Error ? lastError : new Error('xAI responses request failed.');
  } finally {
    await Promise.all(uploadedFileIds.map((fileId) => deleteXaiFile(fileId, apiKey)));
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const protectionResponse = protectUnderwriteRoute(request);
    if (protectionResponse) {
      return protectionResponse;
    }

    const body = (await request.json()) as { merchantData?: MerchantDataLike };
    if (!isPlainObject(body) || !isPlainObject(body.merchantData)) {
      return jsonResponse({ error: 'Request body must include a merchantData object.' }, 400);
    }

    try {
      const result = await runUnderwriting(body.merchantData);
      return jsonResponse(result, 200);
    } catch (error) {
      const firstMessage = describeError(error);

      if (isXaiRateLimitMessage(firstMessage)) {
        throw error;
      }

      if (!hasBinaryAttachmentData(body.merchantData)) {
        throw error;
      }

      console.warn('[underwrite] primary attempt failed, retrying metadata-only:', toServerLogErrorMessage(firstMessage));
      const retriedResult = await runUnderwriting(stripBinaryMerchantData(body.merchantData));
      return jsonResponse(retriedResult, 200);
    }
  } catch (error) {
    const message = describeError(error);
    console.error('[underwrite] request failed:', toServerLogErrorMessage(message));
    const status = toPublicErrorStatus(message);
    return jsonResponse(
      { error: toPublicErrorMessage(message) },
      status,
      status === 429 ? { 'Retry-After': '60' } : undefined
    );
  }
}

export default {
  async fetch(request: Request) {
    return POST(request);
  },
};
