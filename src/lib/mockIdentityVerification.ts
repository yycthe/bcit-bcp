import type { MerchantData } from '@/src/types';
import type { MerchantDocumentKey } from '@/src/lib/documentChecklist';

/** Simulated third-party check status (not the same as internal file status). */
export type MockProviderStatus = 'approved' | 'needs_resubmission' | 'pending';

export type IntakeRemediationTarget =
  | { kind: 'document'; documentKey: MerchantDocumentKey; whereLabel: string }
  | { kind: 'intake'; questionId: string; whereLabel: string };

export type MockRemediationItem = {
  id: string;
  provider: 'kyc_vendor' | 'kyb_vendor' | 'persona';
  reason: string;
  target: IntakeRemediationTarget;
};

export type MockKycPayload = {
  provider: 'kyc_vendor';
  referenceId: string;
  status: MockProviderStatus;
  checkedAt: string;
  signals: { code: string; message: string }[];
  personaInquiryId?: string;
};

export type MockKybPayload = {
  provider: 'kyb_vendor';
  referenceId: string;
  status: MockProviderStatus;
  checkedAt: string;
  businessMatchScore?: number;
  signals: { code: string; message: string }[];
};

/** Persona-style inquiry + webhook-shaped outcome (demo only). */
export type MockPersonaPayload = {
  provider: 'persona';
  inquiryId: string;
  status: 'completed' | 'failed' | 'pending';
  decision: 'approved' | 'declined' | 'manual_review';
  checkedAt: string;
  fieldsFailed: { field: string; reason: string }[];
  webhookEvent: 'inquiry.completed' | 'inquiry.failed';
};

export type MockIdentityBundle = {
  kyc: MockKycPayload;
  kyb: MockKybPayload;
  persona: MockPersonaPayload;
  remediations: MockRemediationItem[];
};

export type IdentityDemoScenario =
  | 'default'
  | 'all_pass'
  | 'persona_decline_id'
  | 'persona_decline_kyb_doc'
  | 'kyc_owner_mismatch'
  | 'kyb_business_mismatch'
  | 'combined_failures';

function hasFile(data: MerchantData, key: MerchantDocumentKey): boolean {
  const v = data[key];
  return v != null && typeof v === 'object';
}

function idw(): string {
  return `demo_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Maps Persona-style field failures to Intake steps merchants can reopen.
 */
export function fieldToRemediation(
  field: string,
  reason: string,
  provider: MockRemediationItem['provider']
): MockRemediationItem | null {
  const base = { provider, id: `${provider}_${field}` };
  switch (field) {
    case 'government_id':
    case 'selfie':
      return {
        ...base,
        id: 'persona_government_id',
        reason,
        target: {
          kind: 'document',
          documentKey: 'idUpload',
          whereLabel: 'Intake Assistant → Documents → Government-issued ID',
        },
      };
    case 'business_registration':
    case 'formation_document':
      return {
        ...base,
        id: 'persona_business_registration',
        reason,
        target: {
          kind: 'document',
          documentKey: 'registrationCertificate',
          whereLabel: 'Intake Assistant → Documents → Business registration',
        },
      };
    case 'proof_of_address':
      return {
        ...base,
        id: 'persona_proof_of_address',
        reason,
        target: {
          kind: 'document',
          documentKey: 'proofOfAddress',
          whereLabel: 'Intake Assistant → Documents → Proof of address',
        },
      };
    case 'bank_statement':
      return {
        ...base,
        id: 'persona_bank_statement',
        reason,
        target: {
          kind: 'document',
          documentKey: 'bankStatement',
          whereLabel: 'Intake Assistant → Documents → Bank statement',
        },
      };
    case 'owner_name_mismatch':
      return {
        ...base,
        id: 'persona_owner_name',
        reason,
        target: {
          kind: 'intake',
          questionId: 'ownerDetailsForm',
          whereLabel: 'Intake Assistant → Business profile → Owner details',
        },
      };
    case 'business_name_mismatch':
      return {
        ...base,
        id: 'persona_business_name',
        reason,
        target: {
          kind: 'intake',
          questionId: 'companyDetailsForm',
          whereLabel: 'Intake Assistant → Business profile → Company details',
        },
      };
    default:
      return {
        ...base,
        id: `${provider}_${field}`,
        reason,
        target: {
          kind: 'document',
          documentKey: 'idUpload',
          whereLabel: 'Intake Assistant → Documents (start with ID)',
        },
      };
  }
}

export function evaluateMockIdentityBundle(
  merchantData: MerchantData,
  scenario: IdentityDemoScenario = 'default'
): MockIdentityBundle {
  const now = new Date().toISOString();
  const idPresent = hasFile(merchantData, 'idUpload');
  const regPresent = hasFile(merchantData, 'registrationCertificate');

  let kycStatus: MockProviderStatus = 'approved';
  let kybStatus: MockProviderStatus = 'approved';
  let personaDecision: 'approved' | 'declined' | 'manual_review' = 'approved';
  const personaFailed: { field: string; reason: string }[] = [];
  const remediations: MockRemediationItem[] = [];

  const pushUnique = (item: MockRemediationItem) => {
    if (!remediations.some((r) => r.id === item.id)) remediations.push(item);
  };

  switch (scenario) {
    case 'all_pass':
      break;
    case 'persona_decline_id':
      personaDecision = 'declined';
      personaFailed.push({
        field: 'government_id',
        reason: 'Image unclear / failed liveness or authenticity checks (simulated).',
      });
      kycStatus = 'needs_resubmission';
      personaFailed.forEach((f) => {
        const r = fieldToRemediation(f.field, f.reason, 'persona');
        if (r) pushUnique(r);
      });
      break;
    case 'persona_decline_kyb_doc':
      personaDecision = 'declined';
      personaFailed.push({
        field: 'business_registration',
        reason: 'Registration document does not match legal entity name on file (simulated).',
      });
      kybStatus = 'needs_resubmission';
      personaFailed.forEach((f) => {
        const r = fieldToRemediation(f.field, f.reason, 'persona');
        if (r) pushUnique(r);
      });
      break;
    case 'kyc_owner_mismatch':
      kycStatus = 'needs_resubmission';
      personaDecision = 'manual_review';
      personaFailed.push({
        field: 'owner_name_mismatch',
        reason: 'ID name does not match owner name submitted in application (simulated).',
      });
      personaFailed.forEach((f) => {
        const r = fieldToRemediation(f.field, f.reason, 'kyc_vendor');
        if (r) pushUnique(r);
      });
      break;
    case 'kyb_business_mismatch':
      kybStatus = 'needs_resubmission';
      personaDecision = 'declined';
      personaFailed.push({
        field: 'business_name_mismatch',
        reason: 'Registry listing does not match legal name (simulated).',
      });
      personaFailed.forEach((f) => {
        const r = fieldToRemediation(f.field, f.reason, 'kyb_vendor');
        if (r) pushUnique(r);
      });
      break;
    case 'combined_failures':
      personaDecision = 'declined';
      personaFailed.push(
        {
          field: 'government_id',
          reason: 'Government ID rejected (simulated).',
        },
        {
          field: 'business_registration',
          reason: 'Business document rejected (simulated).',
        }
      );
      kycStatus = 'needs_resubmission';
      kybStatus = 'needs_resubmission';
      personaFailed.forEach((f) => {
        const prov =
          f.field === 'government_id' || f.field === 'selfie'
            ? ('kyc_vendor' as const)
            : f.field === 'business_registration' || f.field === 'formation_document'
              ? ('kyb_vendor' as const)
              : ('persona' as const);
        const r = fieldToRemediation(f.field, f.reason, prov);
        if (r) pushUnique(r);
      });
      break;
    case 'default':
    default:
      if (!idPresent) {
        kycStatus = 'needs_resubmission';
        personaDecision = 'declined';
        personaFailed.push({
          field: 'government_id',
          reason: 'No acceptable government ID on file (simulated default).',
        });
      }
      if (!regPresent) {
        kybStatus = 'needs_resubmission';
        if (personaDecision === 'approved') personaDecision = 'manual_review';
        personaFailed.push({
          field: 'business_registration',
          reason: 'Business registration / certificate missing or unreadable (simulated default).',
        });
      }
      personaFailed.forEach((f) => {
        const prov =
          f.field === 'government_id' || f.field === 'selfie'
            ? ('kyc_vendor' as const)
            : f.field === 'business_registration' || f.field === 'formation_document'
              ? ('kyb_vendor' as const)
              : ('persona' as const);
        const r = fieldToRemediation(f.field, f.reason, prov);
        if (r) pushUnique(r);
      });
      break;
  }

  const kyc: MockKycPayload = {
    provider: 'kyc_vendor',
    referenceId: idw(),
    status: kycStatus,
    checkedAt: now,
    signals:
      kycStatus === 'approved'
        ? [{ code: 'KYC_CLEAR', message: 'Owner identity checks passed (simulated).' }]
        : [{ code: 'KYC_RESUBMIT', message: 'Resubmit owner identity evidence in the portal (simulated).' }],
    personaInquiryId: `inq_${idw()}`,
  };

  const kyb: MockKybPayload = {
    provider: 'kyb_vendor',
    referenceId: idw(),
    status: kybStatus,
    checkedAt: now,
    businessMatchScore: kybStatus === 'approved' ? 0.94 : 0.42,
    signals:
      kybStatus === 'approved'
        ? [{ code: 'KYB_CLEAR', message: 'Business registry match OK (simulated).' }]
        : [{ code: 'KYB_DOC', message: 'Business documents need correction (simulated).' }],
  };

  const persona: MockPersonaPayload = {
    provider: 'persona',
    inquiryId: `inq_${idw()}`,
    status: personaDecision === 'approved' ? 'completed' : 'failed',
    decision: personaDecision,
    checkedAt: now,
    fieldsFailed: personaFailed,
    webhookEvent: personaDecision === 'approved' ? 'inquiry.completed' : 'inquiry.failed',
  };

  return { kyc, kyb, persona, remediations };
}

export function remediationsForProvider(
  bundle: MockIdentityBundle,
  service: 'kyc_vendor' | 'kyb_vendor' | 'persona'
): MockRemediationItem[] {
  return bundle.remediations.filter((r) => r.provider === service);
}
