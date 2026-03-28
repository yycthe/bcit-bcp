# xAI (Grok) API — format reference for this project

Official docs (authoritative): [docs.x.ai](https://docs.x.ai/docs/api-reference) · [Chat Completions guide](https://docs.x.ai/docs/guides/chat-completions) · [Structured outputs](https://docs.x.ai/docs/guides/structured-outputs) · [Files](https://docs.x.ai/docs/guides/files)

## Common

| Item | Value |
|------|--------|
| Base URL | `https://api.x.ai/v1` |
| Auth | `Authorization: Bearer <XAI_API_KEY>` |
| Content-Type | `application/json` (except file upload) |

Reasoning models: xAI examples use **long HTTP client timeouts** (e.g. 3600s) because generation can take a while.

---

## 1. Chat Completions (legacy but widely used)

**`POST /v1/chat/completions`**

Legacy xAI endpoint shape. This repo no longer uses the AI SDK path at runtime.

### Text-only

```json
{
  "model": "grok-4-1-fast-reasoning",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "What is 101 * 3?"
    }
  ],
  "stream": false
}
```

### `content` as a structured array (text parts)

Same endpoint; `system` / `user` may use an array of parts:

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "Why don't eggs tell jokes?" }
  ]
}
```

### Multimodal — images (per xAI Chat Completions doc)

`user.content` is an array. Image part:

```json
{
  "role": "user",
  "content": [
    {
      "type": "image_url",
      "image_url": {
        "url": "data:image/jpeg;base64,<BASE64>",
        "detail": "high"
      }
    },
    {
      "type": "text",
      "text": "What is in this image?"
    }
  ]
}
```

- `image_url.url` may be a **data URL** or a **public HTTPS** image URL.
- `detail`: `"auto"` | `"low"` | `"high"` (optional; default balances speed vs detail).
- Limits (from xAI image guide): max **20 MiB** per image; types **jpeg/jpg**, **png**.

### Structured outputs (`response_format`)

xAI supports **JSON schema** style structured output on chat completions (see [Structured outputs](https://docs.x.ai/docs/guides/structured-outputs)). This repo now uses the Responses API directly instead of the AI SDK helper flow.

---

## 2. Files + Responses (xAI-documented path for documents / PDF)

For **PDF and other documents**, xAI documents a **Files API** plus **`/v1/responses`** with `input_file` (triggers server-side **`attachment_search`** — agentic document search).

### Step A — upload file

**`POST /v1/files`** — `multipart/form-data`

- Field **`file`**: the file bytes (e.g. PDF).
- Field **`purpose`**: `"assistants"` (per xAI quick example).

Response includes an **`id`** (file id).

### Step B — call Responses API

**`POST /v1/responses`**

```json
{
  "model": "grok-4-1-fast-reasoning",
  "input": [
    {
      "role": "user",
      "content": [
        { "type": "input_text", "text": "Summarize the attached document." },
        { "type": "input_file", "file_id": "<FILE_ID_FROM_STEP_A>" }
      ]
    }
  ]
}
```

Notes from xAI Files guide:

- Max **48 MB** per file; **PDF** is supported among other formats.
- File attachments use **agentic** behavior (document search tooling); not the same wire shape as simple chat text.
- Prefer models that support **agentic** / tool use as described in their docs.

Response shape is **`object: "response"`** with an **`output`** array (not the same as `chat.completion`).

---

## 3. How **this repo** maps to the above

| Concern | What we do |
|--------|------------|
| Endpoint | Direct `fetch` calls from **`api/underwrite.ts`** to xAI **Files** and **Responses** APIs. |
| Structured underwriting JSON | Prompted JSON contract plus server-side normalization in **`api/underwrite.ts`**. |
| Images | Images are sent as `input_image` parts when they fit the serverless budget. |
| PDFs | PDFs are uploaded through xAI **Files** and referenced via `input_file`, but the API now enforces attachment count and size budgets to avoid Vercel timeouts. |
| Large browser uploads on Vercel | The client falls back to **metadata-only** document objects when the request would be too large, and the API can also downgrade oversized attachments to metadata-only. |

Environment variables for keys: `XAI_API_KEY` or any `*_XAI_API_KEY` (see `api/underwrite.ts`).

---

## 4. TypeScript mirrors (code)

The runtime implementation lives in `api/underwrite.ts`.
