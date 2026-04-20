import {
  COMMON_INTAKE_FORM_SEQUENCE,
  COMMON_INTAKE_FORMS,
  COMMON_QUESTION_BANK,
} from '@/src/lib/intake/commonQuestionBank';
import { getProcessorQuestionSet, type ProcessorFit } from '@/src/lib/onboardingWorkflow';

const PROCESSOR_SEQUENCE: ProcessorFit[] = ['Nuvei', 'Payroc / Peoples', 'Chase'];

export const ONBOARDING_WORKFLOW_STEPS = [
  'Merchant Portal collects only the Common Questions first.',
  'Policy checks decide whether KYB, KYC, both, or KYB-first should be requested before any processor routing.',
  'Admin Portal records local KYC / KYB verification status and follow-up issues.',
  'AI reviews the application end-to-end (intake answers, uploaded documents, website, policy-check output) and produces a risk score, recommended processor, and recommended action.',
  'Merchant Portal asks only the matched processor-specific second-layer questions.',
  'System assembles a processor-ready package for Admin approval and routing — admin has final say.',
];

export const ONBOARDING_POLICY_RULES = [
  'Do not ask Nuvei, Payroc / Peoples, or Chase-specific questions during Common Intake.',
  'Do not route to a processor until Common Intake and KYC / KYB readiness checks are sufficiently complete.',
  'AI is used as a review assistant only. Every final underwriting decision, processor assignment, and merchant-facing message is confirmed by a human admin before it takes effect.',
  'Policy checks (deterministic rules over merchant answers and uploaded-document status) run alongside AI as an auditable baseline. AI may overrule the policy check only when the model provides a concrete reason.',
  'Prefer dropdowns and short structured answers. Use free text only for names, addresses, explanations, contacts, and narrative business descriptions.',
  'Admin may override processor routing, but the AI recommendation, policy-check baseline, and missing-item reasons must remain visible.',
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
  'Processor routing guide for AI and policy checks:',
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
