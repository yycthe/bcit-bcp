# BCIT BCP

BCIT **Business Consulting Project** — a **MerchantWerx** onboarding demo for payment processing: intake, documents, AI-assisted risk assessment, and admin review.

## Features

- **Merchant portal** — Application flow, agreements, status, and AI underwriting integration.
- **Admin portal** — Review submitted applications and recommendations in a demo environment.
- **AI underwriting** — Uses the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) via the [AI SDK](https://sdk.vercel.ai/) (`generateObject`). Set `AI_GATEWAY_API_KEY` (or OIDC on Vercel).

## Stack

- React 19 · TypeScript · Vite 6  
- Tailwind CSS 4 · Lucide icons · Sonner toasts  
- `ai` + `zod` for structured outputs through the AI Gateway

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
| `AI_GATEWAY_API_KEY` | **Required for local `npm run dev`** (unless you use `vercel dev` with OIDC). On Vercel you can use this key **or** [OIDC](https://vercel.com/docs/ai-gateway#using-the-ai-gateway-with-a-vercel-oidc-token) without a key. Never exposed in the frontend bundle. |
| `AI_GATEWAY_MODEL` | Optional. Gateway model id, e.g. `openai/gpt-5.4`, `anthropic/claude-sonnet-4.6`. Defaults to `openai/gpt-4o`. |
| `APP_URL` | Optional; base URL when deployed (e.g. Cloud Run). |

Example:

```env
AI_GATEWAY_API_KEY=your_vercel_ai_gateway_key
# AI_GATEWAY_MODEL=openai/gpt-5.4
```

On **Vercel**, add `AI_GATEWAY_API_KEY` under **Project → Settings → Environment Variables** if you are not relying on OIDC alone. Redeploy after changing variables.

Local **`npm run dev`**: set `AI_GATEWAY_API_KEY` in `.env` or `.env.local`; the Vite dev server proxies `POST /api/underwrite` on the server only.

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
