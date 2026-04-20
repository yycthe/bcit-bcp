/**
 * Onboarding policy text: fed to Gemini as the system contract for AI intake
 * planning and AI underwriting review. These rules are context and guardrails;
 * they do not produce local risk scores, processor routes, approval decisions,
 * or fallback recommendations.
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
  'App readiness checks collect KYB/KYC routing context, missing intake fields, and document coverage for AI review.',
  'Admin Portal records KYC / KYB verification status and follow-up issues as evidence for the AI review.',
  'AI reviews the application end-to-end (intake answers, uploaded documents, website, and policy/context packet) and produces the risk score, recommended processor, recommended action, and merchant message.',
  'Merchant Portal asks only the matched processor-specific second-layer questions.',
  'System assembles a processor-ready package for Admin approval and routing — admin has final say.',
];

export const ONBOARDING_POLICY_RULES = [
  'Do not ask Nuvei, Payroc / Peoples, or Chase-specific questions during Common Intake.',
  'Do not route to a processor until Common Intake and KYC / KYB readiness checks are sufficiently complete.',
  'AI produces all underwriting recommendations: risk score, risk category, processor route, action, admin notes, and merchant-facing message.',
  'App-side checks are context only. They must never become a local risk score, local processor route, approval decision, or fallback recommendation.',
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
  'Processor routing guide for AI:',
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
