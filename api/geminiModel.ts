/**
 * Gemini model selection for Vercel serverless functions.
 *
 * Free-tier API keys often have **zero** quota for `gemini-2.5-pro`. Defaults therefore
 * use `gemini-2.5-flash` (still multimodal). Set env vars after enabling billing to use Pro.
 *
 * **Gemini 3 Flash:** set `GEMINI_REVIEW_MODEL`, `GEMINI_EXTRACT_MODEL`, and/or `GEMINI_PLAN_MODEL`
 * to the exact model string shown in [Google AI Studio](https://aistudio.google.com/) (e.g. a
 * `gemini-3-flash` / `gemini-3-flash-preview` id — names change with releases; always copy from Studio).
 */

export const GEMINI_MODEL_FLASH = 'gemini-2.5-flash';
export const GEMINI_MODEL_PRO = 'gemini-2.5-pro';

/** Full application review (`api/ai-review`). */
export function resolveReviewModel(): string {
  const fromEnv =
    process.env.GEMINI_REVIEW_MODEL?.trim() || process.env.AI_REVIEW_MODEL?.trim();
  return fromEnv || GEMINI_MODEL_FLASH;
}

/** Document field extraction (`api/intake/extract`). */
export function resolveExtractModel(): string {
  const fromEnv = process.env.GEMINI_EXTRACT_MODEL?.trim();
  return fromEnv || GEMINI_MODEL_FLASH;
}

/** Intake section planner (`api/intake/plan`). */
export function resolvePlanModel(): string {
  const fromEnv =
    process.env.GEMINI_PLAN_MODEL?.trim() || process.env.GEMINI_INTAKE_PLAN_MODEL?.trim();
  return fromEnv || GEMINI_MODEL_FLASH;
}

export function isGeminiQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();
  if (lower.includes('resource_exhausted')) return true;
  if (lower.includes('"code":429') || lower.includes(' 429') || lower.includes('status":429')) return true;
  if (lower.includes('quota') && (lower.includes('exceeded') || lower.includes('limit: 0'))) return true;
  return false;
}
