/**
 * Onboarding policy text: used as the system contract for every Gemini call, for the
 * in-app “Policy prompt” panel. Kept in source as a single spec, with a minimal copy in
 * `api/ai-review.ts` for the serverless bundle.
 */
import {
  COMMON_INTAKE_FORM_SEQUENCE,
  COMMON_INTAKE_FORMS,
  COMMON_QUESTION_BANK,
} from '@/src/lib/intake/commonQuestionBank';
import { getProcessorQuestionSet, type ProcessorFit } from '@/src/lib/onboardingWorkflow';

const PROCESSOR_SEQUENCE: ProcessorFit[] = ['Nuvei', 'Payroc / Peoples', 'Chase'];

export const ONBOARDING_WORKFLOW_STEPS = [
  'Merchant Portal collects only the Common Questions first.',
  'Controlled verification planning decides where KYC / KYB belongs and which parties require KYB or KYC before processor routing.',
  'Admin Portal records local KYC / KYB verification status and follow-up issues.',
  'AI reviews the application end-to-end (intake answers, uploaded documents, website, verification context) and produces the risk score, recommended processor, and recommended action.',
  'Merchant Portal asks only the matched processor-specific second-layer questions.',
  'System assembles a processor-ready package for Admin approval and routing — admin has final say.',
];

export const ONBOARDING_POLICY_RULES = [
  'Do not ask Nuvei, Payroc / Peoples, or Chase-specific questions during Common Intake.',
  'Do not route to a processor until Common Intake and KYC / KYB readiness checks are sufficiently complete.',
  'AI produces all underwriting recommendations; every final processor assignment and merchant-facing message must be explicitly confirmed by a human admin.',
  'Readiness checks may provide context to the model, but they must not supply the final risk score, processor route, or approval recommendation.',
  'Prefer dropdowns and short structured answers. Use free text only for names, addresses, explanations, contacts, and narrative business descriptions.',
  'Admin advanced overrides remain available for disputes; the verbatim policy prompt stays exposed for audit.',
];

function formatCommonQuestionBlocks(): string {
  return COMMON_INTAKE_FORM_SEQUENCE.map((formId) => {
    const form = COMMON_INTAKE_FORMS[formId];
    const questions = COMMON_QUESTION_BANK.filter((question) => question.formId === formId)
      .map((question) => `${question.number}. ${question.prompt}`)
      .join('\n');
    return `${form.title}\n${questions}`;
  }).join('\n\n');
}

function formatProcessorBlocks(): string {
  return PROCESSOR_SEQUENCE.map((processor) => {
    const set = getProcessorQuestionSet(processor);
    const sections = set.sections
      .map((section) => {
        const questions = section.questions.map((question) => `- ${question}`).join('\n');
        return `${section.title}\n${questions}`;
      })
      .join('\n\n');
    return `${set.processor}\n${sections}`;
  }).join('\n\n');
}

export const ONBOARDING_POLICY_PROMPT = [
  'Operate this merchant onboarding app as an AI-assisted workflow governed by explicit policy rules. AI reviews every submitted application; a human admin always confirms the final decision.',
  '',
  'Required app flow:',
  ONBOARDING_WORKFLOW_STEPS.map((step, index) => `${index + 1}. ${step}`).join('\n'),
  '',
  'Global rules (enforced regardless of AI output):',
  ONBOARDING_POLICY_RULES.map((rule) => `- ${rule}`).join('\n'),
  '',
  'Processor routing guide for AI review:',
  '- Nuvei: standard Canadian merchants, clean KYC / KYB, low-to-mid risk.',
  '- Payroc / Peoples: adverse history, higher risk, needs manual review or specialized underwriting.',
  '- Chase: larger enterprise, card-not-present heavy, advance-payment, structured ownership, international.',
  '',
  'Common Intake master list:',
  formatCommonQuestionBlocks(),
  '',
  'Processor-specific follow-up master list:',
  formatProcessorBlocks(),
].join('\n');

// Backwards-compatible aliases — old names still resolve while consumers migrate.
export const RULE_BASED_MASTER_PROMPT = ONBOARDING_POLICY_PROMPT;
export const RULE_BASED_PORTAL_RULES = ONBOARDING_POLICY_RULES;
export const RULE_BASED_WORKFLOW_STEPS = ONBOARDING_WORKFLOW_STEPS;
