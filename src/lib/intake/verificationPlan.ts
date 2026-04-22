import type { MerchantData } from '@/src/types';
import { evaluateStrictPersonaTriggers } from '@/src/lib/intake/personaTriggerRules';

export type VerificationPlacement = 'early_checkpoint' | 'standard_checkpoint' | 'late_checkpoint';

export type VerificationRole =
  | 'beneficial_owner'
  | 'authorized_signer'
  | 'non_owner_controller'
  | 'significant_managerial_control'
  | 'senior_manager'
  | 'guarantor'
  | 'delegate'
  | 'applicant_legal_entity'
  | 'parent_entity';

export type VerificationEntityTarget = {
  entity_key: string;
  entity_name: string | null;
  roles: VerificationRole[];
  reason_code: string;
  reason: string;
};

export type VerificationPersonTarget = {
  person_key: string;
  full_name: string | null;
  roles: VerificationRole[];
  reason_code: string;
  reason: string;
};

export type VerificationPlan = {
  placement: VerificationPlacement;
  kyb_required: boolean;
  kyc_required: boolean;
  kyb_targets: VerificationEntityTarget[];
  kyc_targets: VerificationPersonTarget[];
  reason_code: string;
  reason: string;
  blocking_items: string[];
};

export type VerificationPlannerProfile = {
  legalName: string;
  businessType: string;
  country: string;
  industry: string;
  regulatedBusiness: string;
  monthlyVolume: string;
  monthlyTransactions: string;
  beneficialOwners: Array<{
    key: string;
    full_name: string | null;
    email?: string;
    ownership_percent: number | null;
    raw: string;
  }>;
  ownershipThresholdPolicy: {
    baseline_threshold_percent: number;
    processor_sensitive_threshold_percent: number;
  };
  parentOwned: string;
  parentEntities: Array<{ entity_key: string; entity_name: string | null }>;
  nonOwnerController: {
    present: boolean;
    full_name: string | null;
    raw: string;
  };
  authorizedSigner: {
    full_name: string | null;
    title: string | null;
    email: string | null;
  };
  seniorManager: {
    full_name: string | null;
    raw: string;
  };
  guarantors: Array<{ person_key: string; full_name: string | null; raw: string }>;
  currentlyProcessesCards: string;
  previousProcessor: string;
  terminationHistory: string;
  advancePayment: string;
  recurringBilling: string;
  website: string;
  documentReadiness: {
    registration: string;
    bankStatements: string;
    proofOfAddress: string;
    proofOfOwnership: string;
    ownerIds: string;
    processingStatements: string;
  };
  missingCriticalFieldsSummary: string[];
  processorCandidates: string[];
  selectedProcessorPolicy: string | null;
};

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function yes(value: unknown): boolean {
  return ['yes', 'y', 'true', 'ready / available'].includes(normalized(value));
}

const BUSINESS_ENTITY_TYPES = new Set([
  'corporation',
  'partnership',
  'llc',
  'limited_liability',
  'non_profit',
  'government',
  'parent_owned',
]);

function isBusinessEntityType(value: unknown): boolean {
  return typeof value === 'string' && BUSINESS_ENTITY_TYPES.has(value);
}

function parseRows(value: string): string[] {
  return value
    .split(/\n|;/)
    .map((row) => row.trim())
    .filter(Boolean);
}

function extractEmail(row: string): string | undefined {
  const match = row.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0];
}

function extractPercent(row: string): number | null {
  const match = row.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  return Number(match[1]);
}

function extractLeadingName(row: string): string | null {
  const firstChunk = row.split(',')[0]?.trim() || row.trim();
  return firstChunk || null;
}

function personIdentityKey(name: string | null, email?: string | null): string {
  if (hasText(email)) return `email:${email.trim().toLowerCase()}`;
  if (hasText(name)) return `name:${name.trim().toLowerCase()}`;
  return '';
}

function buildBeneficialOwners(data: MerchantData): VerificationPlannerProfile['beneficialOwners'] {
  return parseRows(data.beneficialOwners).map((row, index) => ({
    key: `owner_${index + 1}`,
    full_name: extractLeadingName(row),
    email: extractEmail(row),
    ownership_percent: extractPercent(row),
    raw: row,
  }));
}

function buildParentEntities(data: MerchantData): VerificationPlannerProfile['parentEntities'] {
  if (!hasText(data.parentCompanyName) && !(normalized(data.parentOwned) === 'yes' || data.businessType === 'parent_owned')) {
    return [];
  }
  return [
    {
      entity_key: 'parent_entity_1',
      entity_name: hasText(data.parentCompanyName) ? data.parentCompanyName.trim() : null,
    },
  ];
}

function buildGuarantors(data: MerchantData): VerificationPlannerProfile['guarantors'] {
  if (!hasText(data.processorSpecificAnswersJson)) return [];
  try {
    const parsed = JSON.parse(data.processorSpecificAnswersJson) as Record<string, unknown>;
    const raw = typeof parsed.chase_guarantors === 'string' ? parsed.chase_guarantors : '';
    return parseRows(raw).map((row, index) => ({
      person_key: `guarantor_${index + 1}`,
      full_name: extractLeadingName(row),
      raw: row,
    }));
  } catch {
    return [];
  }
}

export function buildVerificationPlannerProfile(data: MerchantData): VerificationPlannerProfile {
  const decision = evaluateStrictPersonaTriggers(data);
  const beneficialOwners = buildBeneficialOwners(data);
  const missingCriticalFieldsSummary = [...decision.missingReadinessItems];
  if (!hasText(data.website)) missingCriticalFieldsSummary.push('website');
  if (!hasText(data.transactionChannelSplit)) missingCriticalFieldsSummary.push('transaction channel split');

  return {
    legalName: data.legalName,
    businessType: data.businessType,
    country: data.country,
    industry: data.industry,
    regulatedBusiness: data.regulatedBusiness,
    monthlyVolume: data.monthlyVolume,
    monthlyTransactions: data.monthlyTransactions,
    beneficialOwners,
    ownershipThresholdPolicy: {
      baseline_threshold_percent: 25,
      processor_sensitive_threshold_percent: 10,
    },
    parentOwned: data.parentOwned,
    parentEntities: buildParentEntities(data),
    nonOwnerController: {
      present: normalized(data.nonOwnerController) === 'yes',
      full_name: hasText(data.nonOwnerControllerDetails) ? extractLeadingName(data.nonOwnerControllerDetails) : null,
      raw: data.nonOwnerControllerDetails || '',
    },
    authorizedSigner: {
      full_name: hasText(data.authorizedSignerName) ? data.authorizedSignerName.trim() : null,
      title: hasText(data.authorizedSignerTitle) ? data.authorizedSignerTitle.trim() : null,
      email: hasText(data.authorizedSignerEmail) ? data.authorizedSignerEmail.trim() : null,
    },
    seniorManager: {
      full_name: null,
      raw: '',
    },
    guarantors: buildGuarantors(data),
    currentlyProcessesCards: data.currentlyProcessesCards,
    previousProcessor: data.currentOrPreviousProcessor,
    terminationHistory: data.priorTermination,
    advancePayment: data.advancePayment,
    recurringBilling: data.recurringBilling,
    website: data.website,
    documentReadiness: {
      registration: data.canProvideRegistration,
      bankStatements: data.canProvideBankStatements,
      proofOfAddress: data.canProvideProofOfAddress,
      proofOfOwnership: data.canProvideProofOfOwnership,
      ownerIds: data.canProvideOwnerIds,
      processingStatements: data.canProvideProcessingStatements,
    },
    missingCriticalFieldsSummary,
    processorCandidates: data.matchedProcessor ? [data.matchedProcessor] : [],
    selectedProcessorPolicy: hasText(data.matchedProcessor) ? data.matchedProcessor.trim() : null,
  };
}

export function buildFallbackVerificationPlan(data: MerchantData): VerificationPlan {
  const decision = evaluateStrictPersonaTriggers(data);
  const profile = buildVerificationPlannerProfile(data);
  const people = new Map<string, VerificationPersonTarget>();

  const addPerson = (
    personKey: string,
    fullName: string | null,
    role: VerificationRole,
    reasonCode: string,
    reason: string,
    email?: string | null
  ) => {
    const dedupeKey = personIdentityKey(fullName, email) || personKey;
    const existing = people.get(dedupeKey);
    if (existing) {
      if (!existing.roles.includes(role)) existing.roles.push(role);
      if (!existing.reason.includes(reason)) {
        existing.reason = `${existing.reason} ${reason}`.trim();
      }
      return;
    }
    people.set(dedupeKey, {
      person_key: personKey,
      full_name: fullName,
      roles: [role],
      reason_code: reasonCode,
      reason,
    });
  };

  const kybTargets: VerificationEntityTarget[] = [];
  if (decision.kybRequired) {
    kybTargets.push({
      entity_key: 'applicant_entity',
      entity_name: hasText(data.legalName) ? data.legalName.trim() : null,
      roles: ['applicant_legal_entity'],
      reason_code: 'primary_business_entity',
      reason: 'The applicant legal entity must be verified for business registration, ownership, and banking support.',
    });
  }
  if (profile.parentEntities.length > 0) {
    kybTargets.push({
      entity_key: profile.parentEntities[0].entity_key,
      entity_name: profile.parentEntities[0].entity_name,
      roles: ['parent_entity'],
      reason_code: 'parent_entity_review',
      reason: 'A parent-owned structure was disclosed, so the parent entity should be identified for KYB review.',
    });
  }

  profile.beneficialOwners.forEach((owner, index) => {
    const qualifies = owner.ownership_percent == null || owner.ownership_percent >= 25;
    if (!qualifies) return;
    addPerson(
      owner.key || `owner_${index + 1}`,
      owner.full_name,
      'beneficial_owner',
      owner.ownership_percent == null ? 'beneficial_owner_from_common_intake' : 'beneficial_owner_threshold',
      owner.ownership_percent == null
        ? 'This person was listed in the beneficial owner intake section and should be verified.'
        : 'This person meets the beneficial ownership threshold.',
      owner.email
    );
  });

  if (profile.authorizedSigner.full_name) {
    addPerson(
      'authorized_signer',
      profile.authorizedSigner.full_name,
      'authorized_signer',
      'signer_identity_required',
      'The authorized signer can bind the business and should be identity verified.',
      profile.authorizedSigner.email
    );
  } else if (!yes(data.signerIsOwner)) {
    addPerson(
      'unknown_authorized_signer',
      null,
      'authorized_signer',
      'signer_identity_incomplete',
      'An authorized signer appears to be required, but identifying details are incomplete.'
    );
  }

  if (profile.nonOwnerController.present) {
    addPerson(
      profile.nonOwnerController.full_name ? 'non_owner_controller' : 'unknown_non_owner_controller_1',
      profile.nonOwnerController.full_name,
      'non_owner_controller',
      profile.nonOwnerController.full_name ? 'control_person_required' : 'control_person_incomplete',
      profile.nonOwnerController.full_name
        ? 'This person has significant managerial or financial control but is not a listed owner.'
        : 'A non-owner controller was disclosed, but identifying details are incomplete.'
    );
  }

  profile.guarantors.forEach((guarantor, index) => {
    addPerson(
      guarantor.person_key || `guarantor_${index + 1}`,
      guarantor.full_name,
      'guarantor',
      guarantor.full_name ? 'guarantor_required' : 'guarantor_identity_incomplete',
      guarantor.full_name
        ? 'This person is listed as a guarantor and should be verified if the guarantee is required.'
        : 'A guarantor appears to be required, but identifying details are incomplete.'
    );
  });

  const placement: VerificationPlacement =
    normalized(data.regulatedBusiness) === 'yes' ||
    ['high_risk', 'crypto', 'gaming'].includes(data.industry) ||
    normalized(data.parentOwned) === 'yes' ||
    (data.country !== 'CA' && data.country !== 'US' && data.country !== '')
      ? 'early_checkpoint'
      : decision.missingReadinessItems.length === 0 &&
          data.country === 'CA' &&
          !['high_risk', 'crypto', 'gaming'].includes(data.industry)
        ? 'late_checkpoint'
        : 'standard_checkpoint';

  const reasonCode =
    placement === 'early_checkpoint'
      ? 'early_complex_verification'
      : placement === 'late_checkpoint'
        ? 'late_low_friction_verification'
        : 'default_midflow_multi_party_verification';
  const reason =
    placement === 'early_checkpoint'
      ? 'Elevated risk, structure complexity, or control ambiguity makes it safer to resolve verification earlier.'
      : placement === 'late_checkpoint'
        ? 'The merchant appears simple and well prepared, so the checkpoint can wait until later without increasing risk.'
        : 'The merchant has a normal business profile, so verification should happen at the default controlled checkpoint.';

  return {
    placement,
    kyb_required: decision.kybRequired,
    kyc_required: people.size > 0,
    kyb_targets: kybTargets,
    kyc_targets: Array.from(people.values()),
    reason_code: reasonCode,
    reason,
    blocking_items: decision.missingReadinessItems.map((item) =>
      item
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    ),
  };
}

export function buildFallbackVerificationPlanFromProfile(
  profile: VerificationPlannerProfile
): VerificationPlan {
  const people = new Map<string, VerificationPersonTarget>();

  const addPerson = (
    personKey: string,
    fullName: string | null,
    role: VerificationRole,
    reasonCode: string,
    reason: string,
    email?: string | null
  ) => {
    const dedupeKey = personIdentityKey(fullName, email) || personKey;
    const existing = people.get(dedupeKey);
    if (existing) {
      if (!existing.roles.includes(role)) existing.roles.push(role);
      if (!existing.reason.includes(reason)) existing.reason = `${existing.reason} ${reason}`.trim();
      return;
    }
    people.set(dedupeKey, {
      person_key: personKey,
      full_name: fullName,
      roles: [role],
      reason_code: reasonCode,
      reason,
    });
  };

  const parentOwned = normalized(profile.parentOwned) === 'yes' || profile.businessType === 'parent_owned';
  const regulated = normalized(profile.regulatedBusiness) === 'yes';
  const international = profile.country !== 'CA' && profile.country !== 'US' && profile.country !== '';
  const highRisk = ['high_risk', 'crypto', 'gaming'].includes(profile.industry);
  const ownerIdsReady = yes(profile.documentReadiness.ownerIds);

  profile.beneficialOwners.forEach((owner, index) => {
    const qualifies = owner.ownership_percent == null || owner.ownership_percent >= 25;
    if (!qualifies) return;
    addPerson(
      owner.key || `owner_${index + 1}`,
      owner.full_name,
      'beneficial_owner',
      owner.ownership_percent == null ? 'beneficial_owner_from_common_intake' : 'beneficial_owner_threshold',
      owner.ownership_percent == null
        ? 'This person was listed in the beneficial owner intake section and should be verified.'
        : 'This person meets the beneficial ownership threshold.',
      owner.email
    );
  });

  if (profile.authorizedSigner.full_name) {
    addPerson(
      'authorized_signer',
      profile.authorizedSigner.full_name,
      'authorized_signer',
      'signer_identity_required',
      'The authorized signer can bind the business and should be identity verified.',
      profile.authorizedSigner.email
    );
  }

  if (profile.nonOwnerController.present) {
    addPerson(
      profile.nonOwnerController.full_name ? 'non_owner_controller' : 'unknown_non_owner_controller_1',
      profile.nonOwnerController.full_name,
      'non_owner_controller',
      profile.nonOwnerController.full_name ? 'control_person_required' : 'control_person_incomplete',
      profile.nonOwnerController.full_name
        ? 'This person has significant managerial or financial control but is not a listed owner.'
        : 'A non-owner controller was disclosed, but identifying details are incomplete.'
    );
  }

  profile.guarantors.forEach((guarantor, index) => {
    addPerson(
      guarantor.person_key || `guarantor_${index + 1}`,
      guarantor.full_name,
      'guarantor',
      guarantor.full_name ? 'guarantor_required' : 'guarantor_identity_incomplete',
      guarantor.full_name
        ? 'This person is listed as a guarantor and should be verified if the guarantee is required.'
        : 'A guarantor appears to be required, but identifying details are incomplete.'
    );
  });

  const kybRequired = isBusinessEntityType(profile.businessType) || profile.parentEntities.length > 0;
  const kybTargets: VerificationEntityTarget[] = kybRequired
    ? [
        {
          entity_key: 'applicant_entity',
          entity_name: hasText(profile.legalName) ? profile.legalName.trim() : null,
          roles: ['applicant_legal_entity'],
          reason_code: 'primary_business_entity',
          reason: 'The applicant legal entity must be verified for business registration, ownership, and banking support.',
        },
      ]
    : [];
  profile.parentEntities.forEach((entity) => {
    kybTargets.push({
      entity_key: entity.entity_key,
      entity_name: entity.entity_name,
      roles: ['parent_entity'],
      reason_code: 'parent_entity_review',
      reason: 'A parent-owned structure was disclosed, so the parent entity should be identified for KYB review.',
    });
  });

  const placement: VerificationPlacement =
    highRisk || regulated || international || parentOwned || profile.nonOwnerController.present
      ? 'early_checkpoint'
      : profile.missingCriticalFieldsSummary.length === 0 && ownerIdsReady
        ? 'late_checkpoint'
        : 'standard_checkpoint';

  return {
    placement,
    kyb_required: kybRequired,
    kyc_required: people.size > 0,
    kyb_targets: kybTargets,
    kyc_targets: Array.from(people.values()),
    reason_code:
      placement === 'early_checkpoint'
        ? 'early_complex_verification'
        : placement === 'late_checkpoint'
          ? 'late_low_friction_verification'
          : 'default_midflow_multi_party_verification',
    reason:
      placement === 'early_checkpoint'
        ? 'Elevated risk, structure complexity, or control ambiguity makes it safer to resolve verification earlier.'
        : placement === 'late_checkpoint'
          ? 'The merchant appears simple and well prepared, so the checkpoint can wait until later without increasing risk.'
          : 'The merchant has a normal business profile, so verification should happen at the default controlled checkpoint.',
    blocking_items: profile.missingCriticalFieldsSummary.map((item) =>
      item
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    ),
  };
}

export function summarizeVerificationPlan(plan: VerificationPlan): string {
  const kybText =
    plan.kyb_targets.length > 0
      ? plan.kyb_targets
          .map((target) => `${target.entity_name || target.entity_key} [${target.roles.join(', ')}]`)
          .join(', ')
      : 'none';
  const kycText =
    plan.kyc_targets.length > 0
      ? plan.kyc_targets
          .map((target) => `${target.full_name || target.person_key} [${target.roles.join(', ')}]`)
          .join(', ')
      : 'none';
  const blockingText = plan.blocking_items.length > 0 ? plan.blocking_items.join(', ') : 'none';
  return [
    `KYC / KYB checkpoint placement: ${plan.placement}.`,
    `KYB required: ${plan.kyb_required ? 'yes' : 'no'}.`,
    `KYC required: ${plan.kyc_required ? 'yes' : 'no'}.`,
    `KYB targets: ${kybText}.`,
    `KYC targets: ${kycText}.`,
    `Reason: ${plan.reason}`,
    `Blocking items: ${blockingText}.`,
  ].join(' ');
}

export async function requestVerificationPlan(
  merchantData: MerchantData
): Promise<VerificationPlan> {
  const profile = buildVerificationPlannerProfile(merchantData);
  const response = await fetch('/api/intake/verification-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verificationProfile: profile }),
  });

  if (!response.ok) {
    throw new Error(`Verification plan failed (${response.status})`);
  }

  return response.json() as Promise<VerificationPlan>;
}
