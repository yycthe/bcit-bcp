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

type QuestionId = Exclude<keyof MerchantData, 'additionalDocuments'> | 'done' | 'companyDetailsForm' | 'contactAddressForm' | 'businessOperationsForm' | 'ownerDetailsForm' | 'bankAccountForm' | 'subscriptionForm' | 'retailForm' | 'highRiskForm' | 'cryptoForm' | 'gamingForm' | 'servicesForm';

interface QuestionDef {
  id: QuestionId;
  text: string;
  type: 'buttons' | 'dropdown' | 'text' | 'upload' | 'form';
  options?: { label: string; value: string }[];
  fields?: { id: keyof MerchantData; label: string; type: 'text' | 'email' | 'number' | 'date' }[];
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

function inferMimeFromFileName(fileName: string, browserMime: string): string {
  const t = browserMime.trim();
  if (t) return t;
  const lo = fileName.toLowerCase();
  if (lo.endsWith('.pdf')) return 'application/pdf';
  if (/\.jpe?g$/i.test(lo)) return 'image/jpeg';
  if (lo.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
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

function buildQuestionSequence(data: MerchantData): QuestionId[] {
  const isHighRisk = ['high_risk', 'crypto', 'gaming'].includes(data.industry);
  const isSubscription = data.industry === 'software';
  const isPhysicalGoods = data.industry === 'retail';
  const isServices = data.industry === 'services';
  const isCrypto = data.industry === 'crypto';
  const isGaming = data.industry === 'gaming';
  const isInternational = data.country !== 'CA' && data.country !== 'US' && data.country !== '';
  const isHighVolume = data.monthlyVolume === '>250k' || data.monthlyVolume === '50k-250k';

  const followUpSequence: QuestionId[] = [
    'companyDetailsForm',
    'contactAddressForm',
    'ownerDetailsForm',
    'businessOperationsForm',
    'bankAccountForm',
  ];

  if (isSubscription) followUpSequence.push('subscriptionForm');
  if (isPhysicalGoods) followUpSequence.push('retailForm');
  if (isCrypto) followUpSequence.push('cryptoForm');
  if (isGaming) followUpSequence.push('gamingForm');
  if (isServices) followUpSequence.push('servicesForm');
  if (data.industry === 'high_risk') followUpSequence.push('highRiskForm');
  if (isHighRisk && !isCrypto && !isGaming) followUpSequence.push('complianceDetails');

  followUpSequence.push('idUpload', 'registrationCertificate');

  if (isInternational || isHighRisk) followUpSequence.push('proofOfAddress');
  if (isHighVolume || isHighRisk) followUpSequence.push('bankStatement', 'financials');
  if (isHighRisk) followUpSequence.push('complianceDocument', 'proofOfFunds');
  if (isInternational) followUpSequence.push('enhancedVerification');

  followUpSequence.push('done');
  return [
    'businessType',
    'country',
    'industry',
    'monthlyVolume',
    'monthlyTransactions',
    ...followUpSequence,
  ];
}

function getQuestionStage(questionId: QuestionId): string {
  if (['businessType', 'country', 'industry', 'monthlyVolume', 'monthlyTransactions'].includes(questionId)) {
    return 'Qualification';
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
    legalName: 'MerchantWerx Holdings Inc.',
    taxId: data.country === 'US' ? '12-3456789' : 'Business number / tax registration',
    website: 'https://yourcompany.com',
    timeInBusiness: '2 years',
    staffSize: '12 employees',
    businessCategory: 'Digital services',
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
    accountHolderName: 'MerchantWerx Holdings Inc.',
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
    complianceDetails: 'Short overview of AML, KYC, monitoring, or licensing',
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
        'Once you choose an industry, I will switch to an industry-specific path.',
        'International or higher-risk profiles will automatically get the extra compliance steps they need.',
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
        questionId === 'ownerDetailsForm'
          ? 'We are collecting the beneficial-owner and control details processors expect, so approvals do not get stuck in manual review.'
          : `This section is tuned for ${getIndustryLabel(data.industry)} and ${businessName}. Fill the essentials now and we will keep the rest moving.`,
      tips: [
        'Short, plain-English answers are fine.',
        questionId === 'businessOperationsForm'
          ? 'If you process in more than one region, a rough domestic vs cross-border split is enough.'
          : 'If one field is not finalized yet, use the most current working answer you have.',
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
    businessType: () => "Hi there! I'm here to help you get set up with MerchantWerx. First, what type of business structure are you operating?",
    
    country: () => {
      const typeLabels: Record<string, string> = {
        'sole_proprietorship': 'sole proprietorship',
        'llc': 'LLC',
        'corporation': 'corporation',
        'partnership': 'partnership'
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
    
    companyDetailsForm: () => {
      if (data.businessType === 'sole_proprietorship') {
        return "Let's get your business details. As a sole proprietor, some of these may overlap with your personal info.";
      }
      return "Now let's capture your company's core details.";
    },
    
    contactAddressForm: () => "Where is your business located and how can we best reach you?",
    
    ownerDetailsForm: () => {
      if (data.businessType === 'corporation') {
        return "We need details about the primary beneficial owner (25%+ ownership).";
      } else if (data.businessType === 'partnership') {
        return "Please provide details for the managing partner.";
      }
      return "Please provide details about yourself as the business owner.";
    },
    
    businessOperationsForm: () => {
      if (['crypto', 'gaming', 'high_risk'].includes(industry)) {
        return "Given your industry, we need detailed transaction information for proper risk assessment.";
      }
      return "Tell us about your typical transaction profile.";
    },
    
    bankAccountForm: () => {
      if (data.country !== 'CA' && data.country !== 'US') {
        return "For international settlements, please provide your bank details. We support most major currencies.";
      }
      return "Where should we send your funds? Please provide your settlement account details.";
    },
    
    // Industry-specific forms
    subscriptionForm: () => "Since you run a SaaS/subscription business, we need some additional details about your billing model.",
    
    retailForm: () => "For e-commerce, shipping and returns are important. Please tell us about your fulfillment process.",
    
    cryptoForm: () => "Crypto businesses have specific compliance requirements. Please provide these additional details.",
    
    gamingForm: () => "Gaming has unique regulatory considerations. Please provide these additional details.",
    
    servicesForm: () => "For professional services, understanding your billing helps with risk assessment.",
    
    highRiskForm: () => "High-risk industries require additional due diligence. Please provide these compliance details.",
    
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
    text: "Hi there! I'm here to help you get set up with MerchantWerx. First, what type of business are you operating?",
    type: 'buttons',
    options: [
      { label: 'Sole Proprietorship', value: 'sole_proprietorship' },
      { label: 'LLC', value: 'llc' },
      { label: 'Corporation', value: 'corporation' },
      { label: 'Partnership', value: 'partnership' },
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
  
  // Core Forms
  companyDetailsForm: {
    id: 'companyDetailsForm',
    text: "Please provide your company's core details.",
    type: 'form',
    fields: [
      { id: 'legalName', label: 'Legal Business Name', type: 'text' },
      { id: 'taxId', label: 'Tax ID / EIN', type: 'text' },
      { id: 'website', label: 'Business Website', type: 'text' },
      { id: 'timeInBusiness', label: 'Time in Business (e.g., 2 years)', type: 'text' },
      { id: 'staffSize', label: 'Staff Size', type: 'text' },
      { id: 'businessCategory', label: 'Business Subcategory', type: 'text' }
    ]
  },
  contactAddressForm: {
    id: 'contactAddressForm',
    text: "Where is your business located and how can we reach you?",
    type: 'form',
    fields: [
      { id: 'generalEmail', label: 'General Email', type: 'email' },
      { id: 'phone', label: 'Phone Number', type: 'text' },
      { id: 'registeredAddress', label: 'Registered Address', type: 'text' },
      { id: 'operatingAddress', label: 'Operating Address', type: 'text' },
      { id: 'city', label: 'City', type: 'text' },
      { id: 'province', label: 'Province / State', type: 'text' }
    ]
  },
  businessOperationsForm: {
    id: 'businessOperationsForm',
    text: "Tell us about your transaction profile.",
    type: 'form',
    fields: [
      { id: 'avgTxnCount', label: 'Average Monthly Transactions', type: 'number' },
      { id: 'avgTicketSize', label: 'Average Ticket Size ($)', type: 'number' },
      { id: 'targetGeography', label: 'Target Customers Geography', type: 'text' },
      { id: 'domesticCrossBorderSplit', label: 'Domestic / Cross-border Split (%)', type: 'text' },
      { id: 'processingCurrencies', label: 'Processing Currencies (e.g., USD, EUR)', type: 'text' },
      { id: 'paymentProducts', label: 'Payment Products Needed', type: 'text' }
    ]
  },
  ownerDetailsForm: {
    id: 'ownerDetailsForm',
    text: "Please provide details about the primary business owner.",
    type: 'form',
    fields: [
      { id: 'ownerName', label: 'Full Legal Name', type: 'text' },
      { id: 'ownerEmail', label: 'Owner Email', type: 'email' },
      { id: 'ownerRole', label: 'Role / Title', type: 'text' },
      { id: 'ownershipPercentage', label: 'Ownership Percentage (%)', type: 'number' },
      { id: 'ownerIdNumber', label: 'ID Number (Passport/Driver License)', type: 'text' },
      { id: 'ownerIdExpiry', label: 'ID Expiry', type: 'date' },
      { id: 'ownerCountryOfResidence', label: 'Country of Residence', type: 'text' }
    ]
  },
  bankAccountForm: {
    id: 'bankAccountForm',
    text: "Please provide your settlement account details.",
    type: 'form',
    fields: [
      { id: 'bankName', label: 'Bank Name', type: 'text' },
      { id: 'accountHolderName', label: 'Account Holder Name', type: 'text' },
      { id: 'accountNumber', label: 'Account Number / IBAN', type: 'text' },
      { id: 'routingNumber', label: 'Routing Number / Branch Code', type: 'text' },
      { id: 'settlementCurrency', label: 'Settlement Currency', type: 'text' }
    ]
  },
  
  // Industry-specific forms
  subscriptionForm: {
    id: 'subscriptionForm',
    text: "Please provide details about your subscription business.",
    type: 'form',
    fields: [
      { id: 'recurringBillingDetails', label: 'Billing Frequency (monthly/annual)', type: 'text' },
      { id: 'trialPeriod', label: 'Trial Period (if any)', type: 'text' },
      { id: 'refundPolicy', label: 'Cancellation / Refund Policy', type: 'text' },
      { id: 'churnRate', label: 'Estimated Monthly Churn Rate (%)', type: 'text' }
    ]
  },
  retailForm: {
    id: 'retailForm',
    text: "Please provide e-commerce fulfillment details.",
    type: 'form',
    fields: [
      { id: 'deliveryMethod', label: 'Delivery Method (drop-ship, in-house, etc.)', type: 'text' },
      { id: 'avgDeliveryTime', label: 'Average Delivery Time', type: 'text' },
      { id: 'shippingPolicy', label: 'Shipping Policy', type: 'text' },
      { id: 'refundPolicy', label: 'Return/Refund Policy', type: 'text' }
    ]
  },
  cryptoForm: {
    id: 'cryptoForm',
    text: "Please provide crypto/Web3 compliance details.",
    type: 'form',
    fields: [
      { id: 'cryptoServices', label: 'Services Offered (exchange, wallet, NFT, etc.)', type: 'text' },
      { id: 'amlKycProcedures', label: 'AML/KYC Procedures', type: 'text' },
      { id: 'cryptoLicenses', label: 'Licenses Held (MSB, MTL, etc.)', type: 'text' },
      { id: 'custodyArrangement', label: 'Custody Arrangement', type: 'text' }
    ]
  },
  gamingForm: {
    id: 'gamingForm',
    text: "Please provide gaming compliance details.",
    type: 'form',
    fields: [
      { id: 'gamingType', label: 'Type of Gaming (skill, chance, esports, etc.)', type: 'text' },
      { id: 'gamingLicenses', label: 'Gaming Licenses Held', type: 'text' },
      { id: 'responsibleGaming', label: 'Responsible Gaming Measures', type: 'text' },
      { id: 'ageVerification', label: 'Age Verification Methods', type: 'text' }
    ]
  },
  servicesForm: {
    id: 'servicesForm',
    text: "Please provide details about your services business.",
    type: 'form',
    fields: [
      { id: 'serviceType', label: 'Type of Services', type: 'text' },
      { id: 'billingModel', label: 'Billing Model (hourly, project, retainer)', type: 'text' },
      { id: 'contractLength', label: 'Typical Contract Length', type: 'text' },
      { id: 'refundPolicy', label: 'Refund/Dispute Policy', type: 'text' }
    ]
  },
  highRiskForm: {
    id: 'highRiskForm',
    text: "Please provide compliance details for your business.",
    type: 'form',
    fields: [
      { id: 'businessDescription', label: 'Detailed Business Description', type: 'text' },
      { id: 'regulatoryStatus', label: 'Regulatory Status/Licenses', type: 'text' },
      { id: 'chargebackHistory', label: 'Historical Chargeback Rate (%)', type: 'text' },
      { id: 'previousProcessors', label: 'Previous Payment Processors', type: 'text' }
    ]
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
    text: "Please upload your tax registration document.",
    type: 'upload'
  },
  proofOfFunds: {
    id: 'proofOfFunds',
    text: "Please upload proof of source of funds.",
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
}

export function ChatApp({ data, setData, setAiRecommendation, setIsFinished, isFinished, documents, setDocuments, editSection, setEditSection, onFinish }: ChatAppProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionId>('businessType');
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && messages.length === 0) {
      initialized.current = true;
      askQuestion('businessType');
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

    let nextQ: QuestionId;
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

  const finishFlow = async (finalData: MerchantData) => {
    setIsTyping(true);
    
    // Contextual finishing message
    const isHighRisk = ['high_risk', 'crypto', 'gaming'].includes(finalData.industry);
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
      let prepared = prepareUnderwritePayload(finalData);
      if (prepared.metadataOnly) {
        toast.warning('Large upload detected. Sending document metadata only so the Vercel API request stays under platform limits.');
      }

      let apiRes = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: prepared.body,
      });

      if (apiRes.status === 413 && !prepared.metadataOnly) {
        prepared = prepareUnderwritePayload(buildMetadataOnlyMerchantData(finalData));
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

      setAiRecommendation({
        riskScore: payload.riskScore ?? 50,
        riskCategory: (payload.riskCategory as 'Low' | 'Medium' | 'High') || 'Medium',
        riskFactors: payload.riskFactors ?? [],
        recommendedProcessor: payload.recommendedProcessor ?? '',
        reason: payload.reason ?? '',
        documentSummary: payload.documentSummary ?? '',
        verificationStatus,
        verificationNotes,
      });
      setIsFinished(true);
      onFinish();
    } catch (error) {
      console.error('[v0] AI Analysis failed:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('[v0] Error details:', errMsg);
      const short = errMsg.length > 140 ? `${errMsg.slice(0, 140)}…` : errMsg;
      toast.error(`Analysis failed: ${short} (using fallback)`);
      setAiRecommendation(getFallbackUnderwriting(finalData));
      setIsFinished(true);
      onFinish();
    } finally {
      setIsTyping(false);
    }
  };

  const renderInputArea = () => {
    if (isFinished || isTyping || !currentQuestion || currentQuestion === 'done') return null;

    const qDef = QUESTIONS[currentQuestion];
    if (!qDef) return null;

    if (qDef.type === 'form') {
      return (
        <div className="relative">
          {isEditing && (
            <div className="absolute -top-10 right-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setIsEditing(false);
                  setCurrentQuestion('done');
                  finishFlow(data);
                }}
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
                  if (!val) allFilled = false;
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
                  <div key={field.id} className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">{field.label}</label>
                    <Input 
                      name={field.id} 
                      type={field.type} 
                      required 
                      placeholder={getFieldPlaceholder(field.id, data)}
                      defaultValue={data[field.id as keyof MerchantData] as string || ''}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
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
                onClick={() => {
                  setIsEditing(false);
                  setCurrentQuestion('done');
                  finishFlow(data);
                }}
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
                onClick={() => {
                  setIsEditing(false);
                  setCurrentQuestion('done');
                  finishFlow(data);
                }}
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
                onClick={() => {
                  setIsEditing(false);
                  setCurrentQuestion('done');
                  finishFlow(data);
                }}
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
                  <p className="text-xs text-slate-400">PDF, PNG, JPG up to 10MB</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const base64 = reader.result as string;
                        const fileData: FileData = {
                          name: file.name,
                          mimeType: inferMimeFromFileName(file.name, file.type),
                          data: base64
                        };
                        setDocuments(prev => [...prev, fileData]);
                        handleAnswer(fileData, `Uploaded: ${file.name}`);
                      };
                      reader.readAsDataURL(file);
                    }
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
              onClick={() => {
                setIsEditing(false);
                setCurrentQuestion('done');
                finishFlow(data);
              }}
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
    if (qId === 'businessType' || qId === 'companyDetailsForm') return <Building2 className="w-5 h-5" />;
    if (qId === 'country' || qId === 'contactAddressForm') return <Globe className="w-5 h-5" />;
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
