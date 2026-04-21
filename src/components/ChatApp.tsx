import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Upload, CheckCircle2, FileText, ShieldCheck, AlertCircle, Building, Zap, Globe, RefreshCcw, Activity, Building2, Lightbulb, X, ArrowRight, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Select } from '@/src/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';
import { MerchantData, FileData } from '@/src/types';
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
import { ProcessorFollowUpForm } from '@/src/components/ProcessorFollowUpForm';
import { getProcessorFollowUpSpec } from '@/src/lib/intake/processorFollowUpForms';
import {
  COMMON_INTAKE_FORM_SEQUENCE,
  getCommonIntakeFormSpec,
} from '@/src/lib/intake/commonQuestionBank';
import { evaluateStrictPersonaTriggers } from '@/src/lib/intake/personaTriggerRules';
import {
  MERCHANT_FILE_QUESTION_KEYS,
  MERCHANT_DOCUMENT_LABELS,
  getMissingDocumentKeys,
  getNextMissingInTourOrder,
  type MerchantDocumentKey,
} from '@/src/lib/documentChecklist';
import { requestIntakePlan, type IntakePlan } from '@/src/lib/intake/aiPlan';

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
    helperText?: string;
    visibleWhen?: (answers: Partial<MerchantData>) => boolean;
    requiredWhen?: (answers: Partial<MerchantData>) => boolean;
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

/** Legacy deterministic path (no AI plan). */
function buildLegacyQuestionSequence(data: MerchantData): QuestionId[] {
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
    ...COMMON_INTAKE_FORM_SEQUENCE,
    'personaDecisionGate',
    ...uploadSequence,
  ];

  sequence.push('done');
  return sequence;
}

function buildQuestionSequenceFromAiPlan(plan: IntakePlan): QuestionId[] {
  const anchor: QuestionId[] = [
    'businessType',
    'country',
    'industry',
    'monthlyVolume',
    'monthlyTransactions',
  ];
  const tail: QuestionId[] = [];
  for (const s of plan.sections) {
    if (s.kind === 'common_form') tail.push(s.id as QuestionId);
    else if (s.kind === 'persona_gate') tail.push('personaDecisionGate');
    else if (s.kind === 'document') tail.push(s.id as QuestionId);
  }
  tail.push('done');
  return [...anchor, ...tail];
}

function buildQuestionSequence(data: MerchantData, plan: IntakePlan | null): QuestionId[] {
  if (!plan?.sections?.length) {
    return buildLegacyQuestionSequence(data);
  }
  return buildQuestionSequenceFromAiPlan(plan);
}

const COMMON_FORM_QUESTIONS: Partial<Record<QuestionId, QuestionDef>> = Object.fromEntries(
  COMMON_INTAKE_FORM_SEQUENCE.map((formId) => {
    const spec = getCommonIntakeFormSpec(formId);
    return [
      formId,
      {
        id: formId,
        text: spec.title,
        type: 'form',
        fields: spec.fields.map((field) => ({
          id: field.id,
          label: `Q${field.questionNumber}. ${field.label}`,
          type: field.type,
          required: field.required,
          options: field.options,
          helperText: field.helperText,
          visibleWhen: field.visibleWhen,
          requiredWhen: field.requiredWhen,
        })),
      } satisfies QuestionDef,
    ];
  })
) as Partial<Record<QuestionId, QuestionDef>>;

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
    return 'KYC / KYB checkpoint';
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
        'After AI-assisted processor routing, I will only ask the selected processor-specific questions.',
      ],
    };
  }

  if (questionId === 'monthlyVolume' || questionId === 'monthlyTransactions') {
    return {
      eyebrow: `${stage} • Pricing fit`,
      title: 'This helps us size your processor match',
      description: `For ${getIndustryLabel(data.industry)}, volume and transaction count help decide which processor lane and document depth fit best.`,
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
          : 'The goal is to keep the review moving without forcing a hard stop when a file is not handy.',
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
      "Now let's capture ownership and control. This is what decides which owners or signers need verification and whether KYB should go first.",

    processingHistoryForm: () =>
      "A few processing-history questions help detect early risk before we ask for any processor-specific details.",

    salesProfileForm: () =>
      "Let's capture the common sales profile so the routing rules can evaluate ticket size, channel mix, recurring exposure, and foreign-card exposure.",

    websiteComplianceForm: () =>
      'Now we will capture website, security, and PCI basics for the strict common-review layer.',

    documentReadinessForm: () =>
      "Last common-intake block: document readiness. This lets us separate missing documents from true risk.",

    personaDecisionGate: () => {
      const decision = decidePersonaInvites(data);
      return `${decision.summary} I will attach this virtual KYC / KYB checkpoint to the merchant profile before the AI review.`;
    },

    processorSpecificFollowUpForm: () => {
      const processor = normalizeProcessorFit(data.matchedProcessor);
      return `This case was routed to ${processor}. Now I will only ask the ${processor}-specific follow-up items, without repeating the common intake.`;
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
  ...COMMON_FORM_QUESTIONS,
  personaDecisionGate: {
    id: 'personaDecisionGate',
    text: 'KYC / KYB verification checkpoint',
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
const getNextQuestion = (currentId: QuestionId, data: MerchantData, plan: IntakePlan | null): QuestionId => {
  const fullSequence = buildQuestionSequence(data, plan);
  const followUpSequence = fullSequence.slice(5);

  // Main question flow
  switch (currentId) {
    case 'businessType':
      return 'country';
    case 'country':
      return 'industry';
    case 'industry':
      return 'monthlyVolume';
    case 'monthlyVolume':
      return 'monthlyTransactions';
    case 'monthlyTransactions':
      return followUpSequence[0] ?? 'done';
    default: {
      const index = followUpSequence.indexOf(currentId);
      if (index !== -1 && index < followUpSequence.length - 1) {
        return followUpSequence[index + 1];
      }
      return 'done';
    }
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
  /** Fired when the user applies AI-extracted field values from a document upload. */
  onAiDocumentExtractApplied?: (fieldKeys: string[]) => void;
}

export function ChatApp({
  data,
  setData,
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
  onAiDocumentExtractApplied,
}: ChatAppProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionId>('businessType');
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [guidedAwaitContinue, setGuidedAwaitContinue] = useState(false);
  const [guidedAfterData, setGuidedAfterData] = useState<MerchantData | null>(null);
  const [intakePlan, setIntakePlan] = useState<IntakePlan | null>(null);
  const [intakePlanLoading, setIntakePlanLoading] = useState(false);
  const [draftFormValues, setDraftFormValues] = useState<Record<string, string>>({});
  const [pendingDocExtract, setPendingDocExtract] = useState<{
    slot: string;
    fileName: string;
    extracted: Record<string, string>;
    confidence: number;
    notes: string;
  } | null>(null);
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

  useEffect(() => {
    const qDef = currentQuestion ? QUESTIONS[currentQuestion] : null;
    if (qDef?.type !== 'form') {
      setDraftFormValues({});
      return;
    }
    const nextValues: Record<string, string> = {};
    qDef.fields?.forEach((field) => {
      const raw = data[field.id];
      nextValues[String(field.id)] = typeof raw === 'string' ? raw : '';
    });
    setDraftFormValues(nextValues);
  }, [currentQuestion, data]);
  const questionSequence = buildQuestionSequence(data, intakePlan);
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

    if (!isEditing && currentQuestion === 'monthlyTransactions') {
      setIntakePlanLoading(true);
      setIsTyping(true);
      void requestIntakePlan({
        businessType: String(newData.businessType ?? ''),
        country: String(newData.country ?? ''),
        industry: String(newData.industry ?? ''),
        monthlyVolume: String(newData.monthlyVolume ?? ''),
        monthlyTransactions: String(newData.monthlyTransactions ?? ''),
      })
        .then((plan) => {
          if (plan.summary) {
            toast.success('Tailored intake path ready', { description: plan.summary });
          }
          if (plan._warning) toast.warning(plan._warning);
          setIntakePlan(plan);
          const seq = buildQuestionSequence(newData, plan);
          const nextQ = seq[5];
          setCurrentQuestion(nextQ);
          setIsTyping(false);
          setIntakePlanLoading(false);
          if (nextQ === 'done') {
            finishFlow(newData);
          } else {
            askQuestion(nextQ);
          }
        })
        .catch(() => {
          toast.warning('Could not load AI intake plan — using default question path.');
          setIntakePlan(null);
          const seq = buildQuestionSequence(newData, null);
          const nextQ = seq[5];
          setCurrentQuestion(nextQ);
          setIsTyping(false);
          setIntakePlanLoading(false);
          if (nextQ === 'done') {
            finishFlow(newData);
          } else {
            askQuestion(nextQ);
          }
        });
      return;
    }

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
          content: 'Processor-ready package assembled with common intake, KYC / KYB routing, AI review summary, website signals, document checklist, missing items, and processor-specific answers.',
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
      nextQ = getNextQuestion(currentQuestion, newData, intakePlan);
    }

    setCurrentQuestion(nextQ);

    if (nextQ === 'done') {
      finishFlow(newData);
    } else {
      askQuestion(nextQ);
    }
  };

  const finishFlow = (finalData: MerchantData) => {
    const localVerification = runLocalVerificationCheck(finalData);
    const enrichedData: MerchantData = {
      ...finalData,
      personaInvitePlan: finalData.personaInvitePlan || buildPersonaSummary(finalData),
      personaVerificationSummary:
        finalData.personaVerificationSummary ||
        (localVerification.status === 'clear'
          ? `Local KYC / KYB result: passed. ${localVerification.summary}`
          : `Local KYC / KYB result: pending follow-up. ${localVerification.summary}`),
      websiteReviewSummary: finalData.websiteReviewSummary || buildWebsiteSignalSummary(finalData),
    };
    setData(enrichedData);

    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 15),
        sender: 'system',
        content: 'Common intake complete. Please review your application on the next page, then submit for verification and AI review.',
      }
    ]);

    setIsFinished(true);
    onFinish();
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

  const [isDragOver, setIsDragOver] = useState(false);

  const buildExtractContext = (d: MerchantData) => ({
    legalName: d.legalName,
    ownerName: d.ownerName,
    country: d.country,
    businessType: d.businessType,
    industry: d.industry,
  });

  const applyDocExtract = () => {
    if (!pendingDocExtract) return;
    const { extracted } = pendingDocExtract;
    const keys = Object.keys(extracted);
    if (keys.length === 0) {
      setPendingDocExtract(null);
      return;
    }
    setData((prev) => {
      const next = { ...prev } as MerchantData;
      for (const k of keys) {
        if (k in next) {
          (next as unknown as Record<string, string>)[k] = extracted[k];
        }
      }
      return next;
    });
    onAiDocumentExtractApplied?.(keys);
    setPendingDocExtract(null);
    toast.success('Applied AI-suggested values to your application');
  };

  const handleUploadFile = async (file: File) => {
    const uploadSlot = currentQuestion;
    try {
      const prepared = await prepareFileForUpload(file);
      prepared.notices.forEach((notice) => {
        if (notice.level === 'warning') toast.warning(notice.message);
        else toast.success(notice.message);
      });
      setDocuments((prev) => [...prev, prepared.fileData]);
      handleAnswer(prepared.fileData, `Uploaded: ${prepared.fileData.name}`);

      const url = prepared.fileData.data;
      const extractSlots = new Set(['idUpload', 'registrationCertificate', 'bankStatement', 'proofOfAddress']);
      if (
        extractSlots.has(String(uploadSlot)) &&
        typeof url === 'string' &&
        url.startsWith('http')
      ) {
        void fetch('/api/intake/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blobUrl: url,
            mimeType: prepared.fileData.mimeType,
            slot: uploadSlot,
            knownContext: buildExtractContext(data),
          }),
        })
          .then(async (r) => {
            if (!r.ok) return;
            const json = (await r.json()) as {
              extracted?: Record<string, string>;
              confidence?: number;
              notes?: string;
            };
            const ex = json.extracted && typeof json.extracted === 'object' ? json.extracted : {};
            if (Object.keys(ex).length === 0) return;
            setPendingDocExtract({
              slot: String(uploadSlot),
              fileName: prepared.fileData.name,
              extracted: ex,
              confidence: typeof json.confidence === 'number' ? json.confidence : 0,
              notes: typeof json.notes === 'string' ? json.notes : '',
            });
          })
          .catch(() => {
            /* silent — extraction is best-effort */
          });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to prepare ${file.name}`;
      toast.error(message);
    }
  };

  const InputShell = ({
    children,
    leftHint,
    secondary,
  }: {
    children: React.ReactNode;
    leftHint?: React.ReactNode;
    secondary?: React.ReactNode;
  }) => (
    <div className="shrink-0 border-t border-border bg-surface/95 backdrop-blur-md">
      {isEditing && (
        <div className="border-b border-border bg-warning-soft/60 px-4 py-1.5 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 text-xs">
            <span className="font-medium text-warning-foreground">Editing this answer</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={abortEditing}
              className="text-warning-foreground hover:bg-warning/10"
            >
              <X className="h-3 w-3" />
              Cancel edit
            </Button>
          </div>
        </div>
      )}
      <div className="px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {leftHint && (
            <div className="text-[11px] text-foreground-subtle">{leftHint}</div>
          )}
          {children}
          {secondary && <div className="flex flex-wrap items-center gap-2">{secondary}</div>}
        </div>
      </div>
    </div>
  );

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
        <div className="shrink-0 border-t border-border bg-brand-soft/70">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-4 sm:px-6 sm:flex-row sm:justify-between">
            <p className="text-sm text-foreground">
              {doneAll
                ? 'All items in this upload pass are accounted for.'
                : 'When you are finished with this document, continue to the next required upload.'}
            </p>
            <Button
              type="button"
              variant="brand"
              onClick={handleGuidedContinue}
              className="gap-2"
            >
              {doneAll
                ? 'Back to Application Status'
                : nextKey
                ? `Continue: ${MERCHANT_DOCUMENT_LABELS[nextKey]}`
                : 'Continue'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      );
    }

    if (isFinished || isTyping || !currentQuestion || currentQuestion === 'done') return null;

    const qDef = QUESTIONS[currentQuestion];
    if (!qDef) return null;

    if (qDef.type === 'system') {
      const decision = evaluateStrictPersonaTriggers(data);
      const checkpointButtonLabel =
        decision.missingReadinessItems.length > 0
          ? 'Save draft checkpoint and continue'
          : 'Save checkpoint and continue';
      return (
        <div className="shrink-0 border-t border-border bg-surface px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-2xl border border-accent/20 bg-accent-soft/70 p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-info-foreground">
                Phase 2 — KYC / KYB checkpoint
              </p>
            </div>
            <h3 className="mt-3 text-base font-semibold text-foreground">
              Smart KYC / KYB verification checkpoint
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{decision.summary}</p>
            {decision.missingReadinessItems.length > 0 ? (
              <div className="mt-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning-foreground">
                <p className="font-semibold">Still missing before the checkpoint is fully ready</p>
                <ul className="mt-1.5 space-y-1">
                  {decision.missingReadinessItems.map((item) => (
                    <li key={item} className="flex gap-2 text-xs leading-relaxed">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {decision.reasons.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-sm text-foreground-muted">
                {decision.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="leading-relaxed">{reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] leading-relaxed text-foreground-muted">
              This checkpoint follows the onboarding policy rules. No external KYC / KYB provider is called here; we save the verification plan locally and the admin can attach manual results before the AI review when available.
            </p>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="accent"
                onClick={() =>
                  handleAnswer(
                    {
                      personaInvitePlan: buildPersonaSummary(data),
                      personaVerificationSummary:
                        'Pending. Virtual KYC / KYB checkpoint created. Attach KYB/KYC pass, fail, pending, mismatch, and incomplete verification results when available.',
                      websiteReviewSummary: buildWebsiteSignalSummary(data),
                    },
                    'KYC / KYB checkpoint saved'
                  )
                }
              >
                {checkpointButtonLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (qDef.type === 'form') {
      if (currentQuestion === 'processorSpecificFollowUpForm') {
        const processorFit = normalizeProcessorFit(data.matchedProcessor || 'Nuvei');
        const spec = getProcessorFollowUpSpec(processorFit);
        let initialAnswers: Record<string, string> = {};
        if (data.processorSpecificAnswersJson) {
          try {
            initialAnswers = JSON.parse(data.processorSpecificAnswersJson) || {};
          } catch {
            initialAnswers = {};
          }
        }
        return (
          <div className="shrink-0 border-t border-border bg-surface">
            {isEditing && (
              <div className="border-b border-border bg-warning-soft/60 px-4 py-1.5 sm:px-6">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-warning-foreground">Editing processor follow-up</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={abortEditing}
                    className="text-warning-foreground hover:bg-warning/10"
                  >
                    <X className="h-3 w-3" />
                    Cancel edit
                  </Button>
                </div>
              </div>
            )}
            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto overscroll-y-contain">
              <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
                <ProcessorFollowUpForm
                  processor={processorFit}
                  initialAnswers={initialAnswers}
                  submitLabel="Build processor package"
                  onSubmit={(answers) => {
                    const lines: string[] = [`${spec.processor} processor-specific follow-up`];
                    spec.sections.forEach((section) => {
                      const sectionLines: string[] = [];
                      section.fields.forEach((field) => {
                        const val = (answers[field.id] || '').trim();
                        if (val) sectionLines.push(`- ${field.label}: ${val}`);
                      });
                      if (sectionLines.length) {
                        lines.push(`\n${section.title}:`);
                        lines.push(...sectionLines);
                      }
                    });
                    handleAnswer(
                      {
                        processorSpecificAnswers: lines.join('\n'),
                        processorSpecificAnswersJson: JSON.stringify(answers),
                      },
                      `Completed ${spec.processor} follow-up`
                    );
                  }}
                />
              </div>
            </div>
          </div>
        );
      }

      const mergedFormAnswers = {
        ...data,
        ...draftFormValues,
      } as Partial<MerchantData>;

      const visibleFields =
        qDef.fields?.filter((field) => {
          if (!field.visibleWhen) return true;
          return field.visibleWhen(mergedFormAnswers);
        }) || [];

      const getFieldRequired = (field: NonNullable<QuestionDef['fields']>[number]) => {
        if (field.requiredWhen) return field.requiredWhen(mergedFormAnswers);
        return field.required !== false;
      };

      const handleFieldChange = (fieldId: keyof MerchantData, value: string) => {
        setDraftFormValues((prev) => ({
          ...prev,
          [fieldId]: value,
        }));
      };

      return (
        <div className="shrink-0 border-t border-border bg-surface">
          {isEditing && (
            <div className="border-b border-border bg-warning-soft/60 px-4 py-1.5 sm:px-6">
              <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 text-xs">
                <span className="font-medium text-warning-foreground">Editing this section</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={abortEditing}
                  className="text-warning-foreground hover:bg-warning/10"
                >
                  <X className="h-3 w-3" />
                  Cancel edit
                </Button>
              </div>
            </div>
          )}
          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto overscroll-y-contain">
            <form
              className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6"
              onSubmit={(e) => {
                e.preventDefault();
                const values: Record<string, any> = {};
                let allFilled = true;
                qDef.fields?.forEach((f) => {
                  const isVisible = f.visibleWhen ? f.visibleWhen(mergedFormAnswers) : true;
                  if (!isVisible) {
                    values[f.id] = '';
                    return;
                  }
                  const val = draftFormValues[String(f.id)] || '';
                  values[f.id] = val;
                  if (getFieldRequired(f) && !val.trim()) allFilled = false;
                });
                if (!allFilled) {
                  toast.error('Please fill out all fields.');
                  return;
                }
                handleAnswer(values, 'Provided details');
              }}
            >
              <div className="rounded-lg border border-brand/15 bg-brand-soft/40 px-3 py-2 text-xs text-foreground-subtle">
                We only show the follow-up fields that matter for your answers so far.
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {visibleFields.map((field) => {
                  const isRequired = getFieldRequired(field);
                  const value = draftFormValues[String(field.id)] || '';

                  return (
                    <div
                      key={field.id}
                      className={cn('space-y-1.5', field.type === 'textarea' && 'md:col-span-2')}
                    >
                      <label className="text-xs font-semibold text-foreground">
                        {field.label}
                        {isRequired && (
                          <span className="ml-1 text-danger">*</span>
                        )}
                      </label>
                      {field.helperText && (
                        <p className="text-[11px] text-foreground-subtle">{field.helperText}</p>
                      )}
                      {field.type === 'textarea' ? (
                        <textarea
                          name={field.id}
                          required={isRequired}
                          placeholder={
                            field.id === 'processorSpecificAnswers'
                              ? getProcessorQuestionPrompt(data.matchedProcessor || 'Nuvei')
                              : getFieldPlaceholder(field.id, data)
                          }
                          value={value}
                          onChange={(event) => handleFieldChange(field.id, event.target.value)}
                          className="min-h-[120px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs outline-none transition-colors hover:border-border-strong focus:border-brand"
                        />
                      ) : field.type === 'select' ? (
                        <Select
                          name={field.id}
                          required={isRequired}
                          value={value}
                          onChange={(event) => handleFieldChange(field.id, event.target.value)}
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
                          required={isRequired}
                          placeholder={getFieldPlaceholder(field.id, data)}
                          value={value}
                          onChange={(event) => handleFieldChange(field.id, event.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="sticky -bottom-px -mx-4 flex justify-end border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
                <Button type="submit" variant="brand">
                  Submit details
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    if (qDef.type === 'buttons') {
      return (
        <InputShell leftHint={`Pick one to continue`}>
          <div className="flex flex-wrap items-center gap-2">
            {qDef.options?.map((opt) => (
              <motion.div
                key={opt.value}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <Button
                  type="button"
                  variant="outline"
                  className="hover:border-brand hover:bg-brand-soft hover:text-brand-strong"
                  onClick={() => handleAnswer(opt.value, opt.label)}
                >
                  {opt.label}
                </Button>
              </motion.div>
            ))}
          </div>
        </InputShell>
      );
    }

    if (qDef.type === 'dropdown') {
      return (
        <InputShell leftHint="Choose from the list">
          <div className="flex items-center gap-2">
            <Select
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1"
            >
              <option value="">Select an option...</option>
              {qDef.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="brand"
              size="icon"
              onClick={() => {
                if (inputValue) {
                  const opt = qDef.options?.find((o) => o.value === inputValue);
                  handleAnswer(inputValue, opt?.label);
                }
              }}
              disabled={!inputValue}
              aria-label="Submit selection"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </InputShell>
      );
    }

    if (qDef.type === 'upload') {
      return (
        <InputShell
          leftHint="PDF, PNG, JPG up to 10MB. Files are optimized client-side when possible."
          secondary={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleAnswer(null, smartGuide?.skipLabel || 'Skipped')}
            >
              {smartGuide?.skipLabel || 'Skip this document'}
            </Button>
          }
        >
          <label
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) await handleUploadFile(file);
            }}
            className={cn(
              'group relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-7 text-center transition-all',
              isDragOver
                ? 'border-brand bg-brand-soft/70 scale-[1.01]'
                : 'border-border bg-surface-muted/60 hover:border-brand/60 hover:bg-brand-soft/40'
            )}
          >
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                isDragOver
                  ? 'bg-brand text-brand-foreground'
                  : 'bg-surface text-brand-strong border border-border'
              )}
            >
              <Upload className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium text-foreground">
              {isDragOver ? 'Drop file to upload' : 'Click to upload or drag & drop'}
            </p>
            <p className="text-[11px] text-foreground-muted">
              Accepted: PDF, PNG, JPG, WebP
            </p>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await handleUploadFile(file);
                e.target.value = '';
              }}
            />
          </label>
        </InputShell>
      );
    }

    // Text input
    return (
      <InputShell leftHint="Type your answer and press Enter">
        <form
          className="flex items-center gap-2"
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
            placeholder={
              currentQuestion === 'complianceDetails'
                ? 'A short plain-English summary is enough...'
                : 'Type your answer...'
            }
            className="flex-1"
          />
          <Button
            type="submit"
            variant="brand"
            size="icon"
            disabled={!inputValue.trim()}
            aria-label="Submit answer"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </InputShell>
    );
  };

  const getIcon = (qId?: QuestionId) => {
    if (!qId) return <Bot className="h-4 w-4" />;
    if (qId === 'businessType') return <Building2 className="h-4 w-4" />;
    if (qId === 'country') return <Globe className="h-4 w-4" />;
    if (qId === 'industry') return <Activity className="h-4 w-4" />;
    if (
      qId.includes('upload') ||
      qId.includes('Upload') ||
      qId === 'financials' ||
      qId === 'bankStatement' ||
      qId === 'proofOfAddress' ||
      qId === 'registrationCertificate' ||
      qId === 'complianceDocument' ||
      qId === 'proofOfFunds' ||
      qId === 'taxDocument' ||
      qId === 'enhancedVerification'
    )
      return <FileText className="h-4 w-4" />;
    if (qId === 'complianceDetails' || qId.includes('compliance') || qId.includes('Compliance'))
      return <ShieldCheck className="h-4 w-4" />;
    return <Bot className="h-4 w-4" />;
  };

  // Stages that the merchant moves through, used for the horizontal stepper.
  const STAGES = [
    'Common intake',
    'KYC / KYB checkpoint',
    'Documents',
    'Business profile',
    'Processor follow-up',
  ];
  const currentStageLabel = currentQuestion && currentQuestion !== 'done'
    ? getQuestionStage(currentQuestion)
    : 'Review';
  const currentStageIndex = Math.max(0, STAGES.indexOf(currentStageLabel));

  return (
    <div className="relative flex h-full min-h-0 w-full">
      <div className="flex min-h-0 flex-1 flex-col bg-surface-gradient">
        {!isFinished && currentQuestion !== 'done' ? (
          <div className="shrink-0 border-b border-border bg-surface/85 px-4 py-3 backdrop-blur-md sm:px-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-2.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-strong">
                    <Zap className="h-3 w-3" />
                    {currentStageLabel}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {intakePlanLoading
                      ? 'Tailoring your application with AI…'
                      : `Step ${currentStepIndex} of ${questionSequence.length}`}
                  </span>
                </div>
                <span className="text-xs font-medium text-foreground-muted">
                  {remainingCount > 0 ? `${remainingCount} step${remainingCount === 1 ? '' : 's'} left` : 'Final step'}
                </span>
              </div>
              {/* Stage stepper dots */}
              <div className="hidden sm:flex items-center gap-1">
                {STAGES.map((stage, idx) => {
                  const reached = idx <= currentStageIndex;
                  const isActive = idx === currentStageIndex;
                  return (
                    <div key={stage} className="flex items-center gap-1 flex-1">
                      <div
                        className={cn(
                          'h-1.5 flex-1 rounded-full transition-all',
                          isActive
                            ? 'bg-brand'
                            : reached
                            ? 'bg-brand/60'
                            : 'bg-surface-subtle'
                        )}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Mobile progress bar */}
              <div className="sm:hidden h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-5 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {pendingDocExtract && (
              <Card className="border-brand/30 bg-brand-soft/25 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-brand" /> AI read your document
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {pendingDocExtract.fileName} · {Math.round(pendingDocExtract.confidence * 100)}% confidence
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <ul className="space-y-1 text-foreground">
                    {Object.entries(pendingDocExtract.extracted).map(([k, v]) => (
                      <li key={k}>
                        <span className="font-medium">{k}</span>: {v}
                      </li>
                    ))}
                  </ul>
                  {pendingDocExtract.notes ? (
                    <p className="text-foreground-muted">{pendingDocExtract.notes}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="brand" type="button" onClick={applyDocExtract}>
                      Apply to form
                    </Button>
                    <Button size="sm" variant="outline" type="button" onClick={() => setPendingDocExtract(null)}>
                      Ignore
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <AnimatePresence>
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'flex max-w-[85%] gap-2.5',
                        isUser ? 'flex-row-reverse' : ''
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm',
                          isUser
                            ? 'bg-accent'
                            : 'bg-gradient-to-br from-brand to-accent'
                        )}
                      >
                        {isUser ? <User className="h-3.5 w-3.5" /> : getIcon(msg.questionId)}
                      </div>
                      <div
                        className={cn(
                          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs',
                          isUser
                            ? 'bg-accent text-accent-foreground rounded-tr-sm'
                            : 'bg-surface text-foreground border border-border rounded-tl-sm'
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-2.5"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent text-white shadow-sm">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3 shadow-xs">
                  <div className="flex gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-foreground-subtle animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-foreground-subtle animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-foreground-subtle animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Compact mobile guide above input */}
        {smartGuide && !isFinished && currentQuestion !== 'done' && (
          <div className="lg:hidden shrink-0 border-t border-border bg-surface-muted/70 px-3 py-2 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <details className="group rounded-lg border border-border bg-surface px-3 py-2 shadow-xs">
                <summary className="flex cursor-pointer items-center gap-2 list-none">
                  <Lightbulb className="h-3.5 w-3.5 text-brand" />
                  <span className="text-xs font-semibold text-foreground">{smartGuide.title}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-foreground-subtle group-open:hidden">
                    Show tip
                  </span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-foreground-subtle hidden group-open:inline">
                    Hide
                  </span>
                </summary>
                <p className="mt-2 text-xs text-foreground-muted leading-relaxed">{smartGuide.description}</p>
                {smartGuide.tips.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {smartGuide.tips.map((tip, idx) => (
                      <li
                        key={`${tip}-${idx}`}
                        className="flex gap-2 text-[11px] text-foreground-muted leading-snug"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </div>
          </div>
        )}

        {/* Input toolbar */}
        {renderInputArea()}
      </div>

      {/* Side guide drawer (lg+) */}
      {smartGuide && !isFinished && currentQuestion !== 'done' && (
        <aside className="hidden lg:flex w-[300px] shrink-0 flex-col border-l border-border bg-surface-muted/40 overflow-y-auto">
          <div className="px-5 py-5">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                  <Lightbulb className="h-3.5 w-3.5" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
                  {smartGuide.eyebrow}
                </p>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground leading-snug">
                {smartGuide.title}
              </h3>
              <p className="mt-2 text-xs text-foreground-muted leading-relaxed">
                {smartGuide.description}
              </p>
              {smartGuide.tips.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-border pt-3">
                  {smartGuide.tips.map((tip, idx) => (
                    <li
                      key={`${tip}-${idx}`}
                      className="flex gap-2 text-xs text-foreground-muted leading-relaxed"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                      {tip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-4 px-1 text-[11px] text-foreground-subtle leading-relaxed">
              Tips and required fields update automatically based on your answers.
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}
