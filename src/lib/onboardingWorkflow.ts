import type { MerchantData } from '@/src/types';
import {
  buildStrictPersonaSummary,
  evaluateStrictPersonaTriggers,
  type PersonaInviteAction,
} from '@/src/lib/intake/personaTriggerRules';
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

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function decidePersonaInvites(data: MerchantData): PersonaInviteDecision {
  const decision = evaluateStrictPersonaTriggers(data);
  const kybRecipients: string[] = [];
  const signerName = data.authorizedSignerName || data.legalName || 'Business';
  const signerEmail = data.authorizedSignerEmail || data.legalBusinessEmail || data.generalEmail;
  if (decision.kybRequired) {
    kybRecipients.push(hasText(signerEmail) ? `${signerName} <${signerEmail}>` : signerName);
  }

  return {
    action: decision.action,
    kybRecipients,
    kycRecipients: decision.kycRecipients.map((recipient) =>
      hasText(recipient.email) ? `${recipient.name} <${recipient.email}>` : recipient.name
    ),
    holdKycRecipients: decision.heldKycRecipients.map((recipient) =>
      hasText(recipient.email) ? `${recipient.name} <${recipient.email}>` : recipient.name
    ),
    reasons: decision.reasons,
    summary: decision.summary,
  };
}

export function buildPersonaSummary(data: MerchantData): string {
  const resultParts: string[] = [];
  if (hasText(data.personaKybStatus)) resultParts.push(`KYB status: ${data.personaKybStatus}`);
  if (hasText(data.personaKycStatuses)) resultParts.push(`KYC status per person: ${data.personaKycStatuses}`);
  if (hasText(data.personaVerificationIssues)) resultParts.push(`Verification issues: ${data.personaVerificationIssues}`);

  const resultsText =
    resultParts.length > 0
      ? ` KYC / KYB verification results: ${resultParts.join('. ')}.`
      : ' Verification result capture: KYB/KYC passed, failed, pending, mismatches, and incomplete checks should be attached here when available.';

  return `${buildStrictPersonaSummary(data)}${resultsText}`;
}

export function buildWebsiteSignalSummary(data: MerchantData): string {
  const lines = [
    `Website URL: ${data.website || 'not supplied'}`,
    `Privacy Policy present: ${data.websitePrivacyPolicy || 'unknown'}`,
    `Terms present: ${data.websiteTerms || 'unknown'}`,
    `Return / Refund Policy present: ${data.websiteRefundPolicy || 'unknown'}`,
    `Shipping Policy present if applicable: ${data.websiteShippingPolicy || 'unknown'}`,
    `Customer service contact visible: ${data.websiteContactInfo || 'unknown'}`,
    `Currency display present if applicable: ${data.websiteCurrencyDisplay || 'unknown'}`,
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
          'What is your customer service email?',
          'What email address should receive statements?',
          'What customer service phone number should be used for MOTO / e-commerce?',
        ],
      },
      {
        title: 'Ownership / management detail',
        questions: [
          'For each owner, do they have significant managerial control?',
          'Are there additional beneficial owners beyond the first listed section?',
          'For each owner, what is their driver licence number? Use masked or last-four format in this demo.',
          'For each owner, what province issued the driver licence?',
          'For each owner, what is their mobile number?',
          'For each owner, confirm SIN availability or last four only. Do not paste a full SIN in this demo.',
          'For each owner, what is their date of birth?',
        ],
      },
      {
        title: 'Sales breakdown',
        questions: [
          'What percentage of your volume is swipe / chip?',
          'What percentage of your volume is e-commerce?',
          'What percentage of your volume is MOTO / keyed?',
          'What is your monthly volume by card brand?',
          'What is your average ticket by card brand?',
          'What is your high ticket by card brand?',
          'Is the business seasonal? If yes, which months?',
        ],
      },
      {
        title: 'Services questionnaire',
        questions: [
          'What marketing methods do you use?',
          'For e-commerce, what percentage of customers are in Canada, the U.S., or other countries?',
          'Do you require deposits for future delivery?',
          'Is final payment due before fulfillment?',
          'Does your business use automatic or negative option billing?',
          'Does your business offer warranties or guarantees?',
          'What is your refund window?',
          'Do you offer upsells?',
          'How is card payment information entered into the system?',
          'Do you own the product / inventory?',
          'Where is the product stored or shipped from?',
          'Do you use a fulfillment center?',
          'What delivery method do you use?',
        ],
      },
      {
        title: 'Site / location questions',
        questions: [
          'What zone is your business located in?',
          'What is the approximate square footage?',
          'What type of location is it?',
        ],
      },
      {
        title: 'Setup / technical',
        questions: [
          'Do you need terminal purchase or rental?',
          'Do you need tip functionality?',
          'Do you need auto-settle?',
          'Do you want refunds to be password protected?',
          'Do you need Interac cash back?',
          'Do you need a semi-integrated setup?',
          'What communication type do you need?',
          'Do you want Dynamic Currency Conversion?',
          'Do you want access to the Control Panel?',
          'Who should be the Control Panel administrator?',
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
          'If yes, what was the termination reason?',
          'Has the merchant or any owner ever filed for business or personal bankruptcy?',
          'If yes, what year?',
        ],
      },
      {
        title: 'Card acceptance',
        questions: [
          'Do you currently process payments?',
          'What methods of card acceptance do you use?',
          'What percentage is Mail / Phone Order?',
          'What percentage is e-commerce?',
          'Do you have an Amex-issued Merchant ID?',
        ],
      },
      {
        title: 'Underwriting numbers',
        questions: [
          'What is your annual Visa volume?',
          'What is your annual Mastercard volume?',
          'What is your annual Amex volume?',
          'What percentage of cards are foreign cards?',
          'What percentage of payments are recurring?',
          'What is the high-ticket amount?',
        ],
      },
      {
        title: 'Website / fulfillment / refund',
        questions: [
          'Will you be selling products/services on your website?',
          'What is your SSL provider?',
          'What is your return policy?',
          'What is your refund policy?',
          'What percentage of monthly sales is refunded?',
          'When do you charge the customer?',
          'Is shipment traceable?',
          'Is proof of delivery requested?',
          'Are there any other companies involved in accepting, shipping, or fulfilling?',
          'What is the normal turnaround time from order to customer receipt?',
          'Do you take deposits?',
          'If yes, what percentage or fixed amount?',
          'Who enters the card information into the processing system?',
          'Do you own the inventory at the time of sale?',
        ],
      },
      {
        title: 'Required documents / website requirements',
        questions: [
          'Can you provide audited / reviewed financial statements or corporate tax returns?',
          'Can you provide 3 consecutive months of processing statements dated within the last 90 days?',
          'Can each signing officer provide one government-issued ID?',
          'Does the website include a secure payment page?',
          'Does the website include a shipping policy?',
          'Does the website display the transaction currency?',
          'Does the website provide a complete description of items/services sold?',
        ],
      },
      {
        title: 'Banking',
        questions: [
          'Do you need a separate chargeback bank account?',
          'Is the depository account a trust account?',
          'Can you attach void cheques or bank letters for each listed account?',
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
          'Is payment taken in advance of when goods or services are received?',
          'If yes, what percentage of total processing sales is paid in advance?',
          'Of those advance payments, what percentage falls into 1-7 days?',
          'Of those advance payments, what percentage falls into 8-14 days?',
          'Of those advance payments, what percentage falls into 15-30 days?',
          'Of those advance payments, what percentage falls into over 30 days?',
          'Is billing recurring?',
          'If yes, what percentage of sales is recurring?',
          'What percentage of recurring billing is every 30 days?',
          'What percentage of recurring billing is every 60 days?',
          'What percentage of recurring billing is every 90 days?',
          'What percentage of recurring billing is annual?',
          'What percentage of recurring billing is other?',
        ],
      },
      {
        title: 'Sales breakdown and payment methods',
        questions: [
          'What percentage of annual payment card transactions are card present?',
          'What percentage of annual payment card transactions are keyed / mail / phone order?',
          'What percentage of annual payment card transactions are e-commerce?',
          'Which payment methods do you wish to accept?',
          'Do you already have an American Express Merchant Number?',
        ],
      },
      {
        title: 'Signer / guarantee / consent',
        questions: [
          'Who is the authorized representative signing on behalf of the merchant?',
          'Is the signer listed in the ownership section?',
          'Is a personal guarantee required and who are the guarantors?',
          'Does each guarantor agree to the personal guarantee terms?',
          'Does the merchant consent to credit and financial investigation?',
          'Does the merchant consent to pre-authorized debits from the settlement account?',
        ],
      },
      {
        title: 'Reporting / retrieval',
        questions: [
          'Where should chargeback and retrieval requests be sent?',
          'Should online reporting instructions be sent to the legal email provided?',
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
    missingParts.push('completed KYC / KYB verification results');
  }
  if (!hasText(data.processorSpecificAnswers)) missingParts.push(`${processor} follow-up answers`);

  const readiness = missingParts.length === 0 ? 'Processor-ready' : `Not ready; missing ${missingParts.join(', ')}`;
  return [
    `Matched processor: ${processor}`,
    `KYC / KYB plan: ${decision.action.replace('_', ' ')}`,
    `Readiness: ${readiness}`,
    `Package contents: common intake, KYC / KYB context/results, website compliance signals, AI review summary, ${processor} follow-up answers, document checklist, and missing items.`,
  ].join('\n');
}
