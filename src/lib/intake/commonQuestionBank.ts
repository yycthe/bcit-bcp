import type { MerchantData } from '@/src/types';

export type CommonIntakeFormId =
  | 'legalBusinessForm'
  | 'businessModelForm'
  | 'ownershipControlForm'
  | 'processingHistoryForm'
  | 'salesProfileForm'
  | 'websiteComplianceForm'
  | 'documentReadinessForm';

export type CommonFieldType = 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select';

export type CommonQuestionSpec = {
  number: number;
  prompt: string;
  mapsTo: Array<keyof MerchantData>;
  required: boolean;
  formId: CommonIntakeFormId;
  fieldId?: keyof MerchantData;
  fieldType?: CommonFieldType;
  options?: Array<{ label: string; value: string }>;
  allowNA?: boolean;
  helperText?: string;
  visibleWhen?: (answers: Partial<MerchantData>) => boolean;
  requiredWhen?: (answers: Partial<MerchantData>) => boolean;
  ruleNotes?: string[];
};

export type CommonFormFieldSpec = {
  questionNumber: number;
  id: keyof MerchantData;
  label: string;
  type: CommonFieldType;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  helperText?: string;
  visibleWhen?: (answers: Partial<MerchantData>) => boolean;
  requiredWhen?: (answers: Partial<MerchantData>) => boolean;
  ruleNotes?: string[];
};

export type CommonIntakeFormSpec = {
  id: CommonIntakeFormId;
  title: string;
  summary: string;
  questionNumbers: number[];
  fields: CommonFormFieldSpec[];
};

const YES_NO_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
  { label: 'Not sure', value: 'Not sure' },
];

const YES_NO_NA_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
  { label: 'N/A', value: 'N/A' },
  { label: 'Not sure', value: 'Not sure' },
];

const READINESS_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'Need time', value: 'Need time' },
  { label: 'Need help', value: 'Need help' },
  { label: 'No', value: 'No' },
  { label: 'N/A', value: 'N/A' },
];

const BUSINESS_ENTITY_OPTIONS = [
  { label: 'Sole proprietorship', value: 'sole_proprietorship' },
  { label: 'LLC', value: 'llc' },
  { label: 'Limited liability company', value: 'limited_liability' },
  { label: 'Corporation', value: 'corporation' },
  { label: 'Partnership', value: 'partnership' },
  { label: 'Non-profit', value: 'non_profit' },
  { label: 'Government', value: 'government' },
  { label: 'Owned by parent entity', value: 'parent_owned' },
];

const MERCHANT_TYPE_OPTIONS = [
  { label: 'Retail', value: 'Retail' },
  { label: 'E-commerce', value: 'E-commerce' },
  { label: 'MOTO / keyed', value: 'MOTO / keyed' },
  { label: 'Restaurant', value: 'Restaurant' },
  { label: 'Service', value: 'Service' },
  { label: 'Other', value: 'Other' },
];

const GOODS_OR_SERVICES_OPTIONS = [
  { label: 'Physical goods', value: 'Physical goods' },
  { label: 'Digital goods', value: 'Digital goods' },
  { label: 'Services', value: 'Services' },
  { label: 'Mix', value: 'Mix' },
];

const CUSTOMER_TYPE_OPTIONS = [
  { label: 'B2B', value: 'B2B' },
  { label: 'B2C', value: 'B2C' },
  { label: 'Both', value: 'Both' },
];

const FULFILLMENT_OPTIONS = [
  { label: 'Same day / instant', value: 'Same day / instant' },
  { label: '1-3 days', value: '1-3 days' },
  { label: '4-7 days', value: '4-7 days' },
  { label: '8-30 days', value: '8-30 days' },
  { label: 'Over 30 days', value: 'Over 30 days' },
];

const PAYMENT_TYPES_OPTIONS = [
  { label: 'Visa / Mastercard', value: 'Visa / Mastercard' },
  { label: 'Visa / Mastercard / Amex', value: 'Visa / Mastercard / Amex' },
  { label: 'Cards + Interac', value: 'Cards + Interac' },
  { label: 'Cards + ACH / bank debit', value: 'Cards + ACH / bank debit' },
  { label: 'Full mix', value: 'Visa / Mastercard / Amex / Interac / ACH' },
];

function normalizeAnswer(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isYes(value: unknown): boolean {
  return normalizeAnswer(value) === 'yes';
}

function hasWebsite(answers: Partial<MerchantData>): boolean {
  const website = normalizeAnswer(answers.website);
  return Boolean(website) && !['n/a', 'na', 'none', 'no website'].includes(website);
}

function mentionsAny(value: unknown, terms: string[]): boolean {
  const normalized = normalizeAnswer(value);
  return terms.some((term) => normalized.includes(term));
}

function needsWebsiteQuestions(answers: Partial<MerchantData>): boolean {
  return (
    hasWebsite(answers) ||
    mentionsAny(answers.businessCategory, ['e-commerce', 'moto', 'keyed']) ||
    mentionsAny(answers.goodsOrServicesType, ['digital']) ||
    mentionsAny(answers.transactionChannelSplit, ['e-commerce', 'moto', 'keyed']) ||
    isYes(answers.recurringBilling)
  );
}

/**
 * Strict master-list implementation of Layer 1 only.
 * These questions are the only shared intake questions before processor-specific follow-up.
 */
export const COMMON_QUESTION_BANK: CommonQuestionSpec[] = [
  {
    number: 1,
    prompt: 'What is your legal business name?',
    mapsTo: ['legalName'],
    required: true,
    formId: 'legalBusinessForm',
    fieldId: 'legalName',
    fieldType: 'text',
  },
  {
    number: 2,
    prompt: 'What is your DBA / operating / trade name?',
    mapsTo: ['dbaName'],
    required: true,
    formId: 'legalBusinessForm',
    fieldId: 'dbaName',
    fieldType: 'text',
    allowNA: true,
    ruleNotes: ['If the merchant has no DBA, N/A is acceptable.'],
  },
  {
    number: 3,
    prompt: 'What type of business entity are you?',
    mapsTo: ['businessType'],
    required: true,
    formId: 'legalBusinessForm',
    fieldId: 'businessType',
    fieldType: 'select',
    options: BUSINESS_ENTITY_OPTIONS,
    ruleNotes: ['Affects later KYC / KYB triggering.'],
  },
  {
    number: 4,
    prompt: 'What is your business registration / corporation / GST/HST number?',
    mapsTo: ['businessRegistrationNumber'],
    required: true,
    formId: 'legalBusinessForm',
    fieldId: 'businessRegistrationNumber',
    fieldType: 'text',
    ruleNotes: ['If none exists, record missing_core_business_registration_info = yes.'],
  },
  {
    number: 5,
    prompt: 'When was the business established or incorporated?',
    mapsTo: ['establishedDate'],
    required: true,
    formId: 'legalBusinessForm',
    fieldId: 'establishedDate',
    fieldType: 'date',
  },
  {
    number: 6,
    prompt: 'What is your legal business address?',
    mapsTo: ['legalBusinessAddress'],
    required: true,
    formId: 'legalBusinessForm',
    fieldId: 'legalBusinessAddress',
    fieldType: 'text',
  },
  {
    number: 7,
    prompt: 'Is your operating address different from your legal address?',
    mapsTo: ['operatingAddressDifferent'],
    required: true,
    formId: 'legalBusinessForm',
    fieldId: 'operatingAddressDifferent',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
  },
  {
    number: 8,
    prompt: 'What is your operating address?',
    mapsTo: ['operatingAddress'],
    required: false,
    formId: 'legalBusinessForm',
    fieldId: 'operatingAddress',
    fieldType: 'text',
    helperText: 'Only needed when your operating location is different from the legal entity address.',
    visibleWhen: (answers) => isYes(answers.operatingAddressDifferent),
    requiredWhen: (answers) => isYes(answers.operatingAddressDifferent),
    ruleNotes: ['Ask only if Question 7 = Yes.'],
  },
  {
    number: 9,
    prompt: 'What is your business phone number?',
    mapsTo: ['businessPhone'],
    required: true,
    formId: 'legalBusinessForm',
    fieldId: 'businessPhone',
    fieldType: 'text',
  },
  {
    number: 10,
    prompt: 'What is your legal business email?',
    mapsTo: ['legalBusinessEmail'],
    required: true,
    formId: 'legalBusinessForm',
    fieldId: 'legalBusinessEmail',
    fieldType: 'email',
  },
  {
    number: 11,
    prompt: 'What is your website URL?',
    mapsTo: ['website'],
    required: true,
    formId: 'legalBusinessForm',
    fieldId: 'website',
    fieldType: 'text',
    allowNA: true,
    ruleNotes: ['N/A is acceptable. If later answers imply e-commerce / digital / recurring and website is N/A, record website_gap = yes.'],
  },
  {
    number: 12,
    prompt: 'What products or services do you sell?',
    mapsTo: ['productsServices'],
    required: true,
    formId: 'legalBusinessForm',
    fieldId: 'productsServices',
    fieldType: 'textarea',
  },
  {
    number: 13,
    prompt: 'Please describe your business in detail.',
    mapsTo: ['businessDescription'],
    required: true,
    formId: 'legalBusinessForm',
    fieldId: 'businessDescription',
    fieldType: 'textarea',
    ruleNotes: ['If too vague, record insufficient_business_description = yes.'],
  },
  {
    number: 14,
    prompt: 'What type of merchant are you?',
    mapsTo: ['businessCategory'],
    required: true,
    formId: 'businessModelForm',
    fieldId: 'businessCategory',
    fieldType: 'select',
    options: MERCHANT_TYPE_OPTIONS,
  },
  {
    number: 15,
    prompt: 'Do you sell physical goods, digital goods, services, or a mix?',
    mapsTo: ['goodsOrServicesType'],
    required: true,
    formId: 'businessModelForm',
    fieldId: 'goodsOrServicesType',
    fieldType: 'select',
    options: GOODS_OR_SERVICES_OPTIONS,
  },
  {
    number: 16,
    prompt: 'Are your customers B2B, B2C, or both?',
    mapsTo: ['customerType'],
    required: true,
    formId: 'businessModelForm',
    fieldId: 'customerType',
    fieldType: 'select',
    options: CUSTOMER_TYPE_OPTIONS,
  },
  {
    number: 17,
    prompt: 'Is payment taken in advance before fulfillment?',
    mapsTo: ['advancePayment'],
    required: true,
    formId: 'businessModelForm',
    fieldId: 'advancePayment',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    ruleNotes: ['If Yes, record advance_payment = yes. Do not expand timing here.'],
  },
  {
    number: 18,
    prompt: 'Do you offer recurring billing or subscriptions?',
    mapsTo: ['recurringBilling'],
    required: true,
    formId: 'businessModelForm',
    fieldId: 'recurringBilling',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    ruleNotes: ['If Yes, record recurring = yes. Do not expand timing here.'],
  },
  {
    number: 19,
    prompt: 'How long does it usually take for customers to receive the product or service?',
    mapsTo: ['fulfillmentTimeline'],
    required: true,
    formId: 'businessModelForm',
    fieldId: 'fulfillmentTimeline',
    fieldType: 'select',
    options: FULFILLMENT_OPTIONS,
    ruleNotes: ['If delayed or long, record fulfillment_timing_flag = yes.'],
  },
  {
    number: 20,
    prompt: 'Please list all beneficial owners with 25% or more ownership.',
    mapsTo: ['beneficialOwners'],
    required: true,
    formId: 'ownershipControlForm',
    fieldId: 'beneficialOwners',
    fieldType: 'textarea',
    ruleNotes: ['At minimum, collect full name and ownership %.'],
  },
  {
    number: 21,
    prompt: 'Is the business owned by another company or parent entity?',
    mapsTo: ['parentOwned'],
    required: true,
    formId: 'ownershipControlForm',
    fieldId: 'parentOwned',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    ruleNotes: ['If Yes, record parent_entity = yes.'],
  },
  {
    number: 22,
    prompt: 'Is there anyone with significant managerial control who is not an owner?',
    mapsTo: ['nonOwnerController'],
    required: true,
    formId: 'ownershipControlForm',
    fieldId: 'nonOwnerController',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    ruleNotes: ['If Yes, record non_owner_control = yes.'],
  },
  {
    number: 23,
    prompt: 'Who is the authorized signer for this application?',
    mapsTo: ['authorizedSignerName', 'authorizedSignerTitle', 'authorizedSignerEmail'],
    required: true,
    formId: 'ownershipControlForm',
    fieldId: 'authorizedSignerName',
    fieldType: 'text',
    ruleNotes: ['Collect signer identity basics.'],
  },
  {
    number: 24,
    prompt: 'Is the signer one of the owners listed above?',
    mapsTo: ['signerIsOwner'],
    required: true,
    formId: 'ownershipControlForm',
    fieldId: 'signerIsOwner',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    ruleNotes: ['If No, record separate_signer = yes.'],
  },
  {
    number: 25,
    prompt: 'Do you currently process card payments?',
    mapsTo: ['currentlyProcessesCards'],
    required: true,
    formId: 'processingHistoryForm',
    fieldId: 'currentlyProcessesCards',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
  },
  {
    number: 26,
    prompt: 'Who is your current or previous processor?',
    mapsTo: ['currentOrPreviousProcessor'],
    required: false,
    formId: 'processingHistoryForm',
    fieldId: 'currentOrPreviousProcessor',
    fieldType: 'text',
    allowNA: true,
    helperText: 'Only asked when you already process card payments today.',
    visibleWhen: (answers) => isYes(answers.currentlyProcessesCards),
    requiredWhen: (answers) => isYes(answers.currentlyProcessesCards),
    ruleNotes: ['If Question 25 = No, N/A is acceptable.'],
  },
  {
    number: 27,
    prompt: 'Why are you leaving your current / previous processor?',
    mapsTo: ['processorExitReason'],
    required: false,
    formId: 'processingHistoryForm',
    fieldId: 'processorExitReason',
    fieldType: 'textarea',
    allowNA: true,
    helperText: 'Only asked for merchants that already process cards.',
    visibleWhen: (answers) => isYes(answers.currentlyProcessesCards),
    requiredWhen: (answers) => isYes(answers.currentlyProcessesCards),
    ruleNotes: ['If Question 25 = No, N/A is acceptable.'],
  },
  {
    number: 28,
    prompt: 'Has the business or any owner ever had a merchant account or processing agreement terminated?',
    mapsTo: ['priorTermination'],
    required: true,
    formId: 'processingHistoryForm',
    fieldId: 'priorTermination',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    ruleNotes: ['If Yes, record termination_history = yes.'],
  },
  {
    number: 29,
    prompt: 'Has the business or any owner ever filed for bankruptcy?',
    mapsTo: ['bankruptcyHistory'],
    required: true,
    formId: 'processingHistoryForm',
    fieldId: 'bankruptcyHistory',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    ruleNotes: ['If Yes, record bankruptcy_history = yes.'],
  },
  {
    number: 30,
    prompt: 'Has the business or any owner ever been identified in a Visa / Mastercard risk program?',
    mapsTo: ['riskProgramHistory'],
    required: true,
    formId: 'processingHistoryForm',
    fieldId: 'riskProgramHistory',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    ruleNotes: ['If Yes, record risk_program_history = yes.'],
  },
  {
    number: 31,
    prompt: 'What is your estimated monthly processing volume?',
    mapsTo: ['monthlyVolume'],
    required: true,
    formId: 'salesProfileForm',
    ruleNotes: ['Already captured as a dedicated button step in the current chatbot flow.'],
  },
  {
    number: 32,
    prompt: 'What is your average transaction amount?',
    mapsTo: ['avgTicketSize'],
    required: true,
    formId: 'salesProfileForm',
    fieldId: 'avgTicketSize',
    fieldType: 'number',
  },
  {
    number: 33,
    prompt: 'What is your highest transaction amount?',
    mapsTo: ['highestTicketAmount'],
    required: true,
    formId: 'salesProfileForm',
    fieldId: 'highestTicketAmount',
    fieldType: 'number',
  },
  {
    number: 34,
    prompt: 'What percentage of your transactions are card present, e-commerce, and MOTO / keyed?',
    mapsTo: ['transactionChannelSplit'],
    required: true,
    formId: 'salesProfileForm',
    fieldId: 'transactionChannelSplit',
    fieldType: 'text',
    ruleNotes: ['If the total does not cleanly reach 100%, record later_clarification_required = yes.'],
  },
  {
    number: 35,
    prompt: 'Which payment types do you want to accept?',
    mapsTo: ['paymentTypesWanted'],
    required: true,
    formId: 'salesProfileForm',
    fieldId: 'paymentTypesWanted',
    fieldType: 'select',
    options: PAYMENT_TYPES_OPTIONS,
  },
  {
    number: 36,
    prompt: 'What percentage of your transactions are recurring?',
    mapsTo: ['recurringTransactionsPercent'],
    required: false,
    formId: 'salesProfileForm',
    fieldId: 'recurringTransactionsPercent',
    fieldType: 'text',
    helperText: 'Only needed when you offer recurring billing or subscriptions.',
    visibleWhen: (answers) => isYes(answers.recurringBilling),
    requiredWhen: (answers) => isYes(answers.recurringBilling),
    ruleNotes: ['If Question 18 = No but this is greater than 0, record recurring_inconsistency = yes.'],
  },
  {
    number: 37,
    prompt: 'What percentage of your transactions involve foreign cards?',
    mapsTo: ['foreignCardsPercent'],
    required: true,
    formId: 'salesProfileForm',
    fieldId: 'foreignCardsPercent',
    fieldType: 'text',
  },
  {
    number: 38,
    prompt: 'Does your website include a Privacy Policy?',
    mapsTo: ['websitePrivacyPolicy'],
    required: false,
    formId: 'websiteComplianceForm',
    fieldId: 'websitePrivacyPolicy',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    helperText: 'Shown when your business has a website or an online payment flow.',
    visibleWhen: needsWebsiteQuestions,
    requiredWhen: needsWebsiteQuestions,
  },
  {
    number: 39,
    prompt: 'Does your website include Terms and Conditions / Terms of Use?',
    mapsTo: ['websiteTerms'],
    required: false,
    formId: 'websiteComplianceForm',
    fieldId: 'websiteTerms',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    visibleWhen: needsWebsiteQuestions,
    requiredWhen: needsWebsiteQuestions,
  },
  {
    number: 40,
    prompt: 'Does your website include a Return / Refund Policy?',
    mapsTo: ['websiteRefundPolicy'],
    required: false,
    formId: 'websiteComplianceForm',
    fieldId: 'websiteRefundPolicy',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    visibleWhen: needsWebsiteQuestions,
    requiredWhen: needsWebsiteQuestions,
  },
  {
    number: 41,
    prompt: 'Does your website include customer service contact information?',
    mapsTo: ['websiteContactInfo'],
    required: false,
    formId: 'websiteComplianceForm',
    fieldId: 'websiteContactInfo',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    visibleWhen: needsWebsiteQuestions,
    requiredWhen: needsWebsiteQuestions,
  },
  {
    number: 42,
    prompt: 'Is your payment page encrypted with SSL or better?',
    mapsTo: ['websiteSsl'],
    required: false,
    formId: 'websiteComplianceForm',
    fieldId: 'websiteSsl',
    fieldType: 'select',
    options: YES_NO_NA_OPTIONS,
    visibleWhen: needsWebsiteQuestions,
    requiredWhen: needsWebsiteQuestions,
    ruleNotes: ['If there is no website or no online payments, N/A is acceptable.'],
  },
  {
    number: 43,
    prompt: 'Do you store credit card numbers?',
    mapsTo: ['storesCardNumbers'],
    required: true,
    formId: 'websiteComplianceForm',
    fieldId: 'storesCardNumbers',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
  },
  {
    number: 44,
    prompt: 'Do you use any third-party applications to process, transmit, or store cardholder data?',
    mapsTo: ['thirdPartyCardApps'],
    required: false,
    formId: 'websiteComplianceForm',
    fieldId: 'thirdPartyCardApps',
    fieldType: 'textarea',
    helperText: 'Only needed when you rely on external payment, gateway, cart, or storage tools.',
    visibleWhen: (answers) => needsWebsiteQuestions(answers) || isYes(answers.currentlyProcessesCards),
    requiredWhen: (answers) => needsWebsiteQuestions(answers) || isYes(answers.currentlyProcessesCards),
    ruleNotes: ['If Yes, ask the merchant to list them.'],
  },
  {
    number: 45,
    prompt: 'Have you experienced a data breach or card data compromise in the past?',
    mapsTo: ['dataBreachHistory'],
    required: true,
    formId: 'websiteComplianceForm',
    fieldId: 'dataBreachHistory',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    ruleNotes: ['If Yes, record data_breach_history = yes.'],
  },
  {
    number: 46,
    prompt: 'Is your business an MSB or another regulated business?',
    mapsTo: ['regulatedBusiness'],
    required: true,
    formId: 'websiteComplianceForm',
    fieldId: 'regulatedBusiness',
    fieldType: 'select',
    options: YES_NO_OPTIONS,
    ruleNotes: ['If Yes, record regulated_business = yes.'],
  },
  {
    number: 47,
    prompt: 'Can you provide Business Registration or Articles of Incorporation?',
    mapsTo: ['canProvideRegistration'],
    required: true,
    formId: 'documentReadinessForm',
    fieldId: 'canProvideRegistration',
    fieldType: 'select',
    options: READINESS_OPTIONS,
  },
  {
    number: 48,
    prompt: 'Can you provide a Void Cheque or Bank Letter?',
    mapsTo: ['canProvideVoidCheque'],
    required: true,
    formId: 'documentReadinessForm',
    fieldId: 'canProvideVoidCheque',
    fieldType: 'select',
    options: READINESS_OPTIONS,
  },
  {
    number: 49,
    prompt: 'Can you provide 2 recent official business bank statements?',
    mapsTo: ['canProvideBankStatements'],
    required: true,
    formId: 'documentReadinessForm',
    fieldId: 'canProvideBankStatements',
    fieldType: 'select',
    options: READINESS_OPTIONS,
  },
  {
    number: 50,
    prompt: 'Can you provide proof of business address?',
    mapsTo: ['canProvideProofOfAddress'],
    required: true,
    formId: 'documentReadinessForm',
    fieldId: 'canProvideProofOfAddress',
    fieldType: 'select',
    options: READINESS_OPTIONS,
  },
  {
    number: 51,
    prompt: 'Can you provide proof of ownership?',
    mapsTo: ['canProvideProofOfOwnership'],
    required: true,
    formId: 'documentReadinessForm',
    fieldId: 'canProvideProofOfOwnership',
    fieldType: 'select',
    options: READINESS_OPTIONS,
  },
  {
    number: 52,
    prompt: 'Can each 25%+ owner and the signer provide government-issued photo ID?',
    mapsTo: ['canProvideOwnerIds'],
    required: true,
    formId: 'documentReadinessForm',
    fieldId: 'canProvideOwnerIds',
    fieldType: 'select',
    options: READINESS_OPTIONS,
  },
  {
    number: 53,
    prompt: 'If you currently process payments, can you provide 3 recent processing statements?',
    mapsTo: ['canProvideProcessingStatements'],
    required: false,
    formId: 'documentReadinessForm',
    fieldId: 'canProvideProcessingStatements',
    fieldType: 'select',
    options: READINESS_OPTIONS,
    helperText: 'Only asked for merchants with an existing processing relationship.',
    visibleWhen: (answers) => isYes(answers.currentlyProcessesCards),
    requiredWhen: (answers) => isYes(answers.currentlyProcessesCards),
    ruleNotes: ['Only applies if Question 25 = Yes. Otherwise record processing_statements = N/A.'],
  },
];

export const COMMON_INTAKE_FORM_SEQUENCE: CommonIntakeFormId[] = [
  'legalBusinessForm',
  'businessModelForm',
  'ownershipControlForm',
  'processingHistoryForm',
  'salesProfileForm',
  'websiteComplianceForm',
  'documentReadinessForm',
];

export const COMMON_INTAKE_FORMS: Record<CommonIntakeFormId, CommonIntakeFormSpec> = {
  legalBusinessForm: {
    id: 'legalBusinessForm',
    title: 'Legal business information',
    summary: 'Legal identity, core business facts, and descriptive context from the shared common intake.',
    questionNumbers: COMMON_QUESTION_BANK.filter((q) => q.formId === 'legalBusinessForm').map((q) => q.number),
    fields: COMMON_QUESTION_BANK.filter((q) => q.formId === 'legalBusinessForm' && q.fieldId && q.fieldType).map((q) => ({
      questionNumber: q.number,
      id: q.fieldId!,
      label: q.prompt,
      type: q.fieldType!,
      required: q.required,
      options: q.options,
      helperText: q.helperText,
      visibleWhen: q.visibleWhen,
      requiredWhen: q.requiredWhen,
      ruleNotes: q.ruleNotes,
    })),
  },
  businessModelForm: {
    id: 'businessModelForm',
    title: 'Business model',
    summary: 'Merchant type, fulfillment, advance payment, and recurring billing basics from the common layer only.',
    questionNumbers: COMMON_QUESTION_BANK.filter((q) => q.formId === 'businessModelForm').map((q) => q.number),
    fields: COMMON_QUESTION_BANK.filter((q) => q.formId === 'businessModelForm' && q.fieldId && q.fieldType).map((q) => ({
      questionNumber: q.number,
      id: q.fieldId!,
      label: q.prompt,
      type: q.fieldType!,
      required: q.required,
      options: q.options,
      helperText: q.helperText,
      visibleWhen: q.visibleWhen,
      requiredWhen: q.requiredWhen,
      ruleNotes: q.ruleNotes,
    })),
  },
  ownershipControlForm: {
    id: 'ownershipControlForm',
    title: 'Ownership and control',
    summary: 'Collect only the core shared KYC / KYB ownership and signer information before processor-specific follow-up.',
    questionNumbers: COMMON_QUESTION_BANK.filter((q) => q.formId === 'ownershipControlForm').map((q) => q.number),
    fields: [
      {
        questionNumber: 20,
        id: 'beneficialOwners',
        label: 'Please list all beneficial owners with 25% or more ownership. Include full legal name, ownership %, and optionally role / email.',
        type: 'textarea',
        required: true,
        ruleNotes: ['Core KYC trigger question.'],
      },
      {
        questionNumber: 21,
        id: 'parentOwned',
        label: 'Is the business owned by another company or parent entity?',
        type: 'select',
        required: true,
        options: YES_NO_OPTIONS,
      },
      {
        questionNumber: 21,
        id: 'parentCompanyName',
        label: 'Parent company legal name.',
        type: 'text',
        required: false,
        helperText: 'Only needed when the business is owned by a parent or holding company.',
        visibleWhen: (answers) => isYes(answers.parentOwned),
        requiredWhen: (answers) => isYes(answers.parentOwned),
      },
      {
        questionNumber: 22,
        id: 'nonOwnerController',
        label: 'Is there anyone with significant managerial control who is not an owner?',
        type: 'select',
        required: true,
        options: YES_NO_OPTIONS,
      },
      {
        questionNumber: 22,
        id: 'nonOwnerControllerDetails',
        label: 'Name and role of the non-owner controller.',
        type: 'text',
        required: false,
        helperText: 'Only needed when a non-owner has significant managerial control.',
        visibleWhen: (answers) => isYes(answers.nonOwnerController),
        requiredWhen: (answers) => isYes(answers.nonOwnerController),
      },
      {
        questionNumber: 23,
        id: 'authorizedSignerName',
        label: 'Who is the authorized signer for this application? Name.',
        type: 'text',
        required: true,
      },
      {
        questionNumber: 23,
        id: 'authorizedSignerTitle',
        label: 'Authorized signer title.',
        type: 'text',
        required: true,
      },
      {
        questionNumber: 23,
        id: 'authorizedSignerEmail',
        label: 'Authorized signer email.',
        type: 'email',
        required: true,
      },
      {
        questionNumber: 24,
        id: 'signerIsOwner',
        label: 'Is the signer one of the owners listed above?',
        type: 'select',
        required: true,
        options: YES_NO_OPTIONS,
      },
    ],
  },
  processingHistoryForm: {
    id: 'processingHistoryForm',
    title: 'Processing history',
    summary: 'Current processor, exit reason, and adverse processing history from the common layer.',
    questionNumbers: COMMON_QUESTION_BANK.filter((q) => q.formId === 'processingHistoryForm').map((q) => q.number),
    fields: [
      ...COMMON_QUESTION_BANK.filter((q) => q.formId === 'processingHistoryForm' && q.fieldId && q.fieldType).map((q) => ({
        questionNumber: q.number,
        id: q.fieldId!,
        label: q.prompt,
        type: q.fieldType!,
        required: q.required,
        options: q.options,
        helperText: q.helperText,
        visibleWhen: q.visibleWhen,
        requiredWhen: q.requiredWhen,
        ruleNotes: q.ruleNotes,
      })),
      {
        questionNumber: 28,
        id: 'priorTerminationExplanation',
        label: 'If yes, what happened and when?',
        type: 'textarea',
        required: false,
        helperText: 'Only needed when there has been a prior processing termination.',
        visibleWhen: (answers) => isYes(answers.priorTermination),
        requiredWhen: (answers) => isYes(answers.priorTermination),
      },
      {
        questionNumber: 29,
        id: 'bankruptcyExplanation',
        label: 'If yes, please provide the year and a short explanation.',
        type: 'textarea',
        required: false,
        helperText: 'Only needed when there is bankruptcy history.',
        visibleWhen: (answers) => isYes(answers.bankruptcyHistory),
        requiredWhen: (answers) => isYes(answers.bankruptcyHistory),
      },
      {
        questionNumber: 30,
        id: 'riskProgramExplanation',
        label: 'If yes, which program and what was the outcome?',
        type: 'textarea',
        required: false,
        helperText: 'Only needed when a Visa or Mastercard risk program has been involved.',
        visibleWhen: (answers) => isYes(answers.riskProgramHistory),
        requiredWhen: (answers) => isYes(answers.riskProgramHistory),
      },
    ],
  },
  salesProfileForm: {
    id: 'salesProfileForm',
    title: 'Sales profile',
    summary: 'Monthly volume plus transaction amounts, channel mix, recurring %, and foreign-card exposure.',
    questionNumbers: COMMON_QUESTION_BANK.filter((q) => q.formId === 'salesProfileForm').map((q) => q.number),
    fields: COMMON_QUESTION_BANK.filter((q) => q.formId === 'salesProfileForm' && q.fieldId && q.fieldType).map((q) => ({
      questionNumber: q.number,
      id: q.fieldId!,
      label: q.prompt,
      type: q.fieldType!,
      required: q.required,
      options: q.options,
      helperText: q.helperText,
      visibleWhen: q.visibleWhen,
      requiredWhen: q.requiredWhen,
      ruleNotes: q.ruleNotes,
    })),
  },
  websiteComplianceForm: {
    id: 'websiteComplianceForm',
    title: 'Website / compliance / PCI basics',
    summary: 'Shared website, PCI, breach, and regulated-business questions only.',
    questionNumbers: COMMON_QUESTION_BANK.filter((q) => q.formId === 'websiteComplianceForm').map((q) => q.number),
    fields: COMMON_QUESTION_BANK.filter((q) => q.formId === 'websiteComplianceForm' && q.fieldId && q.fieldType).map((q) => ({
      questionNumber: q.number,
      id: q.fieldId!,
      label: q.prompt,
      type: q.fieldType!,
      required: q.required,
      options: q.options,
      helperText: q.helperText,
      visibleWhen: q.visibleWhen,
      requiredWhen: q.requiredWhen,
      ruleNotes: q.ruleNotes,
    })),
  },
  documentReadinessForm: {
    id: 'documentReadinessForm',
    title: 'Core document readiness',
    summary: 'Shared readiness questions for the core business and owner documents only.',
    questionNumbers: COMMON_QUESTION_BANK.filter((q) => q.formId === 'documentReadinessForm').map((q) => q.number),
    fields: COMMON_QUESTION_BANK.filter((q) => q.formId === 'documentReadinessForm' && q.fieldId && q.fieldType).map((q) => ({
      questionNumber: q.number,
      id: q.fieldId!,
      label: q.prompt,
      type: q.fieldType!,
      required: q.required,
      options: q.options,
      helperText: q.helperText,
      visibleWhen: q.visibleWhen,
      requiredWhen: q.requiredWhen,
      ruleNotes: q.ruleNotes,
    })),
  },
};

export function getCommonIntakeFormSpec(formId: CommonIntakeFormId): CommonIntakeFormSpec {
  return COMMON_INTAKE_FORMS[formId];
}

export function getCommonQuestion(number: number): CommonQuestionSpec | undefined {
  return COMMON_QUESTION_BANK.find((question) => question.number === number);
}
