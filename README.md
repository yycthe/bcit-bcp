# BCIT BCP

BCIT **Business Consulting Project** — an AI-assisted payment-processing onboarding platform for merchant intake, KYC / KYB readiness, document review, processor routing, and package approval. **Gemini 2.5 Pro** runs the underwriting review over PDFs/images and intake data; lighter models handle intake planning and field extraction; a **silent deterministic fallback** (`getFallbackUnderwriting`) only activates when the model fails; a human admin always confirms the final decision.

## Features

- **Merchant Portal** — guided Common Intake, PDF / image upload to Vercel Blob, AI-tailored question path (after volume gate), AI document field extraction preview (Apply / Ignore), application review, status tracking, processor-specific follow-up, agreement flow.
- **Admin AI Workbench** — queue plus per-application workspace: AI verdict hero (Gemini 2.5 Pro), confirm / edit-before-send, action checklist, evidence with citations; **no baseline panel on success** — if AI errors, deterministic scores return as a warning banner until you re-run AI.
- **Multimodal AI review** — `POST /api/ai-review`: reads intake JSON, deterministic baseline (payload only), **HTTPS Blob documents as inlineData**, merchant website URL, onboarding policy prompt; returns structured JSON (`evidenceCitations`, red flags, routing, merchant message).
- **AI intake planner** — `POST /api/intake/plan` (Gemini 2.5 Flash): after the five anchor answers, returns an ordered plan of common forms, persona gate, and document slots under the same policy text.
- **AI document extraction** — `POST /api/intake/extract` (Gemini 2.5 Pro): for selected upload slots (`idUpload`, registration, bank statement, proof of address), returns suggested `MerchantData` keys; merchants apply explicitly (no silent overwrite).
- **Onboarding policy prompt** — source in `src/lib/ruleBasedWorkflow.ts` (`ONBOARDING_POLICY_PROMPT`), mirrored minimally in `api/ai-review.ts` for bundling.

## Serverless APIs (Vercel)

| Route | Model | Purpose |
| --- | --- | --- |
| `POST /api/ai-review` | `gemini-2.5-pro` | Full application review + multimodal docs |
| `POST /api/intake/plan` | `gemini-2.5-flash` | Ordered intake sections after anchor answers |
| `POST /api/intake/extract` | `gemini-2.5-pro` | Extract field suggestions from one uploaded doc |

Rough cost expectation (order of magnitude): Flash calls are cents; each Pro review with a few MB of PDF is typically **sub‑USD** per run depending on region pricing—monitor usage in Google AI Studio.

## Deploy on Vercel

### 1. Required environment variables

Add these in **Vercel Dashboard → Project → Settings → Environment Variables** (Production, Preview, Development):

| Variable | Value | Where to get it |
|---|---|---|
| `GOOGLE_API_KEY` | Your Google Gemini API key | https://aistudio.google.com/apikey |
| `BLOB_READ_WRITE_TOKEN` | Auto-populated | Dashboard → **Storage** → Blob → connect to project |

Redeploy after changing env vars.

### 2. Steps

1. Push to GitHub.
2. Import the repo in Vercel.
3. Framework preset: **Vite**.
4. Add `GOOGLE_API_KEY`.
5. Storage → **Blob** → connect.
6. Redeploy.

### 3. Local dev

`.env.local`:

```
GOOGLE_API_KEY=your_gemini_key
BLOB_READ_WRITE_TOKEN=your_blob_token
```

```
npm install
npm run dev
```

Use `vercel dev` for full parity with `/api/*`.

## Stack

- React 19 · TypeScript · Vite 6 · Tailwind CSS 4
- `@google/genai` (Gemini 2.5 Flash + Pro)
- `@vercel/blob`
- Vercel static + Node serverless functions

## Workflow

1. Merchant completes anchor questions → **AI planner** tailors forms + uploads.
2. Merchant uploads docs; optional **extract** preview fills fields after confirmation.
3. Merchant submits → status **under review**.
4. Admin opens workbench → **Gemini Pro** reviews everything (multimodal).
5. Admin **confirms** or edits message/processor → merchant / routing updated.
6. Merchant completes processor-specific follow-up → package ready.

## Onboarding Policy Prompt

Defined in `src/lib/ruleBasedWorkflow.ts` as `ONBOARDING_POLICY_PROMPT`. A duplicate constant lives in `api/ai-review.ts` so Vercel esbuild never has to chase `src/` aliases.

Supporting modules:

- Common Intake question bank: `src/lib/intake/commonQuestionBank.ts`
- AI intake plan client: `src/lib/intake/aiPlan.ts`
- KYC / KYB trigger rules: `src/lib/intake/personaTriggerRules.ts`
- Processor follow-up lists: `src/lib/onboardingWorkflow.ts`
- Silent fallback scoring: `src/lib/underwritingFallback.ts`
- AI review client: `src/lib/aiReview.ts` → `api/ai-review.ts`

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port `3000`. |
| `npm run build` | Production build to `dist/`. |
| `npm run preview` | Preview production build. |
| `npm run lint` | `tsc --noEmit`. |

## Repository

`https://github.com/yycthe/bcit-bcp`

---

Course / demo project. Not production payment software.
