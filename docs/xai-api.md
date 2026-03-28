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

Used by **Vercel AI SDK** `generateObject` / `generateText` with `@ai-sdk/xai` → OpenAI-compatible chat.

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

xAI supports **JSON schema** style structured output on chat completions (see [Structured outputs](https://docs.x.ai/docs/guides/structured-outputs)). The AI SDK’s **`generateObject` + Zod** builds the appropriate `response_format` / tool-use flow for you.

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
| Endpoint | **Responses API via AI SDK provider** (`createXai({ apiKey }).responses(modelId)`) for underwriting generation. |
| Structured underwriting JSON | Zod schema → SDK structured object output (aligned with xAI structured outputs). |
| Images | SDK **`image`** parts on the Responses path; if multimodal fails, the server retries without images. |
| PDFs | Default: **text extracted locally** (`unpdf`) and appended to the prompt. This intentionally avoids relying on raw PDF chat/file parts. If you need strict xAI document-search behavior, implement the official **Files + `input_file` + `/v1/responses`** flow from section 2. |
| Large browser uploads on Vercel | Because Vercel Functions enforce a **4.5 MB** request-body limit, the client automatically falls back to **metadata-only** document objects when the JSON payload would be too large. The prompt still includes an uploaded-document inventory so the model knows which files were supplied, but file contents are unavailable in that mode. |

Environment variables for keys: `XAI_API_KEY` or any `*_XAI_API_KEY` (see `server/runUnderwriting.ts`).

---

## 4. TypeScript mirrors (code)

See `server/xaiApiReference.ts` for **non-runtime** type shapes that mirror the JSON above (for editors and refactors).
