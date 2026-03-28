# BCIT BCP

BCIT **Business Consulting Project** — a **MerchantWerx** onboarding demo for payment processing: intake, documents, AI-assisted risk assessment, and admin review.

## Features

- **Merchant portal** — Application flow, agreements, status, and AI underwriting integration.
- **Admin portal** — Review submitted applications and recommendations in a demo environment.
- **Gemini** — Uses Google’s Gemini API for AI-powered underwriting features (requires an API key).

## Stack

- React 19 · TypeScript · Vite 6  
- Tailwind CSS 4 · Lucide icons · Sonner toasts  
- `@google/genai` for Gemini

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
| `GEMINI_API_KEY` | **Required** for AI underwriting. Stored server-side only (`api/underwrite` on Vercel, or Vite dev middleware locally). **Not** exposed in the frontend bundle. |
| `APP_URL` | Optional; base URL when deployed (e.g. Cloud Run). |

Example:

```env
GEMINI_API_KEY=your_key_here
```

On **Vercel**, add the same variable under **Project → Settings → Environment Variables** (Production / Preview). Redeploy after changing it.

Local **`npm run dev`**: put the key in `.env` or `.env.local`; the dev server handles `POST /api/underwrite` without exposing the key to the browser.

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
