import type { MerchantData } from '@/src/types';

export type PersonaInviteAction = 'none' | 'kyb' | 'kyc' | 'both' | 'kyb_first';
export type ProcessorFit = 'Nuvei' | 'Payroc / Peoples' | 'Chase';

export type PersonaInviteDecision = {
  action: PersonaInviteAction;
  kybRecipients: string[];
  kycRecipients: string[];
  holdKycRecipients: string[];
  reasons: string[];
  summary: string;
};

type ProcessorQuestionSet = {
  processor: ProcessorFit;
  sections: Array<{
    title: string;
    questions: string[];
  }>;
};

const BUSINESS_ENTITY_TYPES = new Set([
  'corporation',
  'partnership',
  'llc',
  'limited_liability',
  'non_profit',
  'government',
  'parent_owned',
]);

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function yes(value: unknown): boolean {
  return typeof value === 'string' && ['yes', 'y', 'true'].includes(value.trim().toLowerCase());
}

function splitPeople(value: string): string[] {
  return value
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function namedRecipient(name: string, email?: string): string {
  return hasText(email) ? `${name} <${email}>` : name;
}

export function decidePersonaInvites(data: MerchantData): PersonaInviteDecision {
  const reasons: string[] = [];
  const kybRecipients: string[] = [];
  const kycRecipients: string[] = [];
  const holdKycRecipients: string[] = [];
  const isBusinessEntity = BUSINESS_ENTITY_TYPES.has(data.businessType);
  const ownerRows = splitPeople(data.beneficialOwners);
  const signerName = data.authorizedSignerName || data.ownerName;
  const signerEmail = data.authorizedSignerEmail || data.ownerEmail;
  const hasSigner = hasText(signerName);
  const hasOwnerList = ownerRows.length > 0 || hasText(data.ownerName);
  const ownershipAmbiguous =
    yes(data.parentOwned) ||
    data.businessType === 'parent_owned' ||
    !hasOwnerList ||
    (yes(data.nonOwnerController) && !hasText(data.nonOwnerControllerDetails));

  if (hasText(data.legalName) && isBusinessEntity) {
    kybRecipients.push(namedRecipient(signerName || data.legalName, signerEmail || data.legalBusinessEmail || data.generalEmail));
    reasons.push('Business identity is present and the entity type expects KYB verification.');
  }

  if (ownerRows.length > 0) {
    kycRecipients.push(...ownerRows);
    reasons.push('One or more 25%+ beneficial owners were supplied.');
  } else if (hasText(data.ownerName)) {
    kycRecipients.push(namedRecipient(data.ownerName, data.ownerEmail));
    reasons.push('Primary owner details were supplied.');
  }

  if (hasSigner) {
    const signerRecipient = namedRecipient(signerName, signerEmail);
    if (!kycRecipients.includes(signerRecipient)) {
      kycRecipients.push(signerRecipient);
    }
    reasons.push('Authorized signer is identified and should be validated.');
  }

  if (yes(data.nonOwnerController) && hasText(data.nonOwnerControllerDetails)) {
    kycRecipients.push(data.nonOwnerControllerDetails);
    reasons.push('A non-owner controller was disclosed.');
  }

  if (ownershipAmbiguous && kybRecipients.length > 0) {
    holdKycRecipients.push(...kycRecipients);
    kycRecipients.length = 0;
    reasons.push('Ownership or control is ambiguous, so KYB should settle first before final KYC targeting.');
  }

  let action: PersonaInviteAction = 'none';
  if (kybRecipients.length > 0 && kycRecipients.length > 0) action = 'both';
  else if (kybRecipients.length > 0 && holdKycRecipients.length > 0) action = 'kyb_first';
  else if (kybRecipients.length > 0) action = 'kyb';
  else if (kycRecipients.length > 0) action = 'kyc';

  const summary =
    action === 'none'
      ? 'Persona trigger decision: hold. Need legal business identity, signer, or owner/control details before sending invites.'
      : `Persona trigger decision: ${action.replace('_', ' ')}. KYB recipients: ${kybRecipients.join(', ') || 'none'}. KYC recipients: ${kycRecipients.join(', ') || 'none'}. Held KYC: ${holdKycRecipients.join(', ') || 'none'}.`;

  return {
    action,
    kybRecipients,
    kycRecipients,
    holdKycRecipients,
    reasons,
    summary,
  };
}

export function buildPersonaSummary(data: MerchantData): string {
  const decision = decidePersonaInvites(data);
  const reasonText = decision.reasons.length > 0 ? ` Reasons: ${decision.reasons.join(' ')}` : '';
  return `${decision.summary}${reasonText} Verification result capture: KYB/KYC passed, failed, pending, mismatches, and incomplete checks should be attached here when available.`;
}

export function buildWebsiteSignalSummary(data: MerchantData): string {
  const lines = [
    `Website URL: ${data.website || 'not supplied'}`,
    `Privacy Policy present: ${data.websitePrivacyPolicy || 'unknown'}`,
    `Terms present: ${data.websiteTerms || 'unknown'}`,
    `Return / Refund Policy present: ${data.websiteRefundPolicy || 'unknown'}`,
    `Customer service contact visible: ${data.websiteContactInfo || 'unknown'}`,
    `SSL / encrypted payment page: ${data.websiteSsl || 'unknown'}`,
    `Stores card numbers: ${data.storesCardNumbers || 'unknown'}`,
    `Third-party cardholder-data applications: ${data.thirdPartyCardApps || 'none disclosed'}`,
    `Prior card data compromise: ${data.dataBreachHistory || 'unknown'}`,
    `Regulated business / MSB: ${data.regulatedBusiness || 'unknown'}`,
  ];
  return lines.join('\n');
}

export function normalizeProcessorFit(value: unknown): ProcessorFit {
  const text = typeof value === 'string' ? value.toLowerCase() : '';
  if (text.includes('payroc') || text.includes('peoples')) return 'Payroc / Peoples';
  if (text.includes('chase')) return 'Chase';
  return 'Nuvei';
}

const PROCESSOR_QUESTION_SETS: Record<ProcessorFit, ProcessorQuestionSet> = {
  Nuvei: {
    processor: 'Nuvei',
    sections: [
      {
        title: 'Merchant profile / setup',
        questions: [
          'Are you GST exempt?',
          'How many additional months have you been in business, beyond full years?',
          'What customer service email and statement email should Nuvei use?',
          'What customer service phone number should be used for MOTO / e-commerce?',
        ],
      },
      {
        title: 'Ownership / management detail',
        questions: [
          'For each owner, do they have significant managerial control?',
          'For each owner, confirm driver licence, province, mobile number, SIN availability, and date of birth. Do not paste full SIN in this demo; use availability or last four only.',
        ],
      },
      {
        title: 'Sales breakdown',
        questions: [
          'What percentage of volume is swipe / chip, e-commerce, and MOTO / keyed?',
          'What is monthly volume, average ticket, and high ticket by card brand?',
          'Is the business seasonal? If yes, which months?',
        ],
      },
      {
        title: 'Services / fulfillment questionnaire',
        questions: [
          'What marketing methods do you use?',
          'For e-commerce, what percentage of customers are in Canada, the U.S., or other countries?',
          'Do you require deposits, future delivery, final payment before fulfillment, or automatic / negative option billing?',
          'Do you offer warranties, guarantees, refunds, upsells, or fulfillment centers?',
          'How is card payment information entered, and do you own the inventory?',
        ],
      },
      {
        title: 'Site / location / setup',
        questions: [
          'What zone, square footage, and location type apply?',
          'Do you need terminal purchase/rental, tip functionality, auto-settle, password-protected refunds, Interac cash back, semi-integrated setup, DCC, or Control Panel access?',
        ],
      },
    ],
  },
  'Payroc / Peoples': {
    processor: 'Payroc / Peoples',
    sections: [
      {
        title: 'Contact segmentation',
        questions: [
          'Who is the chargebacks and disputes contact?',
          'Who is the customer service contact?',
          'Who is the reports and statements contact?',
          'Where should chargeback and retrieval requests be sent?',
        ],
      },
      {
        title: 'Business / processing detail',
        questions: [
          'How many years has the business been processing payments?',
          'What is the MCC?',
          'Has the merchant or any owner ever had a processing agreement terminated by a bank?',
          'Has the merchant or any owner ever filed for business or personal bankruptcy?',
        ],
      },
      {
        title: 'Card acceptance and underwriting numbers',
        questions: [
          'What methods of card acceptance do you use?',
          'What are annual Visa, Mastercard, and Amex volumes?',
          'What percentage of cards are foreign cards and what percentage of payments are recurring?',
          'What is the high-ticket amount?',
        ],
      },
      {
        title: 'Website / fulfillment / refund',
        questions: [
          'Will products or services be sold on the website and who is the SSL provider?',
          'What are return, refund, monthly refund percentage, charge timing, shipping traceability, proof of delivery, turnaround time, deposit, inventory, and fulfillment details?',
        ],
      },
      {
        title: 'Documents and banking',
        questions: [
          'Can you provide audited / reviewed financials or corporate tax returns and three recent processing statements?',
          'Can signing officers provide government-issued ID?',
          'Does the website show secure payment, shipping policy, transaction currency, and complete product/service descriptions?',
          'Do you need separate chargeback bank accounts, trust accounts, void cheques, or bank letters?',
        ],
      },
    ],
  },
  Chase: {
    processor: 'Chase',
    sections: [
      {
        title: 'Ownership structure logic',
        questions: [
          'Is the business privately owned, publicly traded, government, non-profit, sole proprietorship, or parent-owned?',
          'Who are the two owners with the greatest ownership percentages?',
          'Are there additional direct or indirect owners with 10% or greater ownership?',
          'Can anyone not listed make financial decisions or control company policy?',
        ],
      },
      {
        title: 'Owner / delegate / senior manager',
        questions: [
          'Is there an authorized delegate or representative?',
          'Who is the senior manager and what title do they hold?',
          'If the senior manager is not already listed, can you complete an addendum?',
        ],
      },
      {
        title: 'Payment timing / recurring granularity',
        questions: [
          'Is payment taken in advance, and what percentage is paid in advance?',
          'Break advance payments into 1-7 days, 8-14 days, 15-30 days, and over 30 days.',
          'Is billing recurring, what percentage is recurring, and what is the 30/60/90/annual/other breakdown?',
        ],
      },
      {
        title: 'Sales breakdown and payment methods',
        questions: [
          'What percentage of annual card transactions are card present, keyed/MOTO, and e-commerce?',
          'Which payment methods do you wish to accept?',
          'Do you already have an American Express Merchant Number?',
        ],
      },
      {
        title: 'Signer / guarantee / consent / retrieval',
        questions: [
          'Who is the authorized representative and is the signer listed in ownership?',
          'Is a personal guarantee required and who are the guarantors?',
          'Does each guarantor agree to guarantee terms, credit investigation, and pre-authorized debits?',
          'Where should chargeback/retrieval requests and online reporting instructions be sent?',
        ],
      },
    ],
  },
};

export function getProcessorQuestionSet(processor: unknown): ProcessorQuestionSet {
  return PROCESSOR_QUESTION_SETS[normalizeProcessorFit(processor)];
}

export function getProcessorQuestionPrompt(processor: unknown): string {
  const set = getProcessorQuestionSet(processor);
  return set.sections
    .map((section) => {
      const questions = section.questions.map((question) => `- ${question}`).join('\n');
      return `${section.title}\n${questions}`;
    })
    .join('\n\n');
}

export function buildProcessorReadyPackageSummary(data: MerchantData): string {
  const decision = decidePersonaInvites(data);
  const processor = normalizeProcessorFit(data.matchedProcessor);
  const missingParts: string[] = [];
  const personaResult = data.personaVerificationSummary.toLowerCase();

  if (!hasText(data.legalName)) missingParts.push('legal business name');
  if (!hasText(data.website)) missingParts.push('website URL');
  if (!hasText(data.personaVerificationSummary) || personaResult.includes('pending')) {
    missingParts.push('completed Persona verification results');
  }
  if (!hasText(data.processorSpecificAnswers)) missingParts.push(`${processor} follow-up answers`);

  const readiness = missingParts.length === 0 ? 'Processor-ready' : `Not ready; missing ${missingParts.join(', ')}`;
  return [
    `Matched processor: ${processor}`,
    `Persona plan: ${decision.action.replace('_', ' ')}`,
    `Readiness: ${readiness}`,
    `Package contents: common intake, Persona decision/results, website review signals, AI underwriting summary, ${processor} follow-up answers, document checklist, and missing items.`,
  ].join('\n');
}
