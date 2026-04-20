# BCIT BCP

BCIT **Business Consulting Project** — an AI-first payment-processing onboarding platform for merchant intake, KYC / KYB readiness context, document review, processor routing, and package approval. **Gemini 2.5 Flash** (default) runs multimodal underwriting review and document field extraction; **Gemini 2.5 Pro** is optional via env when your Google AI project has Pro quota. **Gemini 2.5 Flash** also powers intake planning. App-side policy checks are fed to AI as context only; risk score, processor route, recommended action, admin notes, and merchant message all come from AI, with a human admin confirming the final decision.

## Features

- **Merchant Portal** — guided Common Intake, PDF / image upload to Vercel Blob, AI-tailored question path (after volume gate), AI document field extraction preview (Apply / Ignore), application review, status tracking, processor-specific follow-up, agreement flow.
- **Admin AI Workbench** — queue plus per-application workspace: AI verdict hero (Gemini, default Flash), confirm / edit-before-send, action checklist, evidence with citations; if AI errors, no local recommendation is shown until you re-run AI.
- **Multimodal AI review** — `POST /api/ai-review`: reads intake JSON, AI review context packet, **HTTPS Blob documents as inlineData**, merchant website URL, onboarding policy prompt; returns structured JSON (`evidenceCitations`, red flags, routing, merchant message).
- **AI intake planner** — `POST /api/intake/plan` (Gemini 2.5 Flash): after the five anchor answers, returns an ordered plan of common forms, persona gate, and document slots under the same policy text.
- **AI document extraction** — `POST /api/intake/extract` (default Flash, multimodal): for selected upload slots (`idUpload`, registration, bank statement, proof of address), returns suggested `MerchantData` keys; merchants apply explicitly (no silent overwrite).
- **Onboarding policy prompt** — source in `src/lib/aiPolicyWorkflow.ts` (`ONBOARDING_POLICY_PROMPT`), mirrored minimally in `api/ai-review.ts` for bundling. The rules are guardrails for AI, not a local decision engine.

## Serverless APIs (Vercel)

| Route | Model | Purpose |
| --- | --- | --- |
| `POST /api/ai-review` | `gemini-2.5-flash` by default (`GEMINI_REVIEW_MODEL` / `AI_REVIEW_MODEL`) | Full application review + multimodal docs |
| `POST /api/intake/plan` | `gemini-2.5-flash` by default (`GEMINI_PLAN_MODEL`) | Ordered intake sections after anchor answers |
| `POST /api/intake/extract` | `gemini-2.5-flash` by default (`GEMINI_EXTRACT_MODEL`) | Extract field suggestions from one uploaded doc |

If you set a model to `gemini-2.5-pro`, ensure billing / quota allows it—many keys have **zero** free-tier Pro quota; the server **retries once on quota errors** with Flash when the primary model was not already Flash.

Rough cost expectation (order of magnitude): Flash-heavy usage stays low per call; Pro with large PDFs can be **sub‑USD** per run depending on pricing—monitor usage in Google AI Studio.

## Deploy on Vercel

### 1. Required environment variables

Add these in **Vercel Dashboard → Project → Settings → Environment Variables** (Production, Preview, Development):

| Variable | Value | Where to get it |
|---|---|---|
| `GOOGLE_API_KEY` | Your Google Gemini API key | https://aistudio.google.com/apikey |
| `GEMINI_REVIEW_MODEL` | Optional. Default `gemini-2.5-flash`. Set `gemini-2.5-pro` when Pro is enabled. | Google AI model IDs |
| `GEMINI_EXTRACT_MODEL` | Optional. Default `gemini-2.5-flash`. Set `gemini-2.5-pro` when Pro is enabled. | Same |
| `GEMINI_PLAN_MODEL` | Optional. Default `gemini-2.5-flash`. Set to your Studio **Gemini 3 Flash** model id if you want the intake planner on 3.x. | Google AI Studio → Models |
| `BLOB_READ_WRITE_TOKEN` | Auto-populated | Dashboard → **Storage** → Blob → connect to project |

To run **Gemini 3 Flash** for review / extract / plan, set the same model id Google AI Studio lists (ids change between preview and GA), for example: `GEMINI_REVIEW_MODEL=<your-3-flash-id>`, `GEMINI_EXTRACT_MODEL=<your-3-flash-id>`, `GEMINI_PLAN_MODEL=<your-3-flash-id>`.

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
4. Admin opens workbench → **Gemini** reviews everything (multimodal; Flash by default).
5. Admin **confirms** or edits message/processor → merchant / routing updated.
6. Merchant completes processor-specific follow-up → package ready.

## Onboarding Policy Prompt

Defined in `src/lib/aiPolicyWorkflow.ts` as `ONBOARDING_POLICY_PROMPT`. A duplicate constant lives in `api/ai-review.ts` so Vercel esbuild never has to chase `src/` aliases.

Supporting modules:

- Common Intake question bank: `src/lib/intake/commonQuestionBank.ts`
- AI intake plan client: `src/lib/intake/aiPlan.ts`
- KYC / KYB trigger context: `src/lib/intake/personaTriggerRules.ts`
- Processor follow-up lists: `src/lib/onboardingWorkflow.ts`
- AI review context packet: `src/lib/aiReviewContext.ts`
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
