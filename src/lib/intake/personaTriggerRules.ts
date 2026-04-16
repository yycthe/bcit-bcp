import type { MerchantData } from '@/src/types';

export type PersonaInviteAction = 'none' | 'kyb' | 'kyc' | 'both' | 'kyb_first';

export type PersonaRecipient = {
  name: string;
  email?: string;
  source: 'beneficial_owner' | 'authorized_signer';
};

export type StrictCommonDerivedFlags = {
  missing_core_business_registration_info: boolean;
  website_gap: boolean;
  insufficient_business_description: boolean;
  advance_payment: boolean;
  recurring: boolean;
  fulfillment_timing_flag: boolean;
  parent_entity: boolean;
  non_owner_control: boolean;
  separate_signer: boolean;
  termination_history: boolean;
  bankruptcy_history: boolean;
  risk_program_history: boolean;
  later_clarification_required: boolean;
  recurring_inconsistency: boolean;
  data_breach_history: boolean;
  regulated_business: boolean;
  control_structure_complex: boolean;
  ownership_structure_complex: boolean;
  separate_signer_verification: boolean;
  KYC_partial_hold: boolean;
  KYB_required: boolean;
  KYB_ready_to_send: boolean;
  KYB_hold_until_docs_ready: boolean;
  KYC_ready_to_send: boolean;
  Persona_not_ready: boolean;
};

export type StrictPersonaTriggerDecision = {
  action: PersonaInviteAction;
  kycRecipients: PersonaRecipient[];
  heldKycRecipients: PersonaRecipient[];
  kybRequired: boolean;
  kybReadyToSend: boolean;
  kybHoldUntilDocsReady: boolean;
  kybPriority: 'normal' | 'high';
  kycReadyToSend: boolean;
  kycRequired: boolean;
  sendKycAndKybTogether: boolean;
  sendKybFirstHoldSomeKyc: boolean;
  personaNotReady: boolean;
  sharedVerificationSufficientlyCompleted: boolean;
  commonQuestionsCompleted: boolean;
  flags: StrictCommonDerivedFlags;
  missingReadinessItems: string[];
  reasons: string[];
  summary: string;
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

const DOC_THRESHOLD_FOR_MOSTLY_READY = 4;

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function yes(value: unknown): boolean {
  return ['yes', 'y', 'true', 'ready / available'].includes(normalized(value));
}

function no(value: unknown): boolean {
  return ['no', 'n', 'false'].includes(normalized(value));
}

function na(value: unknown): boolean {
  return ['n/a', 'na', 'not applicable'].includes(normalized(value));
}

function needsHelpOrTime(value: unknown): boolean {
  return ['need time', 'need help'].includes(normalized(value));
}

function textLooksMissingRegistration(value: unknown): boolean {
  const text = normalized(value);
  return !text || text === 'n/a' || text === 'none' || text === 'no' || text.includes("don't have");
}

function parsePercentishValue(value: unknown): number | null {
  const text = normalized(value);
  if (!text) return null;
  if (text === '0%') return 0;
  const direct = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (direct) return Number(direct[1]);
  const ranged = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)%?/);
  if (ranged) return Number(ranged[2]);
  const bare = text.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return Number(bare[1]);
  return null;
}

function extractEmail(row: string): string | undefined {
  const match = row.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0];
}

function extractName(row: string): string {
  return row.split(',')[0]?.trim() || row.trim();
}

function splitRows(value: string): string[] {
  return value
    .split(/\n|;/)
    .map((row) => row.trim())
    .filter(Boolean);
}

function buildOwnerRecipients(data: MerchantData): PersonaRecipient[] {
  const rows = splitRows(data.beneficialOwners);
  if (rows.length === 0) return [];
  return rows.map((row) => ({
    name: extractName(row),
    email: extractEmail(row),
    source: 'beneficial_owner' as const,
  }));
}

function sameRecipient(a: PersonaRecipient, b: PersonaRecipient): boolean {
  if (a.email && b.email) return a.email.toLowerCase() === b.email.toLowerCase();
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
}

function buildSignerRecipient(data: MerchantData): PersonaRecipient | null {
  if (!hasText(data.authorizedSignerName)) return null;
  return {
    name: data.authorizedSignerName.trim(),
    email: hasText(data.authorizedSignerEmail) ? data.authorizedSignerEmail.trim() : undefined,
    source: 'authorized_signer',
  };
}

function documentReadinessScore(data: MerchantData): { yesCount: number; noCount: number; missing: string[] } {
  const checks: Array<[string, string]> = [
    ['Business Registration / Articles of Incorporation', data.canProvideRegistration],
    ['Void Cheque / Bank Letter', data.canProvideVoidCheque],
    ['2 recent official business bank statements', data.canProvideBankStatements],
    ['Proof of business address', data.canProvideProofOfAddress],
    ['Proof of ownership', data.canProvideProofOfOwnership],
  ];

  let yesCount = 0;
  let noCount = 0;
  const missing: string[] = [];

  for (const [label, value] of checks) {
    if (yes(value)) yesCount += 1;
    else if (no(value)) noCount += 1;
    else missing.push(label);
  }

  return { yesCount, noCount, missing };
}

function recurringInconsistency(data: MerchantData): boolean {
  if (yes(data.recurringBilling)) return false;
  const recurringValue = parsePercentishValue(data.recurringTransactionsPercent);
  return recurringValue !== null && recurringValue > 0;
}

function channelSplitNeedsClarification(value: string): boolean {
  if (!hasText(value)) return true;
  const matches = [...value.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  if (matches.length < 3) return true;
  const total = matches.slice(0, 3).reduce((sum, match) => sum + Number(match[1]), 0);
  return Math.abs(total - 100) > 2;
}

function websiteGap(data: MerchantData): boolean {
  const noWebsite = !hasText(data.website) || na(data.website);
  if (!noWebsite) return false;
  const appearsDigital =
    normalized(data.goodsOrServicesType).includes('digital') ||
    normalized(data.businessCategory).includes('e-commerce') ||
    yes(data.recurringBilling);
  return appearsDigital;
}

function insufficientBusinessDescription(data: MerchantData): boolean {
  if (!hasText(data.businessDescription)) return true;
  const words = data.businessDescription.trim().split(/\s+/).filter(Boolean);
  return words.length < 8;
}

function fulfillmentTimingFlag(data: MerchantData): boolean {
  const value = normalized(data.fulfillmentTimeline);
  return value.includes('8-30') || value.includes('over 30') || value.includes('30');
}

function isBusinessEntity(data: MerchantData): boolean {
  return BUSINESS_ENTITY_TYPES.has(data.businessType);
}

function commonQuestionsCompleted(data: MerchantData): boolean {
  const requiredValues: Array<unknown> = [
    data.legalName,
    data.dbaName,
    data.businessType,
    data.businessRegistrationNumber,
    data.establishedDate,
    data.legalBusinessAddress,
    data.operatingAddressDifferent,
    data.businessPhone,
    data.legalBusinessEmail,
    data.website,
    data.productsServices,
    data.businessDescription,
    data.businessCategory,
    data.goodsOrServicesType,
    data.customerType,
    data.advancePayment,
    data.recurringBilling,
    data.fulfillmentTimeline,
    data.beneficialOwners,
    data.parentOwned,
    data.nonOwnerController,
    data.authorizedSignerName,
    data.authorizedSignerTitle,
    data.authorizedSignerEmail,
    data.signerIsOwner,
    data.currentlyProcessesCards,
    data.currentOrPreviousProcessor,
    data.processorExitReason,
    data.priorTermination,
    data.bankruptcyHistory,
    data.riskProgramHistory,
    data.monthlyVolume,
    data.avgTicketSize,
    data.highestTicketAmount,
    data.transactionChannelSplit,
    data.paymentTypesWanted,
    data.recurringTransactionsPercent,
    data.foreignCardsPercent,
    data.websitePrivacyPolicy,
    data.websiteTerms,
    data.websiteRefundPolicy,
    data.websiteContactInfo,
    data.websiteSsl,
    data.storesCardNumbers,
    data.thirdPartyCardApps,
    data.dataBreachHistory,
    data.regulatedBusiness,
    data.canProvideRegistration,
    data.canProvideVoidCheque,
    data.canProvideBankStatements,
    data.canProvideProofOfAddress,
    data.canProvideProofOfOwnership,
    data.canProvideOwnerIds,
  ];

  return requiredValues.every((value) => hasText(value));
}

export function evaluateStrictCommonFlags(data: MerchantData): StrictCommonDerivedFlags {
  const docs = documentReadinessScore(data);
  const ownerRecipients = buildOwnerRecipients(data);
  const signer = buildSignerRecipient(data);
  const kycRequired = ownerRecipients.length > 0 || signer != null;
  const parentEntity = yes(data.parentOwned) || data.businessType === 'parent_owned';
  const ownerClarity = ownerRecipients.length > 0;
  const kycPartialHold = parentEntity && !ownerClarity;

  const kybRequired = hasText(data.legalName) && isBusinessEntity(data);
  const kybReadyToSend =
    kybRequired &&
    hasText(data.businessRegistrationNumber) &&
    hasText(data.legalBusinessAddress) &&
    docs.yesCount >= DOC_THRESHOLD_FOR_MOSTLY_READY;
  const kybHoldUntilDocsReady = kybRequired && docs.noCount >= 2;
  const kycReadyToSend = kycRequired && yes(data.canProvideOwnerIds) && !kycPartialHold;
  const personaNotReady =
    !hasText(data.legalName) ||
    !hasText(data.businessType) ||
    !hasText(data.businessRegistrationNumber) ||
    !hasText(data.legalBusinessAddress) ||
    ownerRecipients.length === 0 ||
    signer == null ||
    !yes(data.canProvideOwnerIds) ||
    docs.yesCount < DOC_THRESHOLD_FOR_MOSTLY_READY;

  return {
    missing_core_business_registration_info: textLooksMissingRegistration(data.businessRegistrationNumber),
    website_gap: websiteGap(data),
    insufficient_business_description: insufficientBusinessDescription(data),
    advance_payment: yes(data.advancePayment),
    recurring: yes(data.recurringBilling),
    fulfillment_timing_flag: fulfillmentTimingFlag(data),
    parent_entity: parentEntity,
    non_owner_control: yes(data.nonOwnerController),
    separate_signer: no(data.signerIsOwner),
    termination_history: yes(data.priorTermination),
    bankruptcy_history: yes(data.bankruptcyHistory),
    risk_program_history: yes(data.riskProgramHistory),
    later_clarification_required: channelSplitNeedsClarification(data.transactionChannelSplit),
    recurring_inconsistency: recurringInconsistency(data),
    data_breach_history: yes(data.dataBreachHistory),
    regulated_business: yes(data.regulatedBusiness),
    control_structure_complex: yes(data.nonOwnerController),
    ownership_structure_complex: parentEntity,
    separate_signer_verification: no(data.signerIsOwner),
    KYC_partial_hold: kycPartialHold,
    KYB_required: kybRequired,
    KYB_ready_to_send: kybReadyToSend,
    KYB_hold_until_docs_ready: kybHoldUntilDocsReady,
    KYC_ready_to_send: kycReadyToSend,
    Persona_not_ready: personaNotReady,
  };
}

export function evaluateStrictPersonaTriggers(data: MerchantData): StrictPersonaTriggerDecision {
  const flags = evaluateStrictCommonFlags(data);
  const docs = documentReadinessScore(data);
  const reasons: string[] = [];
  const ownerRecipients = buildOwnerRecipients(data);
  const signer = buildSignerRecipient(data);
  const kycRecipients = [...ownerRecipients];
  const heldKycRecipients: PersonaRecipient[] = [];

  if (signer) {
    if (!kycRecipients.some((recipient) => sameRecipient(recipient, signer))) {
      kycRecipients.push(signer);
    }
    reasons.push('Authorized signer identified from Common Question 23.');
  }

  if (ownerRecipients.length > 0) {
    reasons.push('One or more 25%+ beneficial owners were supplied in Common Question 20.');
  }

  if (flags.parent_entity) {
    reasons.push('Parent entity ownership was disclosed, so KYB remains required and higher priority.');
  }
  if (flags.non_owner_control) {
    reasons.push('A non-owner controller was disclosed; record control_structure_complex = yes.');
  }
  if (flags.separate_signer_verification) {
    reasons.push('Signer is separate from the listed owners and needs distinct signer verification.');
  }
  if (flags.KYB_ready_to_send) {
    reasons.push('Business identity and most core business docs are ready, so KYB can be sent.');
  } else if (flags.KYB_hold_until_docs_ready) {
    reasons.push('KYB is required, but too many core business documents are unavailable right now.');
  }
  if (flags.KYC_ready_to_send) {
    reasons.push('Owner / signer photo-ID readiness is confirmed, so KYC can be sent.');
  }

  if (flags.KYC_partial_hold) {
    heldKycRecipients.push(...kycRecipients);
    kycRecipients.length = 0;
    reasons.push('Parent ownership makes beneficial ownership unclear, so some or all KYC should be held.');
  }

  const sendKycAndKybTogether =
    flags.KYB_required &&
    flags.KYB_ready_to_send &&
    ownerRecipients.length > 0 &&
    signer != null &&
    flags.KYC_ready_to_send &&
    !flags.KYC_partial_hold;

  const sendKybFirstHoldSomeKyc =
    flags.KYB_required &&
    flags.KYB_ready_to_send &&
    (flags.KYC_partial_hold || !flags.KYC_ready_to_send);

  let action: PersonaInviteAction = 'none';
  if (sendKycAndKybTogether) action = 'both';
  else if (sendKybFirstHoldSomeKyc) action = 'kyb_first';
  else if (flags.KYB_required && flags.KYB_ready_to_send) action = 'kyb';
  else if (kycRecipients.length > 0 && flags.KYC_ready_to_send) action = 'kyc';

  const missingReadinessItems: string[] = [];
  if (!hasText(data.legalName)) missingReadinessItems.push('legal business name');
  if (!hasText(data.businessType)) missingReadinessItems.push('business entity type');
  if (!hasText(data.businessRegistrationNumber)) missingReadinessItems.push('registration / corporation / GST/HST information');
  if (!hasText(data.legalBusinessAddress)) missingReadinessItems.push('legal business address');
  if (ownerRecipients.length === 0) missingReadinessItems.push('25%+ beneficial owners');
  if (signer == null) missingReadinessItems.push('authorized signer');
  if (!yes(data.canProvideOwnerIds)) missingReadinessItems.push('owner / signer government-issued ID readiness');
  if (docs.yesCount < DOC_THRESHOLD_FOR_MOSTLY_READY) missingReadinessItems.push('core business documents mostly available (Questions 47-51)');

  const sharedVerificationSufficientlyCompleted =
    commonQuestionsCompleted(data) &&
    (!flags.KYB_required || flags.KYB_ready_to_send || flags.KYB_hold_until_docs_ready) &&
    (!signer && ownerRecipients.length === 0 ? false : flags.KYC_ready_to_send || flags.KYC_partial_hold);

  const kybPriority = flags.parent_entity ? 'high' : 'normal';
  const summaryBits = [
    `Action: ${
      action === 'none'
        ? 'hold KYC / KYB steps'
        : action === 'both'
          ? 'send KYB and KYC together'
          : action === 'kyb_first'
            ? 'send KYB first and hold some KYC'
            : action === 'kyb'
              ? 'send KYB'
              : 'send KYC'
    }.`,
    `KYB required: ${flags.KYB_required ? 'yes' : 'no'}.`,
    `KYB ready: ${flags.KYB_ready_to_send ? 'yes' : 'no'}.`,
    `KYC ready: ${flags.KYC_ready_to_send ? 'yes' : 'no'}.`,
    `KYB priority: ${kybPriority}.`,
    missingReadinessItems.length > 0 ? `Still missing: ${missingReadinessItems.join(', ')}.` : 'KYC / KYB readiness is complete from the Common layer.',
  ];

  return {
    action,
    kycRecipients,
    heldKycRecipients,
    kybRequired: flags.KYB_required,
    kybReadyToSend: flags.KYB_ready_to_send,
    kybHoldUntilDocsReady: flags.KYB_hold_until_docs_ready,
    kybPriority,
    kycReadyToSend: flags.KYC_ready_to_send,
    kycRequired: ownerRecipients.length > 0 || signer != null,
    sendKycAndKybTogether,
    sendKybFirstHoldSomeKyc,
    personaNotReady: flags.Persona_not_ready,
    sharedVerificationSufficientlyCompleted,
    commonQuestionsCompleted: commonQuestionsCompleted(data),
    flags,
    missingReadinessItems,
    reasons,
    summary: summaryBits.join(' '),
  };
}

export function buildStrictPersonaSummary(data: MerchantData): string {
  const decision = evaluateStrictPersonaTriggers(data);
  const recipientText =
    decision.kycRecipients.length > 0
      ? decision.kycRecipients.map((recipient) => recipient.email ? `${recipient.name} <${recipient.email}>` : recipient.name).join(', ')
      : 'none';
  const heldText =
    decision.heldKycRecipients.length > 0
      ? decision.heldKycRecipients.map((recipient) => recipient.email ? `${recipient.name} <${recipient.email}>` : recipient.name).join(', ')
      : 'none';
  const reasonText = decision.reasons.length > 0 ? ` Reasons: ${decision.reasons.join(' ')}` : '';

  return [
    `KYC / KYB trigger decision: ${decision.summary}`,
    `KYC recipients: ${recipientText}.`,
    `Held KYC recipients: ${heldText}.`,
    `Shared verification sufficiently completed: ${decision.sharedVerificationSufficientlyCompleted ? 'yes' : 'no'}.`,
    reasonText,
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
