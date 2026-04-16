# BCIT BCP

BCIT **Business Consulting Project** — a rule-based payment-processing onboarding demo for merchant intake, KYC / KYB readiness, document review, processor routing, and package approval.

## Features

- **Merchant Portal** — guided Common Intake, document upload, application review, status tracking, processor-specific follow-up, and agreement flow.
- **Admin Portal** — review submitted applications, record KYC / KYB results, run deterministic rules checks, confirm processor routing, and approve the final package.
- **Rule-based workflow** — no AI model call and no external identity API dependency in this demo.
- **Processor routing** — rules recommend **Nuvei**, **Payroc / Peoples**, or **Chase** from intake answers, verification status, website/compliance signals, and document readiness.
- **Processor-ready package** — common answers, KYC / KYB status, routing result, processor-specific answers, document checklist, missing items, and readiness status.

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
