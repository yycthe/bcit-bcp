export type BusinessType = 'sole_proprietorship' | 'llc' | 'corporation' | 'partnership' | '';
export type Country = 'US' | 'CA' | 'UK' | 'EU' | 'Other' | '';
export type Industry = 'retail' | 'software' | 'services' | 'high_risk' | 'crypto' | 'gaming' | '';
export type MonthlyVolume = '<10k' | '10k-50k' | '50k-250k' | '>250k' | '';
export type MonthlyTransactions = '<100' | '100-1k' | '1k-10k' | '>10k' | '';

export interface FileData {
  id?: string;
  name: string;
  mimeType: string;
  data: string; // base64 encoded string
  uploadDate?: string;
  documentType?: string;
  status?: 'Uploaded' | 'Extracting' | 'Verified' | 'Needs review' | 'Mismatch' | 'Missing';
  extractedFields?: Record<string, string>;
  confidence?: number;
  linkedRequirement?: string;
}

export type ApplicationStatus = 'draft' | 'under_review' | 'approved' | 'signed';

export interface MerchantData {
  businessType: BusinessType;
  country: Country;
  industry: Industry;
  monthlyVolume: MonthlyVolume;
  monthlyTransactions: MonthlyTransactions;
  legalName: string;
  taxId: string;
  ownerName: string;
  website: string;
  
  // 1. Business Details
  staffSize: string;
  paymentProducts: string;
  businessCategory: string;

  // 2. Contact Details
  generalEmail: string;
  supportEmail: string;
  disputesEmail: string;
  phone: string;
  preferredContact: string;
  socialPresence: string;

  // 3. Address Details
  registeredAddress: string;
  operatingAddress: string;
  city: string;
  region: string;
  province: string;
  operatingDiffers: string;

  // 4. Business Information
  timeInBusiness: string;
  targetGeography: string;
  deliveryMethod: string;
  domesticVsInternational: string;

  // 5. Transaction Details
  avgTxnCount: string;
  minTxnCount: string;
  maxTxnCount: string;
  avgTicketSize: string;
  domesticCrossBorderSplit: string;
  processingCurrencies: string;
  recurringBillingDetails?: string;
  refundPolicy?: string;
  shippingPolicy?: string;
  
  // Subscription-specific
  trialPeriod?: string;
  churnRate?: string;
  
  // Retail-specific
  avgDeliveryTime?: string;
  
  // Crypto-specific
  cryptoServices?: string;
  amlKycProcedures?: string;
  cryptoLicenses?: string;
  custodyArrangement?: string;
  
  // Gaming-specific
  gamingType?: string;
  gamingLicenses?: string;
  responsibleGaming?: string;
  ageVerification?: string;
  
  // Services-specific
  serviceType?: string;
  billingModel?: string;
  contractLength?: string;
  
  // High-risk specific
  businessDescription?: string;
  regulatoryStatus?: string;
  chargebackHistory?: string;
  previousProcessors?: string;

  // 6. Business Owners
  ownershipPercentage: string;
  ownerRole: string;
  ownerEmail: string;
  ownerIdNumber: string;
  ownerIdExpiry: string;
  ownerCountryOfResidence: string;

  // 7. Bank Account
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  routingNumber: string;
  settlementCurrency: string;

  // 8. Document Verification
  idUpload: FileData | null;
  proofOfAddress: FileData | null;
  registrationCertificate: FileData | null;
  taxDocument: FileData | null;
  proofOfFunds: FileData | null;
  bankStatement: FileData | null;
  financials: FileData | null;
  complianceDocument: FileData | null;

  // Existing / Conditional
  complianceDetails: string;
  enhancedVerification: FileData | null;
  additionalDocuments?: FileData[];
}

export const initialMerchantData: MerchantData = {
  businessType: '',
  country: '',
  industry: '',
  monthlyVolume: '',
  monthlyTransactions: '',
  legalName: '',
  taxId: '',
  ownerName: '',
  website: '',
  
  staffSize: '',
  paymentProducts: '',
  businessCategory: '',

  generalEmail: '',
  supportEmail: '',
  disputesEmail: '',
  phone: '',
  preferredContact: '',
  socialPresence: '',

  registeredAddress: '',
  operatingAddress: '',
  city: '',
  region: '',
  province: '',
  operatingDiffers: '',

  timeInBusiness: '',
  targetGeography: '',
  deliveryMethod: '',
  domesticVsInternational: '',

  avgTxnCount: '',
  minTxnCount: '',
  maxTxnCount: '',
  avgTicketSize: '',
  domesticCrossBorderSplit: '',
  processingCurrencies: '',
  recurringBillingDetails: '',
  refundPolicy: '',
  shippingPolicy: '',
  
  trialPeriod: '',
  churnRate: '',
  avgDeliveryTime: '',
  cryptoServices: '',
  amlKycProcedures: '',
  cryptoLicenses: '',
  custodyArrangement: '',
  gamingType: '',
  gamingLicenses: '',
  responsibleGaming: '',
  ageVerification: '',
  serviceType: '',
  billingModel: '',
  contractLength: '',
  businessDescription: '',
  regulatoryStatus: '',
  chargebackHistory: '',
  previousProcessors: '',

  ownershipPercentage: '',
  ownerRole: '',
  ownerEmail: '',
  ownerIdNumber: '',
  ownerIdExpiry: '',
  ownerCountryOfResidence: '',

  bankName: '',
  accountHolderName: '',
  accountNumber: '',
  routingNumber: '',
  settlementCurrency: '',

  idUpload: null,
  proofOfAddress: null,
  registrationCertificate: null,
  taxDocument: null,
  proofOfFunds: null,
  bankStatement: null,
  financials: null,
  complianceDocument: null,

  complianceDetails: '',
  enhancedVerification: null,
  additionalDocuments: [],
};
