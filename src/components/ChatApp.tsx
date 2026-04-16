import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Upload, CheckCircle2, FileText, ShieldCheck, AlertCircle, Building, Zap, Globe, RefreshCcw, Activity, Building2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Select } from '@/src/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { toast } from 'sonner';
import { MerchantData, FileData } from '@/src/types';
import { getFallbackUnderwriting } from '@/src/lib/underwritingFallback';
import { runLocalVerificationCheck } from '@/src/lib/localVerification';
import { prepareFileForUpload } from '@/src/lib/uploadPreparation';
import {
  buildPersonaSummary,
  buildProcessorReadyPackageSummary,
  buildWebsiteSignalSummary,
  decidePersonaInvites,
  getProcessorQuestionSet,
  getProcessorQuestionPrompt,
  normalizeProcessorFit,
} from '@/src/lib/onboardingWorkflow';
import {
  MERCHANT_FILE_QUESTION_KEYS,
  MERCHANT_DOCUMENT_LABELS,
  getMissingDocumentKeys,
  getNextMissingInTourOrder,
  type MerchantDocumentKey,
} from '@/src/lib/documentChecklist';

const MERCHANT_FILE_QUESTION_ID_SET = new Set<string>(MERCHANT_FILE_QUESTION_KEYS);

const YES_NO_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
  { label: 'Not sure', value: 'Not sure' },
];

const YES_NO_NA_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
  { label: 'Not applicable', value: 'Not applicable' },
  { label: 'Not sure', value: 'Not sure' },
];

const READINESS_OPTIONS = [
  { label: 'Yes, ready now', value: 'Yes' },
  { label: 'Can provide, needs time', value: 'Need time' },
  { label: 'Need help', value: 'Need help' },
  { label: 'No', value: 'No' },
  { label: 'Not applicable', value: 'Not applicable' },
];

const PERCENT_RANGE_OPTIONS = [
  { label: '0%', value: '0%' },
  { label: '1-10%', value: '1-10%' },
  { label: '11-25%', value: '11-25%' },
  { label: '26-50%', value: '26-50%' },
  { label: '51-75%', value: '51-75%' },
  { label: '76-100%', value: '76-100%' },
  { label: 'Not sure', value: 'Not sure' },
];

const PROCESSOR_FOLLOW_UP_STATUS_OPTIONS = [
  { label: 'Ready / available', value: 'Ready / available' },
  { label: 'Need help', value: 'Need help' },
  { label: 'Not applicable', value: 'Not applicable' },
  { label: 'Needs manual review', value: 'Needs manual review' },
];

type QuestionId =
  | Exclude<keyof MerchantData, 'additionalDocuments'>
  | 'done'
  | 'legalBusinessForm'
  | 'businessModelForm'
  | 'ownershipControlForm'
  | 'processingHistoryForm'
  | 'salesProfileForm'
  | 'websiteComplianceForm'
  | 'documentReadinessForm'
  | 'personaDecisionGate'
  | 'processorSpecificFollowUpForm';

interface QuestionDef {
  id: QuestionId;
  text: string;
  type: 'buttons' | 'dropdown' | 'text' | 'upload' | 'form' | 'system';
  options?: { label: string; value: string }[];
  fields?: {
    id: keyof MerchantData;
    label: string;
    type: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select';
    required?: boolean;
    options?: { label: string; value: string }[];
  }[];
}

type SmartGuide = {
  eyebrow: string;
  title: string;
  description: string;
  tips: string[];
  skipLabel?: string;
};

/** readAsDataURL yields `data:...;base64,...` — must not be spread like a multi-field form answer */
function isFileUploadAnswer(value: unknown): value is FileData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return typeof o.data === 'string' && o.data.startsWith('data:') && typeof o.name === 'string';
}

const VERCEL_FUNCTION_BODY_SOFT_LIMIT_BYTES = 4_000_000;

function estimateJsonBytes(value: unknown): number {
  const json = JSON.stringify(value);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length;
  }
  return json.length;
}

function stripBinaryFromFile(file: FileData | null): FileData | null {
  if (!file) return null;
  return {
    ...file,
    data: '',
  };
}

function buildMetadataOnlyMerchantData(data: MerchantData): MerchantData {
  return {
    ...data,
    financials: stripBinaryFromFile(data.financials),
    idUpload: stripBinaryFromFile(data.idUpload),
    enhancedVerification: stripBinaryFromFile(data.enhancedVerification),
    proofOfAddress: stripBinaryFromFile(data.proofOfAddress),
    registrationCertificate: stripBinaryFromFile(data.registrationCertificate),
    taxDocument: stripBinaryFromFile(data.taxDocument),
    proofOfFunds: stripBinaryFromFile(data.proofOfFunds),
    bankStatement: stripBinaryFromFile(data.bankStatement),
    complianceDocument: stripBinaryFromFile(data.complianceDocument),
    additionalDocuments: data.additionalDocuments?.map((file) => ({
      ...file,
      data: '',
    })),
  };
}

function prepareUnderwritePayload(data: MerchantData): {
  body: string;
  metadataOnly: boolean;
} {
  const fullPayload = { merchantData: data };
  if (estimateJsonBytes(fullPayload) <= VERCEL_FUNCTION_BODY_SOFT_LIMIT_BYTES) {
    return {
      body: JSON.stringify(fullPayload),
      metadataOnly: false,
    };
  }

  return {
    body: JSON.stringify({
      merchantData: buildMetadataOnlyMerchantData(data),
    }),
    metadataOnly: true,
  };
}

const INDUSTRY_LABELS: Record<string, string> = {
  retail: 'Retail / E-commerce',
  software: 'Software / SaaS',
  services: 'Professional Services',
  gaming: 'Gaming',
  crypto: 'Crypto / Web3',
  high_risk: 'Other High Risk',
};

const VOLUME_LABELS: Record<string, string> = {
  '<10k': '< $10k / month',
  '10k-50k': '$10k - $50k / month',
  '50k-250k': '$50k - $250k / month',
  '>250k': '> $250k / month',
};

function getIndustryLabel(industry: string): string {
  return INDUSTRY_LABELS[industry] || 'your business';
}

function getVolumeLabel(volume: string): string {
  return VOLUME_LABELS[volume] || 'your expected volume';
}

function hasCompletedProcessorFollowUp(data: MerchantData): boolean {
  return Boolean(data.processorSpecificAnswers?.trim() && data.processorReadyPackageSummary?.trim());
}

function buildQuestionSequence(data: MerchantData): QuestionId[] {
  const isHighRisk = ['high_risk', 'crypto', 'gaming'].includes(data.industry);
  const isInternational = data.country !== 'CA' && data.country !== 'US' && data.country !== '';
  const isHighVolume = data.monthlyVolume === '>250k' || data.monthlyVolume === '50k-250k';
  const currentlyProcesses = data.currentlyProcessesCards.toLowerCase().includes('yes');

  const uploadSequence: QuestionId[] = [
    'registrationCertificate',
    'taxDocument',
    'bankStatement',
    'proofOfAddress',
    'proofOfFunds',
    'idUpload',
  ];

  if (currentlyProcesses || isHighVolume || isHighRisk) uploadSequence.push('financials');
  if (isHighRisk) uploadSequence.push('complianceDocument');
  if (isInternational) uploadSequence.push('enhancedVerification');

  const sequence: QuestionId[] = [
    'businessType',
    'country',
    'industry',
    'monthlyVolume',
    'monthlyTransactions',
    'legalBusinessForm',
    'businessModelForm',
    'ownershipControlForm',
    'processingHistoryForm',
    'salesProfileForm',
    'websiteComplianceForm',
    'documentReadinessForm',
    'personaDecisionGate',
    ...uploadSequence,
  ];

  if (data.matchedProcessor && !hasCompletedProcessorFollowUp(data)) {
    sequence.push('processorSpecificFollowUpForm');
  }

  sequence.push('done');
  return sequence;
}

function getQuestionStage(questionId: QuestionId): string {
  if (
    [
      'businessType',
      'country',
      'industry',
      'monthlyVolume',
      'monthlyTransactions',
      'legalBusinessForm',
      'businessModelForm',
      'ownershipControlForm',
      'processingHistoryForm',
      'salesProfileForm',
      'websiteComplianceForm',
      'documentReadinessForm',
    ].includes(questionId)
  ) {
    return 'Common intake';
  }
  if (questionId === 'personaDecisionGate') {
    return 'KYC / KYB routing';
  }
  if (questionId === 'processorSpecificFollowUpForm') {
    return 'Processor follow-up';
  }
  if (questionId.includes('Form') || ['complianceDetails'].includes(questionId)) {
    return 'Business profile';
  }
  if (
    [
      'idUpload',
      'proofOfAddress',
      'registrationCertificate',
      'taxDocument',
      'proofOfFunds',
      'bankStatement',
      'financials',
      'complianceDocument',
      'enhancedVerification',
    ].includes(questionId)
  ) {
    return 'Documents';
  }
  return 'Review';
}

function getFieldPlaceholder(fieldId: keyof MerchantData, data: MerchantData): string {
  const placeholders: Partial<Record<keyof MerchantData, string>> = {
    legalName: 'BCIT BCP Holdings Inc.',
    dbaName: 'Leave blank if none',
    taxId: data.country === 'US' ? '12-3456789' : 'Business number / tax registration',
    businessRegistrationNumber: 'Corporation, registration, or GST/HST number',
    establishedDate: 'YYYY-MM-DD or approximate year',
    legalBusinessAddress: 'Full legal registered address',
    operatingAddressDifferent: 'Yes / No',
    businessPhone: '+1 604 555 0123',
    legalBusinessEmail: 'legal@yourcompany.com',
    website: 'https://yourcompany.com',
    timeInBusiness: '2 years',
    staffSize: '12 employees',
    businessCategory: 'Digital services',
    productsServices: 'Describe exactly what customers buy',
    goodsOrServicesType: 'Physical goods, digital goods, services, or mix',
    customerType: 'B2B, B2C, or both',
    advancePayment: 'Yes / No',
    advancePaymentPercent: 'Example: 25%',
    recurringBilling: 'Yes / No',
    recurringSalesPercent: 'Example: 40%',
    fulfillmentTimeline: 'Example: same day, 3-5 days, 30+ days',
    generalEmail: 'ops@yourcompany.com',
    phone: '+1 604 555 0123',
    registeredAddress: '123 Main Street',
    operatingAddress: 'Same as registered or actual operating address',
    city: 'Vancouver',
    province: 'British Columbia',
    avgTxnCount: '500',
    avgTicketSize: '120',
    targetGeography: 'Canada and US',
    domesticCrossBorderSplit: '70% domestic / 30% cross-border',
    processingCurrencies: 'CAD, USD',
    paymentProducts: 'Cards, Apple Pay, Google Pay',
    ownerName: 'Jane Doe',
    ownerEmail: 'jane@yourcompany.com',
    ownerRole: 'Founder & CEO',
    ownershipPercentage: '100',
    ownerIdNumber: 'Passport or DL number',
    ownerCountryOfResidence: 'Canada',
    bankName: 'RBC',
    accountHolderName: 'BCIT BCP Holdings Inc.',
    accountNumber: 'Account number or IBAN',
    routingNumber: 'Transit / routing / branch code',
    settlementCurrency: 'CAD',
    recurringBillingDetails: 'Monthly subscription',
    trialPeriod: '14-day free trial',
    refundPolicy: 'Refunds within 30 days',
    churnRate: '3%',
    deliveryMethod: 'In-house fulfillment',
    avgDeliveryTime: '3-5 business days',
    shippingPolicy: 'Tracked shipping on all orders',
    cryptoServices: 'Custodial wallet and on-ramp',
    amlKycProcedures: 'Vendor KYC + sanctions screening',
    cryptoLicenses: 'MSB registration pending',
    custodyArrangement: 'Third-party custodian',
    gamingType: 'Skill-based competitions',
    gamingLicenses: 'Curacao license',
    responsibleGaming: 'Self-exclusion and deposit limits',
    ageVerification: 'KYC + document checks',
    serviceType: 'B2B marketing services',
    billingModel: 'Monthly retainer',
    contractLength: '6 months',
    businessDescription: 'Describe what you sell and how customers pay',
    regulatoryStatus: 'List licenses or registrations',
    chargebackHistory: 'Under 0.7%',
    previousProcessors: 'Stripe, local bank gateway',
    beneficialOwners: 'One per line: Jane Doe, 60%, CEO, jane@example.com',
    parentOwned: 'Yes / No',
    parentCompanyName: 'Parent company legal name, if any',
    nonOwnerController: 'Yes / No',
    nonOwnerControllerDetails: 'Name, title, email',
    authorizedSignerName: 'Authorized signer full legal name',
    authorizedSignerTitle: 'CEO / Director / Owner',
    authorizedSignerEmail: 'signer@yourcompany.com',
    signerIsOwner: 'Yes / No',
    complianceDetails: 'Short overview of AML, KYC, monitoring, or licensing',
    currentlyProcessesCards: 'Yes / No',
    currentOrPreviousProcessor: 'Current or previous processor name',
    processorExitReason: 'Why are you leaving or why did you leave?',
    priorTermination: 'Yes / No',
    priorTerminationExplanation: 'Explain if yes',
    bankruptcyHistory: 'Yes / No',
    bankruptcyExplanation: 'Explain if yes',
    riskProgramHistory: 'Yes / No',
    riskProgramExplanation: 'Explain if yes',
    highestTicketAmount: 'Example: 2500',
    transactionChannelSplit: 'e.g. Card present 20%, e-commerce 70%, MOTO 10%',
    paymentTypesWanted: 'Visa, Mastercard, Amex, Interac, ACH',
    recurringTransactionsPercent: 'Example: 25%',
    foreignCardsPercent: 'Example: 15%',
    websitePrivacyPolicy: 'Yes / No / Not sure',
    websiteTerms: 'Yes / No / Not sure',
    websiteRefundPolicy: 'Yes / No / Not sure',
    websiteShippingPolicy: 'Yes / No / Not applicable / Not sure',
    websiteContactInfo: 'Yes / No / Not sure',
    websiteCurrencyDisplay: 'Yes / No / Not applicable / Not sure',
    websiteSsl: 'Yes / No / Not sure',
    storesCardNumbers: 'Yes / No',
    thirdPartyCardApps: 'Stripe, Shopify, WooCommerce, etc.',
    dataBreachHistory: 'Yes / No',
    regulatedBusiness: 'Yes / No; include MSB or other licensing if applicable',
    canProvideRegistration: 'Yes / No / Need help',
    canProvideVoidCheque: 'Yes / No / Need help',
    canProvideBankStatements: 'Yes / No / Need help',
    canProvideProofOfAddress: 'Yes / No / Need help',
    canProvideProofOfOwnership: 'Yes / No / Need help',
    canProvideOwnerIds: 'Yes / No / Need help',
    canProvideProcessingStatements: 'Yes / No / Not applicable',
    processorSpecificAnswers: 'Answer the checklist in bullets. Use availability or last 4 only for sensitive identifiers.',
  };

  return placeholders[fieldId] || 'Enter details';
}

function getSmartGuide(questionId: QuestionId, data: MerchantData): SmartGuide {
  const businessName = data.legalName || 'your business';
  const stage = getQuestionStage(questionId);
  const baseTips = [
    'You can keep answers concise. We only need enough detail to route you correctly.',
    'If you are unsure, give your best current estimate and refine it later in review.',
  ];

  if (questionId === 'businessType' || questionId === 'country' || questionId === 'industry') {
    return {
      eyebrow: `${stage} • Smart routing`,
      title: 'I am tailoring the flow to your profile',
      description:
        'These first answers determine which follow-up sections and documents actually matter for you, so we avoid asking every merchant the same long list.',
      tips: [
        'First we collect processor-neutral common intake.',
        'After AI matching, I will only ask the selected processor-specific questions.',
      ],
    };
  }

  if (questionId === 'monthlyVolume' || questionId === 'monthlyTransactions') {
    return {
      eyebrow: `${stage} • Pricing fit`,
      title: 'This helps us size your processor match',
      description: `For ${getIndustryLabel(data.industry)}, volume and transaction count help decide whether we keep things lightweight or move into a more underwriting-heavy path.`,
      tips: [
        `A realistic estimate is better than a perfect one. We can refine ${getVolumeLabel(data.monthlyVolume)} later.`,
        'Higher volumes usually trigger stronger documentation because the pricing upside is worth it.',
      ],
    };
  }

  if (questionId.includes('Form') || questionId === 'complianceDetails') {
    return {
      eyebrow: `${stage} • Guided section`,
      title: 'Only the fields that matter are shown here',
      description:
        questionId === 'ownershipControlForm'
          ? 'We are collecting the beneficial-owner and control details processors expect, so approvals do not get stuck in manual review.'
          : `This section is tuned for ${getIndustryLabel(data.industry)} and ${businessName}. Fill the essentials now and we will keep the rest moving.`,
      tips: [
        'Short, plain-English answers are fine.',
        'If one field is not finalized yet, use the most current working answer you have.',
      ],
    };
  }

  if (
    [
      'idUpload',
      'proofOfAddress',
      'registrationCertificate',
      'taxDocument',
      'proofOfFunds',
      'bankStatement',
      'financials',
      'complianceDocument',
      'enhancedVerification',
    ].includes(questionId)
  ) {
    const isRequiredHeavyDoc = ['bankStatement', 'financials', 'complianceDocument', 'proofOfFunds'].includes(questionId);
    return {
      eyebrow: `${stage} • Document step`,
      title: isRequiredHeavyDoc ? 'This document improves approval confidence' : 'A quick upload here reduces manual follow-up',
      description:
        isRequiredHeavyDoc
          ? 'If you have it ready, upload it now. If not, you can skip and still continue, but the admin team may ask for it later.'
          : 'The goal is to keep underwriting moving without forcing a hard stop when a file is not handy.',
      tips: [
        'PDF, PNG, and JPG all work.',
        'If the file is large, the system may switch to metadata-only mode to stay within Vercel limits.',
      ],
      skipLabel: isRequiredHeavyDoc ? 'Skip for now, upload later' : 'Continue without this file',
    };
  }

  return {
    eyebrow: `${stage} • Guided flow`,
    title: 'I am keeping the process adaptive',
    description: 'Each answer changes the next step so you only see relevant questions.',
    tips: baseTips,
  };
}

// Dynamic question generator based on context
const getQuestionText = (qId: QuestionId, data: MerchantData): string => {
  const businessName = data.legalName || 'your business';
  const industry = data.industry;
  const volume = data.monthlyVolume;
  
  const contextualTexts: Partial<Record<QuestionId, () => string>> = {
    businessType: () => "Hi there! I'm here to help you get set up with BCIT BCP. First, what type of business structure are you operating?",
    
    country: () => {
      const typeLabels: Record<string, string> = {
        'sole_proprietorship': 'sole proprietorship',
        'llc': 'limited liability entity',
        'limited_liability': 'limited liability entity',
        'corporation': 'corporation',
        'partnership': 'partnership',
        'non_profit': 'non-profit',
        'government': 'government entity',
        'parent_owned': 'parent-owned business',
      };
      return `Great choice! As a ${typeLabels[data.businessType] || 'business'}, where are you legally registered?`;
    },
    
    industry: () => {
      if (data.country === 'CA') {
        return "Perfect, Canadian businesses are easy to work with. What industry are you in?";
      } else if (data.country === 'US') {
        return "US-based, got it. What industry does your business operate in?";
      } else {
        return "Thanks for that info. What industry are you in? This helps us find the right payment processors for you.";
      }
    },
    
    monthlyVolume: () => {
      const industrySpecific: Record<string, string> = {
        'retail': "E-commerce can have varying volumes. What's your estimated monthly processing volume?",
        'software': "SaaS businesses often have predictable recurring revenue. What's your expected monthly volume?",
        'services': "Professional services billing can vary. What's your typical monthly processing volume?",
        'gaming': "Gaming revenues can fluctuate. What's your average monthly processing volume?",
        'crypto': "Crypto transactions can be high-volume. What's your estimated monthly processing volume?",
        'high_risk': "Understanding your volume helps us match you with the right high-risk processor. What's your monthly volume?"
      };
      return industrySpecific[industry] || "What is your estimated monthly processing volume?";
    },
    
    monthlyTransactions: () => {
      if (volume === '>250k') {
        return "With that volume, transaction count matters for pricing. How many transactions per month?";
      } else if (volume === '<10k') {
        return "Even at lower volumes, we want to get you the best rates. Roughly how many transactions monthly?";
      }
      return "And roughly how many individual transactions do you process per month?";
    },

    legalBusinessForm: () =>
      "Phase 1 starts with legal business information. These answers identify the entity and tell us whether KYB should be expected.",

    businessModelForm: () =>
      "Next I need the common business-model details processors ask for before any processor-specific forms.",

    ownershipControlForm: () =>
      "Now let's capture ownership and control. This is what decides who should receive KYC invites and whether KYB should go first.",

    processingHistoryForm: () =>
      "A few processing-history questions help detect early risk before we ask for any processor-specific details.",

    salesProfileForm: () =>
      "Let's capture the common sales profile so AI can score ticket size, channel mix, recurring exposure, and foreign-card exposure.",

    websiteComplianceForm: () =>
      "Now we will capture website, security, and PCI basics. AI will use this as a structured website legitimacy and compliance review.",

    documentReadinessForm: () =>
      "Last common-intake block: document readiness. This lets us separate missing documents from true risk.",

    personaDecisionGate: () => {
      const decision = decidePersonaInvites(data);
      return `${decision.summary} I will attach this KYC / KYB routing plan to the merchant profile before AI underwriting.`;
    },

    processorSpecificFollowUpForm: () => {
      const processor = normalizeProcessorFit(data.matchedProcessor);
      return `AI matched this case to ${processor}. Now I will only ask the ${processor}-specific underwriting follow-up items, without repeating the common intake.`;
    },
    
    // Document uploads - contextual
    idUpload: () => {
      if (data.country === 'US') {
        return "Please upload a valid US government-issued ID (Driver's License or Passport).";
      } else if (data.country === 'CA') {
        return "Please upload a valid Canadian government ID (Driver's License, Passport, or Provincial ID).";
      }
      return "Please upload a valid government-issued ID for the primary business owner.";
    },
    
    registrationCertificate: () => {
      if (data.businessType === 'corporation') {
        return "Please upload your Certificate of Incorporation or Articles of Incorporation.";
      } else if (data.businessType === 'llc') {
        return "Please upload your Articles of Organization or Operating Agreement.";
      } else if (data.businessType === 'partnership') {
        return "Please upload your Partnership Agreement.";
      }
      return "Please upload your business registration document.";
    },
    
    financials: () => {
      if (volume === '>250k' || volume === '50k-250k') {
        return "Given your volume, please upload your latest financial statements (P&L, Balance Sheet). This helps secure better rates.";
      } else if (['crypto', 'gaming', 'high_risk'].includes(industry)) {
        return "For high-risk industries, financial documentation is required. Please upload recent financial statements.";
      }
      return "Please upload your latest financial statements if available. This can help with your application.";
    },
    
    bankStatement: () => {
      if (['crypto', 'gaming', 'high_risk'].includes(industry)) {
        return "Please upload 3-6 months of bank statements showing business transaction history.";
      }
      return "Please upload a recent bank statement (at least 3 months of activity).";
    },
    
    proofOfAddress: () => {
      if (data.country !== 'CA' && data.country !== 'US') {
        return "For international businesses, please provide proof of your business address (utility bill, bank statement, or lease agreement).";
      }
      return "Please upload proof of business address (utility bill, bank statement, etc.).";
    },
    
    complianceDocument: () => {
      if (industry === 'crypto') {
        return "Please upload any crypto/money transmitter licenses or registrations.";
      } else if (industry === 'gaming') {
        return "Please upload any gaming licenses or regulatory approvals.";
      }
      return "Please upload any relevant compliance or licensing documents for your industry.";
    },
    
    proofOfFunds: () => "Please upload proof of source of funds/income (investment documents, contracts, etc.).",
    
    enhancedVerification: () => {
      if (data.country === 'EU') {
        return "For EU businesses, please upload an additional form of ID or recent proof of address dated within 3 months.";
      }
      return "For international businesses, we require a secondary form of ID or recent proof of address.";
    },
    
    complianceDetails: () => {
      if (industry === 'crypto') {
        return "Please describe your AML/KYC procedures and any regulatory licenses you hold.";
      } else if (industry === 'gaming') {
        return "Please describe your responsible gaming measures and any gambling licenses.";
      }
      return "Since you're in a regulated industry, please briefly describe your compliance program.";
    },
  };
  
  const getter = contextualTexts[qId];
  return getter ? getter() : QUESTIONS[qId]?.text || '';
};

const QUESTIONS: Partial<Record<QuestionId, QuestionDef>> = {
  businessType: {
    id: 'businessType',
    text: "Hi there! I'm here to help you get set up with BCIT BCP. First, what type of business are you operating?",
    type: 'buttons',
    options: [
      { label: 'Sole Proprietorship', value: 'sole_proprietorship' },
      { label: 'Limited Liability', value: 'limited_liability' },
      { label: 'Corporation', value: 'corporation' },
      { label: 'Partnership', value: 'partnership' },
      { label: 'Non-profit', value: 'non_profit' },
      { label: 'Government', value: 'government' },
      { label: 'Parent-owned', value: 'parent_owned' },
    ]
  },
  country: {
    id: 'country',
    text: "Great. Where is your business legally located?",
    type: 'dropdown',
    options: [
      { label: 'Canada', value: 'CA' },
      { label: 'United States', value: 'US' },
      { label: 'United Kingdom', value: 'UK' },
      { label: 'European Union', value: 'EU' },
      { label: 'Other', value: 'Other' },
    ]
  },
  industry: {
    id: 'industry',
    text: "What industry are you in?",
    type: 'dropdown',
    options: [
      { label: 'Retail / E-commerce', value: 'retail' },
      { label: 'Software / SaaS', value: 'software' },
      { label: 'Professional Services', value: 'services' },
      { label: 'Gaming', value: 'gaming' },
      { label: 'Crypto / Web3', value: 'crypto' },
      { label: 'Other High Risk', value: 'high_risk' },
    ]
  },
  monthlyVolume: {
    id: 'monthlyVolume',
    text: "What is your estimated monthly processing volume?",
    type: 'buttons',
    options: [
      { label: '< $10k', value: '<10k' },
      { label: '$10k - $50k', value: '10k-50k' },
      { label: '$50k - $250k', value: '50k-250k' },
      { label: '> $250k', value: '>250k' },
    ]
  },
  monthlyTransactions: {
    id: 'monthlyTransactions',
    text: "And roughly how many transactions do you process per month?",
    type: 'buttons',
    options: [
      { label: '< 100', value: '<100' },
      { label: '100 - 1,000', value: '100-1k' },
      { label: '1,000 - 10,000', value: '1k-10k' },
      { label: '> 10,000', value: '>10k' },
    ]
  },
  legalBusinessForm: {
    id: 'legalBusinessForm',
    text: 'Legal business information',
    type: 'form',
    fields: [
      { id: 'legalName', label: 'What is your legal business name?', type: 'text' },
      { id: 'dbaName', label: 'Do you operate under a DBA, operating name, or trade name? If yes, what is it?', type: 'text', required: false },
      { id: 'taxId', label: 'What is your Tax ID / EIN / Business Number?', type: 'text' },
      { id: 'businessRegistrationNumber', label: 'What is your business registration / corporation / GST/HST number?', type: 'text' },
      { id: 'establishedDate', label: 'When was the business established or incorporated?', type: 'text' },
      { id: 'timeInBusiness', label: 'How long has the business been operating?', type: 'text' },
      { id: 'staffSize', label: 'How many employees do you have?', type: 'text' },
      { id: 'legalBusinessAddress', label: 'What is your legal business address?', type: 'text' },
      { id: 'operatingAddressDifferent', label: 'Is your operating address different from your legal address?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'operatingAddress', label: 'If yes, what is your operating address?', type: 'text', required: false },
      { id: 'businessPhone', label: 'What is your business phone number?', type: 'text' },
      { id: 'legalBusinessEmail', label: 'What is your legal business email?', type: 'email' },
      { id: 'website', label: 'What is your website URL?', type: 'text' },
    ],
  },
  businessModelForm: {
    id: 'businessModelForm',
    text: 'Business model',
    type: 'form',
    fields: [
      { id: 'productsServices', label: 'What products or services do you sell?', type: 'textarea' },
      { id: 'businessDescription', label: 'Please describe your business in detail.', type: 'textarea' },
      {
        id: 'businessCategory',
        label: 'What type of merchant are you?',
        type: 'select',
        options: [
          { label: 'Retail', value: 'Retail' },
          { label: 'E-commerce', value: 'E-commerce' },
          { label: 'MOTO / keyed', value: 'MOTO / keyed' },
          { label: 'Restaurant', value: 'Restaurant' },
          { label: 'Service', value: 'Service' },
          { label: 'Other', value: 'Other' },
        ],
      },
      {
        id: 'goodsOrServicesType',
        label: 'Do you sell physical goods, digital goods, services, or a mix?',
        type: 'select',
        options: [
          { label: 'Physical goods', value: 'Physical goods' },
          { label: 'Digital goods', value: 'Digital goods' },
          { label: 'Services', value: 'Services' },
          { label: 'Mix', value: 'Mix' },
        ],
      },
      {
        id: 'customerType',
        label: 'Are your customers B2B, B2C, or both?',
        type: 'select',
        options: [
          { label: 'B2B', value: 'B2B' },
          { label: 'B2C', value: 'B2C' },
          { label: 'Both', value: 'Both' },
        ],
      },
      { id: 'advancePayment', label: 'Is payment taken in advance before fulfillment?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'advancePaymentPercent', label: 'If yes, approximately what percentage of sales is paid in advance?', type: 'select', required: false, options: PERCENT_RANGE_OPTIONS },
      { id: 'recurringBilling', label: 'Do you offer recurring billing or subscriptions?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'recurringSalesPercent', label: 'If yes, approximately what percentage of sales is recurring?', type: 'select', required: false, options: PERCENT_RANGE_OPTIONS },
      {
        id: 'fulfillmentTimeline',
        label: 'How long does it usually take customers to receive the product or service?',
        type: 'select',
        options: [
          { label: 'Same day / instant', value: 'Same day / instant' },
          { label: '1-3 days', value: '1-3 days' },
          { label: '4-7 days', value: '4-7 days' },
          { label: '8-30 days', value: '8-30 days' },
          { label: 'Over 30 days', value: 'Over 30 days' },
        ],
      },
    ],
  },
  ownershipControlForm: {
    id: 'ownershipControlForm',
    text: 'Ownership and control',
    type: 'form',
    fields: [
      { id: 'beneficialOwners', label: 'Please list all beneficial owners with 25% or more ownership: full legal name, ownership %, title / role, email.', type: 'textarea' },
      { id: 'parentOwned', label: 'Is the business owned by another company or parent entity?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'parentCompanyName', label: 'If yes, what is the parent company name?', type: 'text', required: false },
      { id: 'nonOwnerController', label: 'Is there anyone with significant managerial control who is not an owner?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'nonOwnerControllerDetails', label: 'If yes, provide their name, title, and email.', type: 'text', required: false },
      { id: 'authorizedSignerName', label: 'Who is the authorized signer for this application? Name.', type: 'text' },
      { id: 'authorizedSignerTitle', label: 'Authorized signer title.', type: 'text' },
      { id: 'authorizedSignerEmail', label: 'Authorized signer email.', type: 'email' },
      { id: 'signerIsOwner', label: 'Is the signer one of the owners listed above?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'ownerName', label: 'Primary owner / principal full legal name.', type: 'text' },
      { id: 'ownerEmail', label: 'Primary owner email.', type: 'email' },
      { id: 'ownerRole', label: 'Primary owner role / title.', type: 'text' },
      { id: 'ownershipPercentage', label: 'Primary owner ownership percentage.', type: 'number' },
      { id: 'ownerCountryOfResidence', label: 'Primary owner country of residence.', type: 'text' },
      { id: 'bankName', label: 'What bank do you use for business deposits?', type: 'text' },
      { id: 'accountHolderName', label: 'Account holder name on the bank account.', type: 'text' },
      { id: 'settlementCurrency', label: 'What settlement currency do you need?', type: 'text' },
    ],
  },
  processingHistoryForm: {
    id: 'processingHistoryForm',
    text: 'Processing history',
    type: 'form',
    fields: [
      { id: 'currentlyProcessesCards', label: 'Do you currently process card payments?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'currentOrPreviousProcessor', label: 'Who is your current or previous processor?', type: 'text', required: false },
      { id: 'processorExitReason', label: 'Why are you leaving your current / previous processor?', type: 'textarea', required: false },
      { id: 'priorTermination', label: 'Has the business or any owner ever had a merchant account or processing agreement terminated?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'priorTerminationExplanation', label: 'If yes, please explain.', type: 'textarea', required: false },
      { id: 'bankruptcyHistory', label: 'Has the business or any owner ever filed for bankruptcy?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'bankruptcyExplanation', label: 'If yes, please explain.', type: 'textarea', required: false },
      { id: 'riskProgramHistory', label: 'Has the business or any owner ever been identified in a Visa / Mastercard risk program?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'riskProgramExplanation', label: 'If yes, please explain.', type: 'textarea', required: false },
    ],
  },
  salesProfileForm: {
    id: 'salesProfileForm',
    text: 'Sales profile',
    type: 'form',
    fields: [
      { id: 'avgTicketSize', label: 'What is your average transaction amount?', type: 'number' },
      { id: 'highestTicketAmount', label: 'What is your highest transaction amount?', type: 'number' },
      { id: 'transactionChannelSplit', label: 'What percentage of your transactions are card present, e-commerce, and MOTO / keyed?', type: 'text' },
      {
        id: 'paymentTypesWanted',
        label: 'Which payment types do you want to accept?',
        type: 'select',
        options: [
          { label: 'Visa / Mastercard only', value: 'Visa / Mastercard' },
          { label: 'Visa / Mastercard / Amex', value: 'Visa / Mastercard / Amex' },
          { label: 'Cards + Interac', value: 'Cards + Interac' },
          { label: 'Cards + ACH / bank debit', value: 'Cards + ACH / bank debit' },
          { label: 'Full mix', value: 'Visa / Mastercard / Amex / Interac / ACH' },
        ],
      },
      { id: 'recurringTransactionsPercent', label: 'What percentage of your transactions are recurring?', type: 'select', options: PERCENT_RANGE_OPTIONS },
      { id: 'foreignCardsPercent', label: 'What percentage of your transactions involve foreign cards?', type: 'select', options: PERCENT_RANGE_OPTIONS },
      {
        id: 'processingCurrencies',
        label: 'Which processing currencies do you need?',
        type: 'select',
        options: [
          { label: 'CAD only', value: 'CAD' },
          { label: 'USD only', value: 'USD' },
          { label: 'CAD + USD', value: 'CAD, USD' },
          { label: 'CAD + USD + other', value: 'CAD, USD, other' },
        ],
      },
    ],
  },
  websiteComplianceForm: {
    id: 'websiteComplianceForm',
    text: 'Website / security / PCI basics',
    type: 'form',
    fields: [
      { id: 'websitePrivacyPolicy', label: 'Does your website include a Privacy Policy?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'websiteTerms', label: 'Does your website include Terms and Conditions / Terms of Use?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'websiteRefundPolicy', label: 'Does your website include a Return / Refund Policy?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'websiteShippingPolicy', label: 'Does your website include a Shipping Policy if applicable?', type: 'select', options: YES_NO_NA_OPTIONS },
      { id: 'websiteContactInfo', label: 'Does your website include customer service contact information?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'websiteCurrencyDisplay', label: 'Does your website display transaction currency if applicable?', type: 'select', options: YES_NO_NA_OPTIONS },
      { id: 'websiteSsl', label: 'Is your payment page encrypted with SSL or better?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'storesCardNumbers', label: 'Do you store credit card numbers?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'thirdPartyCardApps', label: 'Do you use any third-party applications to process, transmit, or store cardholder data? If yes, list them.', type: 'textarea', required: false },
      { id: 'dataBreachHistory', label: 'Have you experienced a data breach or card data compromise in the past?', type: 'select', options: YES_NO_OPTIONS },
      { id: 'regulatedBusiness', label: 'Is your business an MSB or another regulated business?', type: 'select', options: YES_NO_OPTIONS },
    ],
  },
  documentReadinessForm: {
    id: 'documentReadinessForm',
    text: 'Document readiness',
    type: 'form',
    fields: [
      { id: 'canProvideRegistration', label: 'Can you provide Business Registration or Articles of Incorporation?', type: 'select', options: READINESS_OPTIONS },
      { id: 'canProvideVoidCheque', label: 'Can you provide a Void Cheque or Bank Letter?', type: 'select', options: READINESS_OPTIONS },
      { id: 'canProvideBankStatements', label: 'Can you provide 2 recent official business bank statements?', type: 'select', options: READINESS_OPTIONS },
      { id: 'canProvideProofOfAddress', label: 'Can you provide proof of business address?', type: 'select', options: READINESS_OPTIONS },
      { id: 'canProvideProofOfOwnership', label: 'Can you provide proof of ownership?', type: 'select', options: READINESS_OPTIONS },
      { id: 'canProvideOwnerIds', label: 'Can each 25%+ owner and signer provide government-issued photo ID?', type: 'select', options: READINESS_OPTIONS },
      { id: 'canProvideProcessingStatements', label: 'If you currently process payments, can you provide 3 recent processing statements?', type: 'select', options: READINESS_OPTIONS },
    ],
  },
  personaDecisionGate: {
    id: 'personaDecisionGate',
    text: 'Persona trigger decision',
    type: 'system',
  },
  processorSpecificFollowUpForm: {
    id: 'processorSpecificFollowUpForm',
    text: 'Processor-specific follow-up',
    type: 'form',
    fields: [
      { id: 'processorSpecificAnswers', label: 'Processor-specific follow-up answers. Do not enter full SIN, bank account numbers, or full ID numbers in this demo.', type: 'textarea' },
    ],
  },
  legalName: {
    id: 'legalName',
    text: "What is the legal name of your company?",
    type: 'text'
  },
  taxId: {
    id: 'taxId',
    text: "Please provide your Tax ID or EIN.",
    type: 'text'
  },
  ownerName: {
    id: 'ownerName',
    text: "What is your full legal name?",
    type: 'text'
  },
  website: {
    id: 'website',
    text: "What is your business website URL?",
    type: 'text'
  },
  complianceDetails: {
    id: 'complianceDetails',
    text: "Since you're in a regulated industry, please briefly describe your compliance program.",
    type: 'text'
  },
  financials: {
    id: 'financials',
    text: "Please upload your latest financial statements.",
    type: 'upload'
  },
  idUpload: {
    id: 'idUpload',
    text: "Please upload a valid government-issued ID for the primary business owner.",
    type: 'upload'
  },
  enhancedVerification: {
    id: 'enhancedVerification',
    text: "Please upload a secondary form of ID or proof of address.",
    type: 'upload'
  },
  
  // Document Uploads
  proofOfAddress: {
    id: 'proofOfAddress',
    text: "Please upload proof of business address.",
    type: 'upload'
  },
  registrationCertificate: {
    id: 'registrationCertificate',
    text: "Please upload your business registration certificate.",
    type: 'upload'
  },
  taxDocument: {
    id: 'taxDocument',
    text: "Please upload a void cheque or bank letter.",
    type: 'upload'
  },
  proofOfFunds: {
    id: 'proofOfFunds',
    text: "Please upload proof of ownership.",
    type: 'upload'
  },
  bankStatement: {
    id: 'bankStatement',
    text: "Please upload recent bank statements.",
    type: 'upload'
  },
  complianceDocument: {
    id: 'complianceDocument',
    text: "Please upload compliance/licensing documents.",
    type: 'upload'
  },

  done: {
    id: 'done',
    text: "All done! Let me analyze your profile...",
    type: 'text'
  }
};

// Smart question flow based on context
const getNextQuestion = (currentId: QuestionId, data: MerchantData): QuestionId => {
  const fullSequence = buildQuestionSequence(data);
  const followUpSequence = fullSequence.slice(5);

  // Main question flow
  switch (currentId) {
    case 'businessType': return 'country';
    case 'country': return 'industry';
    case 'industry': return 'monthlyVolume';
    case 'monthlyVolume': return 'monthlyTransactions';
    case 'monthlyTransactions': return followUpSequence[0];
    default:
      const index = followUpSequence.indexOf(currentId);
      if (index !== -1 && index < followUpSequence.length - 1) {
        return followUpSequence[index + 1];
      }
      return 'done';
  }
};

type Message = {
  id: string;
  sender: 'system' | 'user';
  content: React.ReactNode;
  isActionable?: boolean;
  questionId?: QuestionId;
};

interface ChatAppProps {
  data: MerchantData;
  setData: React.Dispatch<React.SetStateAction<MerchantData>>;
  setAiRecommendation: (rec: any) => void;
  setIsFinished: (val: boolean) => void;
  isFinished: boolean;
  documents: FileData[];
  setDocuments: React.Dispatch<React.SetStateAction<FileData[]>>;
  editSection: string | null;
  setEditSection: (section: string | null) => void;
  onFinish: () => void;
  /** When set, document upload/edit steps pause after each answer until the user clicks Continue (multi-missing flow). */
  guidedTourOrder?: MerchantDocumentKey[] | null;
  onGuidedFlowComplete?: () => void;
  onGuidedFlowAbort?: () => void;
}

export function ChatApp({
  data,
  setData,
  setAiRecommendation,
  setIsFinished,
  isFinished,
  documents,
  setDocuments,
  editSection,
  setEditSection,
  onFinish,
  guidedTourOrder = null,
  onGuidedFlowComplete,
  onGuidedFlowAbort,
}: ChatAppProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionId>('businessType');
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [guidedAwaitContinue, setGuidedAwaitContinue] = useState(false);
  const [guidedAfterData, setGuidedAfterData] = useState<MerchantData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!guidedTourOrder?.length) {
      setGuidedAwaitContinue(false);
      setGuidedAfterData(null);
    }
  }, [guidedTourOrder]);

  useEffect(() => {
    if (!currentQuestion || currentQuestion === 'done') return;
    const qDef = QUESTIONS[currentQuestion];
    if (qDef?.type === 'text' || qDef?.type === 'dropdown') {
      const v = data[currentQuestion as keyof MerchantData];
      setInputValue(typeof v === 'string' ? v : '');
    } else {
      setInputValue('');
    }
  }, [currentQuestion]);
  const questionSequence = buildQuestionSequence(data);
  const currentStepIndex = currentQuestion === 'done' ? questionSequence.length : Math.max(questionSequence.indexOf(currentQuestion), 0) + 1;
  const progressPercent = Math.min(100, Math.max(6, Math.round((currentStepIndex / questionSequence.length) * 100)));
  const smartGuide = currentQuestion && currentQuestion !== 'done' ? getSmartGuide(currentQuestion, data) : null;
  const remainingCount = currentQuestion && currentQuestion !== 'done'
    ? Math.max(questionSequence.length - currentStepIndex, 0)
    : 0;

  useEffect(() => {
    if (editSection && !isFinished) {
      setCurrentQuestion(editSection as QuestionId);
      setEditSection(null);
      
      const branchingQuestions = ['businessType', 'country', 'industry', 'monthlyVolume', 'monthlyTransactions'];
      setIsEditing(!branchingQuestions.includes(editSection));
      
      const qDef = QUESTIONS[editSection as QuestionId];
      if (qDef) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          content: `Let's update this section: ${qDef.text}`,
          sender: 'system',
          isActionable: true
        }]);
      }
    }
  }, [editSection, isFinished, setEditSection]);

  /** When `editSection` is already cleared (e.g. Strict Mode remount), still open the correct guided document step. */
  useEffect(() => {
    if (!guidedTourOrder?.length || isFinished) return;
    if (editSection) return;
    const missing = getMissingDocumentKeys(data);
    const start = missing.find((k) => guidedTourOrder.includes(k)) ?? guidedTourOrder[0];
    if (!start) return;

    setCurrentQuestion((q) => (q === 'businessType' ? (start as QuestionId) : q));
    setIsEditing(true);
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      const qDef = QUESTIONS[start as QuestionId];
      const line = qDef
        ? `Let's add the requested document: ${qDef.text}`
        : 'Please provide the requested upload.';
      return [{ id: 'guided-open', content: line, sender: 'system' as const, isActionable: true }];
    });
  }, [guidedTourOrder, data, isFinished, editSection]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && messages.length === 0) {
      const openForGuidedOrEdit =
        Boolean(editSection) || (guidedTourOrder != null && guidedTourOrder.length > 0);
      initialized.current = true;
      if (!openForGuidedOrEdit) {
        askQuestion('businessType');
      }
    }
  }, []);

  const askQuestion = (qId: QuestionId) => {
    const qDef = QUESTIONS[qId];
    if (!qDef) return;
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      // Use contextual text based on current data
      const contextualText = getQuestionText(qId, data);
      setMessages(prev => [
        ...prev.map(m => ({ ...m, isActionable: false })),
        {
          id: Math.random().toString(36).substring(2, 15),
          sender: 'system',
          content: contextualText || qDef.text,
          isActionable: true,
          questionId: qId
        }
      ]);
    }, 800);
  };

  const handleAnswer = (value: any, displayValue?: string) => {
    if (!currentQuestion || currentQuestion === 'done') return;

    let newData = { ...data };
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !isFileUploadAnswer(value)
    ) {
      newData = { ...newData, ...value };
    } else {
      newData = { ...newData, [currentQuestion]: value };
    }
    setData(newData);

    setMessages(prev => [
      ...prev.map(m => ({ ...m, isActionable: false })),
      {
        id: Math.random().toString(36).substring(2, 15),
        sender: 'user',
        content:
          displayValue ||
          (isFileUploadAnswer(value)
            ? `Uploaded: ${value.name}`
            : value !== null && typeof value === 'object' && !Array.isArray(value)
              ? 'Provided details'
              : String(value))
      }
    ]);

    setInputValue('');

    if (currentQuestion === 'processorSpecificFollowUpForm') {
      const packagedData = {
        ...newData,
        processorReadyPackageSummary: buildProcessorReadyPackageSummary(newData),
      };
      setData(packagedData);
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 15),
          sender: 'system',
          content: 'Processor-ready package assembled with common intake, KYC / KYB routing, AI underwriting, website signals, document checklist, missing items, and processor-specific answers.',
        }
      ]);
      setIsFinished(true);
      onFinish();
      return;
    }

    let nextQ: QuestionId;
    const inGuidedDocumentStep =
      isEditing &&
      guidedTourOrder &&
      guidedTourOrder.length > 0 &&
      MERCHANT_FILE_QUESTION_ID_SET.has(currentQuestion as string) &&
      guidedTourOrder.includes(currentQuestion as MerchantDocumentKey);

    if (inGuidedDocumentStep) {
      setGuidedAfterData(newData);
      setGuidedAwaitContinue(true);
      return;
    }

    if (isEditing) {
      setIsEditing(false);
      nextQ = 'done';
    } else {
      nextQ = getNextQuestion(currentQuestion, newData);
    }

    setCurrentQuestion(nextQ);

    if (nextQ === 'done') {
      finishFlow(newData);
    } else {
      askQuestion(nextQ);
    }
  };

  const openProcessorFollowUp = (finalData: MerchantData, recommendation: any) => {
    const matchedProcessor = normalizeProcessorFit(recommendation?.recommendedProcessor);
    const previousProcessor = finalData.matchedProcessor ? normalizeProcessorFit(finalData.matchedProcessor) : '';
    const processorChanged = Boolean(previousProcessor && previousProcessor !== matchedProcessor);
    const enrichedData = {
      ...finalData,
      matchedProcessor,
      processorSpecificAnswers: processorChanged ? '' : finalData.processorSpecificAnswers,
      processorReadyPackageSummary: '',
      personaInvitePlan: finalData.personaInvitePlan || buildPersonaSummary(finalData),
      personaVerificationSummary:
        finalData.personaVerificationSummary ||
        'Pending. Attach KYB/KYC pass, fail, pending, mismatch, and incomplete verification results when available.',
      websiteReviewSummary: finalData.websiteReviewSummary || buildWebsiteSignalSummary(finalData),
    };

    setData(enrichedData);
    setAiRecommendation({
      ...recommendation,
      recommendedProcessor: matchedProcessor,
    });
    setIsFinished(false);
    setCurrentQuestion('processorSpecificFollowUpForm');
    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 15),
        sender: 'system',
        content: `AI matched this case to ${matchedProcessor}. Final step: answer only the ${matchedProcessor}-specific follow-up items so the package is processor-ready.`,
        isActionable: true,
        questionId: 'processorSpecificFollowUpForm',
      }
    ]);
  };

  const finishFlow = async (finalData: MerchantData) => {
    setIsTyping(true);
    const localVerification = runLocalVerificationCheck(finalData);
    const analysisData: MerchantData = {
      ...finalData,
      personaInvitePlan: finalData.personaInvitePlan || buildPersonaSummary(finalData),
      personaVerificationSummary:
        finalData.personaVerificationSummary ||
        (localVerification.status === 'clear'
          ? `Local KYC / KYB result: passed. ${localVerification.summary}`
          : `Local KYC / KYB result: pending follow-up. ${localVerification.summary}`),
      websiteReviewSummary: finalData.websiteReviewSummary || buildWebsiteSignalSummary(finalData),
    };
    setData(analysisData);
    
    // Contextual finishing message
    const isHighRisk = ['high_risk', 'crypto', 'gaming'].includes(analysisData.industry);
    const finishMessage = isHighRisk 
      ? "All done! Given your industry, I'm performing enhanced due diligence. This may take 20-30 seconds..."
      : "All done! I'm analyzing your profile and documents now. This might take 10-20 seconds...";
    
    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 15),
        sender: 'system',
        content: finishMessage,
      }
    ]);

    try {
      let prepared = prepareUnderwritePayload(analysisData);
      if (prepared.metadataOnly) {
        toast.warning('Large upload detected. Sending document metadata only so the Vercel API request stays under platform limits.');
      }

      let apiRes = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: prepared.body,
      });

      if (apiRes.status === 413 && !prepared.metadataOnly) {
        prepared = prepareUnderwritePayload(buildMetadataOnlyMerchantData(analysisData));
        toast.warning('Uploaded files were too large for a Vercel Function request. Retrying without binary document contents.');
        apiRes = await fetch('/api/underwrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: prepared.body,
        });
      }

      const rawText = await apiRes.text();
      let payload = {} as {
        riskScore?: number;
        riskCategory?: string;
        riskFactors?: string[];
        recommendedProcessor?: string;
        reason?: string;
        merchantSummary?: string;
        missingItems?: string[];
        readinessDecision?: string;
        processorFitSuggestion?: string;
        websiteReviewSummary?: string;
        documentSummary?: string;
        verificationStatus?: string;
        verificationNotes?: string[];
        error?: string;
      };
      if (rawText) {
        try {
          payload = JSON.parse(rawText) as typeof payload;
        } catch {
          payload = {};
        }
      }

      if (!apiRes.ok) {
        const detail = payload.error || rawText.trim().slice(0, 400);
        throw new Error(detail || `Request failed (${apiRes.status})`);
      }

      const vStatus = payload.verificationStatus;
      const verificationStatus =
        vStatus === 'Verified' || vStatus === 'Discrepancies Found' || vStatus === 'Unverified'
          ? vStatus
          : 'Unverified';
      const verificationNotes = Array.isArray(payload.verificationNotes)
        ? payload.verificationNotes.filter((n): n is string => typeof n === 'string')
        : [];

      const recommendation = {
        riskScore: payload.riskScore ?? 50,
        riskCategory: (payload.riskCategory as 'Low' | 'Medium' | 'High') || 'Medium',
        riskFactors: payload.riskFactors ?? [],
        recommendedProcessor: payload.recommendedProcessor ?? '',
        reason: payload.reason ?? '',
        merchantSummary: payload.merchantSummary ?? '',
        missingItems: payload.missingItems ?? [],
        readinessDecision: payload.readinessDecision ?? '',
        processorFitSuggestion: payload.processorFitSuggestion ?? '',
        websiteReviewSummary: payload.websiteReviewSummary ?? '',
        documentSummary: payload.documentSummary ?? '',
        verificationStatus,
        verificationNotes,
      };
      const recommendedProcessor = normalizeProcessorFit(recommendation.recommendedProcessor);
      const followUpAlreadyPackaged =
        hasCompletedProcessorFollowUp(analysisData) &&
        normalizeProcessorFit(analysisData.matchedProcessor) === recommendedProcessor;

      if (!followUpAlreadyPackaged) {
        openProcessorFollowUp(analysisData, recommendation);
        return;
      }
      setAiRecommendation(recommendation);
      setIsFinished(true);
      onFinish();
    } catch (error) {
      console.error('[v0] AI Analysis failed:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('[v0] Error details:', errMsg);
      const short = errMsg.length > 140 ? `${errMsg.slice(0, 140)}…` : errMsg;
      toast.error(`Analysis failed: ${short} (using fallback)`);
      const fallback = getFallbackUnderwriting(analysisData);
      const fallbackProcessor = normalizeProcessorFit(fallback.recommendedProcessor);
      const followUpAlreadyPackaged =
        hasCompletedProcessorFollowUp(analysisData) &&
        normalizeProcessorFit(analysisData.matchedProcessor) === fallbackProcessor;

      if (!followUpAlreadyPackaged) {
        openProcessorFollowUp(analysisData, fallback);
        return;
      }
      setAiRecommendation(fallback);
      setIsFinished(true);
      onFinish();
    } finally {
      setIsTyping(false);
    }
  };

  const handleGuidedContinue = () => {
    if (!guidedTourOrder?.length) return;
    const snap = guidedAfterData ?? data;
    setGuidedAwaitContinue(false);
    setGuidedAfterData(null);
    const missing = getMissingDocumentKeys(snap);
    if (missing.length === 0) {
      setIsEditing(false);
      setIsFinished(true);
      onGuidedFlowComplete?.();
      return;
    }
    let next = getNextMissingInTourOrder(
      guidedTourOrder,
      currentQuestion as MerchantDocumentKey,
      snap
    );
    if (!next) next = missing[0] ?? null;
    if (!next) {
      setIsEditing(false);
      setIsFinished(true);
      onGuidedFlowComplete?.();
      return;
    }
    setCurrentQuestion(next as QuestionId);
    askQuestion(next as QuestionId);
  };

  const abortEditing = () => {
    setIsEditing(false);
    setGuidedAwaitContinue(false);
    setGuidedAfterData(null);
    if (guidedTourOrder?.length) {
      onGuidedFlowAbort?.();
      return;
    }
    setCurrentQuestion('done');
    finishFlow(data);
  };

  const renderInputArea = () => {
    if (guidedAwaitContinue && guidedTourOrder?.length) {
      const snap = guidedAfterData ?? data;
      const missing = getMissingDocumentKeys(snap);
      const doneAll = missing.length === 0;
      const nextKey = doneAll
        ? null
        : getNextMissingInTourOrder(
            guidedTourOrder,
            currentQuestion as MerchantDocumentKey,
            snap
          ) ?? missing[0];
      return (
        <div className="border-t bg-emerald-50/95 px-4 py-4 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
          <p className="text-center text-sm text-slate-800">
            {doneAll
              ? 'All items in this upload pass are accounted for. You can return to Application Status.'
              : 'When you are finished with this document, continue to the next required upload.'}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button type="button" className="gap-2 bg-emerald-700 hover:bg-emerald-800" onClick={handleGuidedContinue}>
              {doneAll
                ? 'Back to Application Status'
                : nextKey
                  ? `Continue: ${MERCHANT_DOCUMENT_LABELS[nextKey]}`
                  : 'Continue'}
            </Button>
          </div>
        </div>
      );
    }

    if (isFinished || isTyping || !currentQuestion || currentQuestion === 'done') return null;

    const qDef = QUESTIONS[currentQuestion];
    if (!qDef) return null;

    if (qDef.type === 'system') {
      const decision = decidePersonaInvites(data);
      return (
        <div className="border-t bg-white px-4 py-5">
          <div className="mx-auto max-w-2xl rounded-2xl border border-violet-200 bg-violet-50/70 p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">Phase 2</p>
            <h3 className="mt-1 text-base font-semibold text-slate-950">KYC / KYB invite decision</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">{decision.summary}</p>
            {decision.reasons.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {decision.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 rounded-lg border border-violet-200 bg-white p-3 text-xs leading-5 text-slate-600">
              No external Persona API is called here. The plan is attached to the merchant profile, and actual verification results can be added before AI underwriting when available.
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                className="bg-violet-700 hover:bg-violet-800"
                onClick={() =>
                  handleAnswer(
                    {
                      personaInvitePlan: buildPersonaSummary(data),
                      personaVerificationSummary: 'Pending. Attach KYB/KYC pass, fail, pending, mismatch, and incomplete verification results when available.',
                      websiteReviewSummary: buildWebsiteSignalSummary(data),
                    },
                    'KYC / KYB routing plan accepted'
                  )
                }
              >
                Continue to documents
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (qDef.type === 'form') {
      if (currentQuestion === 'processorSpecificFollowUpForm') {
        const processorQuestionSet = getProcessorQuestionSet(data.matchedProcessor || 'Nuvei');
        return (
          <div className="relative">
            {isEditing && (
              <div className="absolute -top-10 right-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={abortEditing}
                  className="text-slate-500 hover:text-slate-700 bg-white/80 backdrop-blur-sm"
                >
                  Cancel Edit
                </Button>
              </div>
            )}
            <div className="max-h-[calc(100vh-11rem)] overflow-y-auto overscroll-y-contain border-t bg-white">
              <div className="border-b bg-slate-50/90 px-4 py-4">
                <div className="mx-auto max-w-3xl rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Processor follow-up</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">
                    {processorQuestionSet.processor} readiness checklist
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Mark each item instead of writing a long narrative. Add short notes only where the status needs context.
                  </p>
                </div>
              </div>
              <div className="p-4">
                <form
                  className="mx-auto max-w-3xl space-y-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const lines: string[] = [`Processor follow-up for ${processorQuestionSet.processor}`];

                    processorQuestionSet.sections.forEach((section, sectionIndex) => {
                      lines.push(`\n${section.title}:`);
                      section.questions.forEach((question, questionIndex) => {
                        const status = String(formData.get(`followUp-${sectionIndex}-${questionIndex}`) || '');
                        const note = String(formData.get(`followUpNote-${sectionIndex}-${questionIndex}`) || '').trim();
                        lines.push(`- ${question}: ${status}${note ? ` (${note})` : ''}`);
                      });
                    });

                    const generalNotes = String(formData.get('processorFollowUpGeneralNotes') || '').trim();
                    if (generalNotes) {
                      lines.push(`\nAdditional notes: ${generalNotes}`);
                    }

                    handleAnswer({ processorSpecificAnswers: lines.join('\n') }, 'Completed processor-specific checklist');
                  }}
                >
                  {processorQuestionSet.sections.map((section, sectionIndex) => (
                    <div key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <h4 className="text-sm font-semibold text-slate-900">{section.title}</h4>
                      <div className="mt-3 space-y-3">
                        {section.questions.map((question, questionIndex) => (
                          <div key={question} className="rounded-xl border border-slate-200 bg-white p-3">
                            <label className="text-sm font-medium leading-5 text-slate-800">
                              {question}
                            </label>
                            <div className="mt-2 grid gap-2 md:grid-cols-[220px_1fr]">
                              <Select
                                name={`followUp-${sectionIndex}-${questionIndex}`}
                                required
                                defaultValue=""
                                className="bg-white"
                              >
                                <option value="">Choose status...</option>
                                {PROCESSOR_FOLLOW_UP_STATUS_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                              <Input
                                name={`followUpNote-${sectionIndex}-${questionIndex}`}
                                placeholder="Optional short note"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <label className="text-sm font-semibold text-slate-900">Optional overall note</label>
                    <textarea
                      name="processorFollowUpGeneralNotes"
                      rows={3}
                      className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="Only add anything unusual or blocker-level here."
                    />
                  </div>
                  <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
                    <Button type="submit">Build Processor Package</Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="relative">
          {isEditing && (
            <div className="absolute -top-10 right-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={abortEditing}
                className="text-slate-500 hover:text-slate-700 bg-white/80 backdrop-blur-sm"
              >
                Cancel Edit
              </Button>
            </div>
          )}
          <div className="max-h-[calc(100vh-11rem)] overflow-y-auto overscroll-y-contain border-t bg-white">
            {smartGuide ? (
              <div className="border-b bg-slate-50/90 px-4 py-4">
                <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{smartGuide.eyebrow}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">{smartGuide.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{smartGuide.description}</p>
                  <div className="mt-3 space-y-2">
                    {smartGuide.tips.map((tip, index) => (
                      <div key={`${tip}-${index}`} className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="p-4">
            <form 
              className="space-y-4 max-w-2xl mx-auto"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const values: Record<string, any> = {};
                let allFilled = true;
                qDef.fields?.forEach(f => {
                  const val = formData.get(f.id) as string;
                  values[f.id] = val;
                  if (f.required !== false && !val) allFilled = false;
                });
                if (!allFilled) {
                  toast.error("Please fill out all fields.");
                  return;
                }
                handleAnswer(values, "Provided details");
              }}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qDef.fields?.map(field => (
                  <div key={field.id} className={`space-y-1 ${field.type === 'textarea' ? 'md:col-span-2' : ''}`}>
                    <label className="text-sm font-medium text-slate-700">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        name={field.id}
                        required={field.required !== false}
                        placeholder={
                          field.id === 'processorSpecificAnswers'
                            ? getProcessorQuestionPrompt(data.matchedProcessor || 'Nuvei')
                            : getFieldPlaceholder(field.id, data)
                        }
                        defaultValue={data[field.id as keyof MerchantData] as string || ''}
                        className="min-h-[112px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    ) : field.type === 'select' ? (
                      <Select
                        name={field.id}
                        required={field.required !== false}
                        defaultValue={data[field.id as keyof MerchantData] as string || ''}
                        className="bg-white"
                      >
                        <option value="">Select one...</option>
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        name={field.id}
                        type={field.type}
                        required={field.required !== false}
                        placeholder={getFieldPlaceholder(field.id, data)}
                        defaultValue={data[field.id as keyof MerchantData] as string || ''}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-slate-200 bg-white/95 px-4 py-3 pt-3 backdrop-blur">
                <Button type="submit">Submit Details</Button>
              </div>
            </form>
          </div>
          </div>
        </div>
      );
    }

    if (qDef.type === 'buttons') {
      return (
        <div className="relative">
          {isEditing && (
            <div className="absolute -top-10 right-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={abortEditing}
                className="text-slate-500 hover:text-slate-700 bg-white/80 backdrop-blur-sm"
              >
                Cancel Edit
              </Button>
            </div>
          )}
          <div className="border-t bg-white">
            {smartGuide ? (
              <div className="border-b bg-slate-50/90 px-4 py-4">
                <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{smartGuide.eyebrow}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">{smartGuide.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{smartGuide.description}</p>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 p-4 justify-center">
            {qDef.options?.map(opt => (
              <motion.div
                key={opt.value}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Button
                  variant="outline"
                  className="hover:bg-emerald-50 hover:border-emerald-500"
                  onClick={() => handleAnswer(opt.value, opt.label)}
                >
                  {opt.label}
                </Button>
              </motion.div>
            ))}
          </div>
          </div>
        </div>
      );
    }

    if (qDef.type === 'dropdown') {
      return (
        <div className="relative">
          {isEditing && (
            <div className="absolute -top-10 right-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={abortEditing}
                className="text-slate-500 hover:text-slate-700 bg-white/80 backdrop-blur-sm"
              >
                Cancel Edit
              </Button>
            </div>
          )}
          <div className="border-t bg-white">
            {smartGuide ? (
              <div className="border-b bg-slate-50/90 px-4 py-4">
                <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{smartGuide.eyebrow}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">{smartGuide.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{smartGuide.description}</p>
                </div>
              </div>
            ) : null}
            <div className="flex gap-2 p-4 max-w-md mx-auto">
            <Select
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1"
            >
              <option value="">Select an option...</option>
              {qDef.options?.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <Button
              onClick={() => {
                if (inputValue) {
                  const opt = qDef.options?.find(o => o.value === inputValue);
                  handleAnswer(inputValue, opt?.label);
                }
              }}
              disabled={!inputValue}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          </div>
        </div>
      );
    }

    if (qDef.type === 'upload') {
      return (
        <div className="relative">
          {isEditing && (
            <div className="absolute -top-10 right-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={abortEditing}
                className="text-slate-500 hover:text-slate-700 bg-white/80 backdrop-blur-sm"
              >
                Cancel Edit
              </Button>
            </div>
          )}
          <div className="border-t bg-white">
            {smartGuide ? (
              <div className="border-b bg-slate-50/90 px-4 py-4">
                <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{smartGuide.eyebrow}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">{smartGuide.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{smartGuide.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {smartGuide.tips.map((tip, index) => (
                      <span key={`${tip}-${index}`} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                        {tip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="p-4">
            <div className="max-w-md mx-auto">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-slate-400" />
                  <p className="text-sm text-slate-500">Click to upload or drag and drop</p>
                  <p className="text-xs text-slate-400">PDF, PNG, JPG up to 10MB. Large images and PDFs are optimized before upload when possible.</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const prepared = await prepareFileForUpload(file);
                        prepared.notices.forEach((notice) => {
                          if (notice.level === 'warning') {
                            toast.warning(notice.message);
                          } else {
                            toast.success(notice.message);
                          }
                        });
                        setDocuments(prev => [...prev, prepared.fileData]);
                        handleAnswer(prepared.fileData, `Uploaded: ${prepared.fileData.name}`);
                      } catch (error) {
                        const message = error instanceof Error ? error.message : `Failed to prepare ${file.name}`;
                        toast.error(message);
                      }
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              <div className="mt-3 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAnswer(null, smartGuide?.skipLabel || 'Skipped')}
                  className="text-slate-500"
                >
                  {smartGuide?.skipLabel || 'Skip this document'}
                </Button>
              </div>
            </div>
          </div>
          </div>
        </div>
      );
    }

    // Text input
    return (
      <div className="relative">
        {isEditing && (
          <div className="absolute -top-10 right-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={abortEditing}
              className="text-slate-500 hover:text-slate-700 bg-white/80 backdrop-blur-sm"
            >
              Cancel Edit
            </Button>
          </div>
        )}
        <div className="border-t bg-white">
        {smartGuide ? (
          <div className="border-b bg-slate-50/90 px-4 py-4">
            <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{smartGuide.eyebrow}</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">{smartGuide.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{smartGuide.description}</p>
            </div>
          </div>
        ) : null}
        <form 
          className="flex gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (inputValue.trim()) {
              handleAnswer(inputValue.trim());
            }
          }}
        >
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={currentQuestion === 'complianceDetails' ? 'A short plain-English summary is enough...' : 'Type your answer...'}
            className="flex-1"
          />
          <Button type="submit" disabled={!inputValue.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        </div>
      </div>
    );
  };

  const getIcon = (qId?: QuestionId) => {
    if (!qId) return <Zap className="w-5 h-5" />;
    if (qId === 'businessType') return <Building2 className="w-5 h-5" />;
    if (qId === 'country') return <Globe className="w-5 h-5" />;
    if (qId === 'industry') return <Activity className="w-5 h-5" />;
    if (qId.includes('upload') || qId.includes('Upload') || qId === 'financials' || qId === 'bankStatement' || qId === 'proofOfAddress' || qId === 'registrationCertificate' || qId === 'complianceDocument' || qId === 'proofOfFunds' || qId === 'taxDocument' || qId === 'enhancedVerification') return <FileText className="w-5 h-5" />;
    if (qId === 'complianceDetails' || qId.includes('compliance') || qId.includes('Compliance')) return <ShieldCheck className="w-5 h-5" />;
    return <Zap className="w-5 h-5" />;
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white">
      {!isFinished && currentQuestion !== 'done' ? (
        <div className="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-between gap-4 text-xs text-slate-500">
              <div>
                <span className="font-semibold text-slate-700">{getQuestionStage(currentQuestion)}</span>
                <span className="ml-2">Step {currentStepIndex} of {questionSequence.length}</span>
              </div>
              <div>{remainingCount > 0 ? `${remainingCount} step(s) left` : 'Final step'}</div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.sender === 'user' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                }`}>
                  {msg.sender === 'user' ? '?' : getIcon(msg.questionId)}
                </div>
                <div className={`rounded-2xl px-4 py-3 ${
                  msg.sender === 'user'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white border border-slate-200 shadow-sm'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {renderInputArea()}
    </div>
  );
}
