# BCIT BCP

BCIT **Business Consulting Project** — a hybrid AI + rule-based payment-processing onboarding platform for merchant intake, KYC / KYB readiness, document review, processor routing, and package approval.

## Features

- **Merchant Portal** — guided Common Intake, PDF / image upload to Vercel Blob, application review, status tracking, dynamic processor-specific follow-up, and agreement flow.
- **Admin Portal** — review submitted applications, run deterministic rule engine **and** AI review (Gemini), record KYC / KYB results, confirm processor routing, and approve the final package.
- **AI review layer** — Gemini 2.5 Flash cross-checks the rule-engine output, surfaces red flags + strengths, and drafts a merchant-facing message. Rule engine remains the deterministic audit layer.
- **Dynamic KYC / KYB forms** — once a processor is matched, only that processor's follow-up questions are rendered (Nuvei, Payroc / Peoples, or Chase), with conditional fields based on prior answers.
- **Multi-PDF blob upload** — PDFs upload directly to Vercel Blob via a signed client-upload token, bypassing function payload limits (up to 25 MB per file).
- **Processor-ready package** — common answers, KYC / KYB status, routing result, processor-specific answers, document checklist, missing items, and readiness status.

## Deploy on Vercel

### 1. Required environment variables

Add these in **Vercel Dashboard → your project → Settings → Environment Variables** (apply to Production, Preview, and Development):

| Variable | Value | Where to get it |
|---|---|---|
| `GOOGLE_API_KEY` | Your Google Gemini API key | https://aistudio.google.com/apikey |
| `BLOB_READ_WRITE_TOKEN` | Auto-populated | Vercel Dashboard → **Storage** tab → create a Blob store → connect it to this project; Vercel will inject `BLOB_READ_WRITE_TOKEN` automatically |

After saving env vars, redeploy (Vercel → Deployments → pick latest → **Redeploy**) so the server functions pick them up.

### 2. Steps

1. Push to GitHub.
2. Import the repo in Vercel.
3. Framework preset: **Vite** (auto-detected).
4. Add `GOOGLE_API_KEY` in Settings → Environment Variables.
5. Storage → **Create → Blob** → connect to project (auto-sets `BLOB_READ_WRITE_TOKEN`).
6. Redeploy.

### 3. Local dev (optional)

Create a `.env.local` at the repo root:

```
GOOGLE_API_KEY=your_gemini_key
BLOB_READ_WRITE_TOKEN=your_blob_token
```

Then:
```
npm install
npm run dev
```

Serverless functions in `api/` will run via Vercel CLI (`vercel dev`) if you want full parity; `npm run dev` alone runs the Vite frontend only.

## Stack

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4
- Lucide icons
- Sonner toasts
- Vercel static deployment

## Workflow

1. Merchant completes Common Intake only.
2. Rules decide whether KYB, KYC, both, or KYB-first should be requested.
3. Admin records KYC / KYB verification results and runs the local rules check.
4. Rule-based review scores readiness, risk drivers, document gaps, website/compliance signals, and processor fit.
5. Admin confirms processor routing.
6. Merchant completes only the matched processor-specific follow-up questions.
7. Admin approves the processor-ready package.

## Rule-Based Master Prompt

The in-app source of truth lives in `src/lib/ruleBasedWorkflow.ts`. It assembles the master prompt from:

- Common Intake question bank: `src/lib/intake/commonQuestionBank.ts`
- KYC / KYB trigger rules: `src/lib/intake/personaTriggerRules.ts`
- Processor follow-up master lists: `src/lib/onboardingWorkflow.ts`
- Review scoring and routing rules: `src/lib/underwritingFallback.ts`

Admin Portal also exposes this prompt in the queue view so the demo can show exactly how the flow is governed.

## Setup

```bash
npm install
npm run dev
```

Open the URL shown in the terminal, usually `http://localhost:3000`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port `3000`. |
| `npm run build` | Production build to `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Typecheck with `tsc --noEmit`. |

## Deploy On Vercel

The app is a static Vite build. No secret API keys are required for the rule-based version.

1. Push to GitHub.
2. Import the repo in Vercel.
3. Keep the default build command `npm run build`.
4. Keep the output directory `dist`.
5. Deploy.

## Repository

`https://github.com/yycthe/bcit-bcp`

---

Course / demo project. Not production payment software.
