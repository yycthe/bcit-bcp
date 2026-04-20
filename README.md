# BCIT BCP

BCIT **Business Consulting Project** — an AI-assisted payment-processing onboarding platform for merchant intake, KYC / KYB readiness, document review, processor routing, and package approval. Gemini 2.5 Flash does the heavy-lifting review; a deterministic policy-check layer runs alongside as an auditable baseline; a human admin always confirms the final decision.

## Features

- **Merchant Portal** — guided Common Intake, PDF / image upload to Vercel Blob, application review, status tracking, dynamic processor-specific follow-up, and agreement flow.
- **Admin AI Workbench** — application queue plus a per-application workbench where AI produces a verdict (risk score, recommended processor, action plan, red flags, document consistency). Admin can accept the AI plan one-click, or override any field (KYC / KYB, processor, decision, merchant message).
- **Multimodal AI review** — Gemini 2.5 Flash reads the merchant's answers, policy-check baseline, **uploaded PDFs and images directly (as `inlineData`)**, and the merchant's website URL, then returns a structured JSON verdict.
- **Policy-check baseline** — deterministic rules over intake answers, document coverage, and KYC / KYB readiness. Always visible as a second opinion next to the AI output (`src/lib/underwritingFallback.ts`).
- **Onboarding policy prompt** — one source of truth (`src/lib/ruleBasedWorkflow.ts` → `ONBOARDING_POLICY_PROMPT`) that the Admin UI displays verbatim and a mirrored copy inside `api/ai-review.ts` injects into every Gemini call.
- **Dynamic KYC / KYB forms** — once a processor is matched, only that processor's follow-up questions are rendered (Nuvei, Payroc / Peoples, or Chase).
- **Multi-file blob upload** — PDFs / images upload directly to Vercel Blob via a signed client-upload token (up to 25 MB per file).
- **Processor-ready package** — common answers, KYC / KYB status, routing result, AI review summary, policy-check summary, processor-specific answers, document checklist, missing items, and readiness status.

## Deploy on Vercel

### 1. Required environment variables

Add these in **Vercel Dashboard → Project → Settings → Environment Variables** (apply to Production, Preview, and Development):

| Variable | Value | Where to get it |
|---|---|---|
| `GOOGLE_API_KEY` | Your Google Gemini API key | https://aistudio.google.com/apikey |
| `BLOB_READ_WRITE_TOKEN` | Auto-populated | Dashboard → **Storage** → create a Blob store → connect it to this project; Vercel injects the token automatically |

After saving env vars, redeploy (Deployments → latest → **Redeploy**) so the serverless functions pick them up.

### 2. Steps

1. Push to GitHub.
2. Import the repo in Vercel.
3. Framework preset: **Vite** (auto-detected).
4. Add `GOOGLE_API_KEY` in Environment Variables.
5. Storage → **Create → Blob** → connect to project.
6. Redeploy.

### 3. Local dev

Create a `.env.local`:

```
GOOGLE_API_KEY=your_gemini_key
BLOB_READ_WRITE_TOKEN=your_blob_token
```

Then:

```
npm install
npm run dev
```

Use `vercel dev` for full parity (serverless functions in `api/`).

## Stack

- React 19 · TypeScript · Vite 6 · Tailwind CSS 4
- Lucide icons · Sonner toasts
- `@google/genai` (Gemini 2.5 Flash, multimodal)
- `@vercel/blob` (client-upload)
- Vercel static + serverless functions

## Workflow

1. Merchant completes Common Intake.
2. Policy checks decide KYB / KYC / both / KYB-first.
3. Admin records KYC / KYB verification results.
4. **AI (Gemini 2.5 Flash)** reviews the whole application — intake answers + policy-check baseline + uploaded PDFs/images (inline) + website URL — and returns a structured verdict.
5. Admin reviews the AI verdict and either accepts the plan or overrides any step.
6. Merchant completes only the matched processor-specific follow-up questions.
7. Admin approves the processor-ready package.

## Onboarding Policy Prompt

The in-app source of truth lives in `src/lib/ruleBasedWorkflow.ts`, exported as `ONBOARDING_POLICY_PROMPT` (backwards-compatible alias: `RULE_BASED_MASTER_PROMPT`). It is:

- Shown verbatim inside the Admin Workbench (Manual override → Policy prompt).
- Mirrored as a constant inside `api/ai-review.ts` so the serverless function injects it into the Gemini system instruction on every call — the AI and the UI cannot drift.

Supporting modules:

- Common Intake question bank: `src/lib/intake/commonQuestionBank.ts`
- KYC / KYB trigger rules: `src/lib/intake/personaTriggerRules.ts`
- Processor follow-up master lists: `src/lib/onboardingWorkflow.ts`
- Policy-check scoring: `src/lib/underwritingFallback.ts`
- AI review client: `src/lib/aiReview.ts` → serverless function `api/ai-review.ts`

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port `3000`. |
| `npm run build` | Production build to `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Typecheck with `tsc --noEmit`. |

## Repository

`https://github.com/yycthe/bcit-bcp`

---

Course / demo project. Not production payment software.
