# BCIT BCP

BCIT **Business Consulting Project** — a **MerchantWerx** onboarding demo for payment processing: intake, documents, AI-assisted risk assessment, and admin review.

## Features

- **Merchant portal** — Application flow, agreements, status, and AI underwriting integration.
- **Admin portal** — Review submitted applications and recommendations in a demo environment.
- **AI underwriting** — [AI SDK](https://sdk.vercel.ai/) `generateObject` with **xAI Grok** (default `grok-3-mini-latest`) when `XAI_API_KEY` or Vercel’s `*_XAI_API_KEY` integration is present; otherwise [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) + `AI_GATEWAY_API_KEY` (or OIDC).

## Stack

- React 19 · TypeScript · Vite 6  
- Tailwind CSS 4 · Lucide icons · Sonner toasts  
- `ai` + `@ai-sdk/xai` + `zod` for structured outputs (xAI or AI Gateway)

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)

## Setup

```bash
npm install
```

## Environment

Create a `.env` or `.env.local` file in the project root (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `XAI_API_KEY` or `*_XAI_API_KEY` | **Preferred:** xAI API key. Vercel **xAI integration** injects a prefixed `*_XAI_API_KEY` automatically. Never exposed in the frontend bundle. |
| `XAI_MODEL` | Optional. xAI model id. Default **`grok-3-mini-latest`**. For harder PDFs, try `grok-2-vision-1212`. |
| `AI_GATEWAY_API_KEY` | **Fallback** when no xAI key: Vercel AI Gateway key (or OIDC on Vercel). |
| `AI_GATEWAY_MODEL` | Optional when using Gateway. Default `google/gemini-2.0-flash`. |
| `AI_MODEL` | Optional override (used by xAI or Gateway depending on which path is active). |
| `APP_URL` | Optional; base URL when deployed (e.g. Cloud Run). |

Example (xAI only):

```env
XAI_API_KEY=xai-...
# XAI_MODEL=grok-3-mini-latest
```

On **Vercel**, use the xAI integration or set `XAI_API_KEY` / `AI_GATEWAY_API_KEY` under **Environment Variables**. Redeploy after changes.

Local **`npm run dev`**: set keys in `.env` or `.env.local`; Vite proxies `POST /api/underwrite` on the server only.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (port **3000**, all interfaces). |
| `npm run build` | Production build to `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Typecheck with `tsc --noEmit`. |

## Run locally

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:3000`).

## Repository

`https://github.com/yycthe/bcit-bcp`

---

*Course / demo project — not production payment software.*
