# BCIT BCP

BCIT **Business Consulting Project** — a **BCIT BCP** onboarding demo for payment processing: intake, documents, AI-assisted risk assessment, and admin review.

## Features

- **Merchant portal** — Application flow, agreements, status, and AI underwriting integration.
- **Admin portal** — Review submitted applications and run a local KYC / KYB review with no external identity API.
- **AI underwriting** — direct **xAI REST API** on Vercel (`XAI_API_KEY` or Vercel’s `*_XAI_API_KEY`; default **`grok-4-1-fast-non-reasoning`**, override with `XAI_MODEL`).

## Stack

- React 19 · TypeScript · Vite 6  
- Tailwind CSS 4 · Lucide icons · Sonner toasts  
- xAI REST via `api/underwrite.ts`  
- **[xAI REST / message format reference](docs/xai-api.md)** (Chat Completions, Files + Responses, structured outputs)  
- **[Codex / AI agent handoff: architecture + Vercel + xAI](docs/CODEX_HANDOFF_VERCEL_XAI.md)** — copy to another tool to harden “deploy and run”

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)

## Setup

```bash
npm install
```

This project calls xAI directly from the server-side API route. Secrets stay server-only.

## Deploy on Vercel (GitHub → auto deploy)

1. Push this repo to GitHub and [import the project](https://vercel.com/new) in Vercel (or connect an existing project).
2. In the Vercel dashboard, add **Environment Variables** for **Production** (and Preview if you want):  
   **`XAI_API_KEY`** and/or the integration variable ending in **`_XAI_API_KEY`**.  
   Optional: **`XAI_MODEL`** (defaults to **`grok-4-1-fast-non-reasoning`**).
3. Redeploy so the serverless **`/api/underwrite`** route picks up secrets.  
   `vercel.json` sets **`outputDirectory`: `dist`**, SPA rewrites, and a per-function **`maxDuration`** for underwriting.

### Local: link project and pull env (optional)

```bash
npm i -g vercel   # if needed
vercel link
vercel env pull   # writes .env.local (gitignored)
npm install
npm run dev       # or: npm run smoke:xai
```

After `vercel env pull`, `.env.local` can be used for the smoke test and local dev middleware. The project accepts both `XAI_API_KEY` and prefixed `*_XAI_API_KEY`.

## Environment

See `.env.example`. Summary:

| Variable | Description |
|----------|-------------|
| `XAI_API_KEY` or `*_XAI_API_KEY` | **Required** for underwriting. Never use **`VITE_*`** for secrets (that exposes them in the browser). |
| `XAI_MODEL` | Optional. Default **`grok-4-1-fast-non-reasoning`**. Good Grok 4 family alternatives include `grok-4-fast-reasoning` and `grok-4-1-fast-reasoning`. |
| `AI_MODEL` | Optional fallback if `XAI_MODEL` is unset. |
| `APP_URL` | Optional; base URL when deployed. |
| `UNDERWRITE_ALLOWED_ORIGINS` | Optional comma-separated allowlist for browser origins that may call `/api/underwrite`. |

**PDFs:** Underwriting now uses xAI's official file upload + Responses path for document-backed analysis. Uploaded images are still sent as multimodal image inputs.

**Vercel request-size guard:** Vercel Functions have a **4.5 MB** request/response body limit. The client now automatically falls back to sending **document metadata only** if the underwriting payload would be too large, so the AI flow still runs instead of failing with `413 FUNCTION_PAYLOAD_TOO_LARGE`. In that fallback mode, document contents are not available to the model.

Example:

```env
XAI_API_KEY=xai-...
# XAI_MODEL=grok-4-1-fast-non-reasoning
```

Local **`npm run dev`**: underwriting calls **`POST /api/underwrite`** (Vite dev middleware). Production: same path on Vercel via **`api/underwrite.ts`**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (port **3000**, all interfaces). |
| `npm run build` | Production build to `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Typecheck with `tsc --noEmit`. |
| `npm run smoke:xai` | Quick xAI Responses API check (needs `.env.local` or env vars). |

## Deployment checklist

1. Set **`XAI_API_KEY`** or a Vercel integration variable ending in **`_XAI_API_KEY`** for the environment you deploy.
2. Keep secrets server-only. Do not use **`VITE_XAI_API_KEY`** or any other `VITE_*` secret.
3. Redeploy after changing env vars.
4. If underwriting requests include large PDFs/images, expect the app to fall back to metadata-only mode unless you move uploads to storage first.
5. If you want to tune speed vs reasoning, set **`XAI_MODEL`** explicitly. xAI currently documents Grok 4 family structured-output and file support, including models such as **`grok-4-1-fast-non-reasoning`** and **`grok-4-fast-reasoning`**.
6. `/api/underwrite` blocks cross-site browser requests. Set **`APP_URL`** and, if needed, **`UNDERWRITE_ALLOWED_ORIGINS`** to match your live domains.

## Run locally

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:3000`).

## Repository

`https://github.com/yycthe/bcit-bcp`

---

*Course / demo project — not production payment software.*
