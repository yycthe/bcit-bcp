import type { MerchantData } from '@/src/types';
import { initialMerchantData } from '@/src/types';

/**
 * Pre-filled demo profile for presentations (Software / SaaS, Canada, moderate volume).
 * Forms use `defaultValue={data[field]}`; text/dropdown steps sync via ChatApp effect.
 */
export const demoMerchantData: MerchantData = {
  ...initialMerchantData,
  businessType: 'llc',
  country: 'CA',
  industry: 'software',
  monthlyVolume: '10k-50k',
  monthlyTransactions: '100-1k',
  legalName: 'Northwind Analytics Inc.',
  taxId: 'BN 123456789',
  ownerName: 'Alex Chen',
  website: 'https://northwind-demo.example',
  staffSize: '18',
  paymentProducts: 'Cards, ACH, Apple Pay',
  businessCategory: 'B2B SaaS — analytics',

  generalEmail: 'hello@northwind-demo.example',
  supportEmail: 'support@northwind-demo.example',
  disputesEmail: 'risk@northwind-demo.example',
  phone: '+1 604 555 0142',
  preferredContact: 'Email',
  socialPresence: 'LinkedIn, X',

  registeredAddress: '400 Granville Street, Suite 1200',
  operatingAddress: 'Same as registered',
  city: 'Vancouver',
  region: 'BC',
  province: 'British Columbia',
  operatingDiffers: 'no',

  timeInBusiness: '3 years',
  targetGeography: 'Canada & United States',
  deliveryMethod: 'N/A — digital product',
  domesticVsInternational: '85% domestic / 15% international',

  avgTxnCount: '450',
  minTxnCount: '200',
  maxTxnCount: '900',
  avgTicketSize: '89',
  domesticCrossBorderSplit: '85% domestic / 15% cross-border',
  processingCurrencies: 'CAD, USD',

  recurringBillingDetails: 'Monthly and annual SaaS subscriptions',
  trialPeriod: '14-day trial',
  refundPolicy: 'Pro-rated refunds within 30 days',
  shippingPolicy: 'N/A',

  ownershipPercentage: '100',
  ownerRole: 'CEO & Founder',
  ownerEmail: 'alex.chen@northwind-demo.example',
  ownerIdNumber: 'DL-BC-DEMO-90210',
  ownerIdExpiry: '2028-06-30',
  ownerCountryOfResidence: 'CA',

  bankName: 'TD Canada Trust',
  accountHolderName: 'Northwind Analytics Inc.',
  accountNumber: '****4521 (demo)',
  routingNumber: '004',
  settlementCurrency: 'CAD',

  complianceDetails: 'SOC 2 Type II in progress; vendor security reviews annually.',

  // Files left null so demo can show “missing documents” in Admin; use Skip in intake or “Jump to review”.
  idUpload: null,
  proofOfAddress: null,
  registrationCertificate: null,
  taxDocument: null,
  proofOfFunds: null,
  bankStatement: null,
  financials: null,
  complianceDocument: null,
  enhancedVerification: null,

  additionalDocuments: [],
};
