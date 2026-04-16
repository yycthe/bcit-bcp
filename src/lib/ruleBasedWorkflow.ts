import {
  COMMON_INTAKE_FORM_SEQUENCE,
  COMMON_INTAKE_FORMS,
  COMMON_QUESTION_BANK,
} from '@/src/lib/intake/commonQuestionBank';
import { getProcessorQuestionSet, type ProcessorFit } from '@/src/lib/onboardingWorkflow';

const PROCESSOR_SEQUENCE: ProcessorFit[] = ['Nuvei', 'Payroc / Peoples', 'Chase'];

export const RULE_BASED_WORKFLOW_STEPS = [
  'Merchant Portal collects only the Common Questions first.',
  'Rules decide whether KYB, KYC, both, or KYB-first should be requested.',
  'Admin Portal records local KYC / KYB verification status and follow-up issues.',
  'Rule-based review scores readiness, risk drivers, document gaps, website/compliance signals, and processor fit.',
  'Merchant Portal asks only the matched processor-specific second-layer questions.',
  'System assembles a processor-ready package for Admin approval and routing.',
];

export const RULE_BASED_PORTAL_RULES = [
  'Do not ask Nuvei, Payroc / Peoples, or Chase-specific questions during Common Intake.',
  'Do not route to a processor until Common Intake and KYC / KYB readiness rules are sufficiently complete.',
  'Do not use AI or external identity APIs in this demo; all decisions are deterministic rules over merchant answers and uploaded-document status.',
  'Prefer dropdowns and short structured answers. Use free text only for names, addresses, explanations, contacts, and narrative business descriptions.',
  'Admin may override processor routing, but the rule-based recommendation and missing-item reasons must remain visible.',
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

export const RULE_BASED_MASTER_PROMPT = [
  'Design and operate this merchant onboarding app as a deterministic rule-based workflow. Do not call AI models and do not depend on external KYC / KYB APIs.',
  '',
  'Required app flow:',
  RULE_BASED_WORKFLOW_STEPS.map((step, index) => `${index + 1}. ${step}`).join('\n'),
  '',
  'Global rules:',
  RULE_BASED_PORTAL_RULES.map((rule) => `- ${rule}`).join('\n'),
  '',
  'Common Intake master list:',
  formatCommonQuestionBlocks(),
  '',
  'Processor-specific follow-up master list:',
  formatProcessorBlocks(),
].join('\n');
