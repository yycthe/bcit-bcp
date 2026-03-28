/**
 * Local check: dotenv + @ai-sdk/xai + ai `streamText` (aligned with Vercel env pull workflow).
 * Docs often use:
 *   import { xai } from "@ai-sdk/xai";
 *   streamText({ model: xai.responses("grok-4-fast"), prompt: "..." })
 * We use createXai + resolveXaiApiKey() so *_XAI_API_KEY from integrations works too.
 *
 *   npm run smoke:xai
 */
import dotenv from 'dotenv';
import { createXai } from '@ai-sdk/xai';
import { streamText } from 'ai';
import { resolveXaiApiKey } from '../server/runUnderwriting';

dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = resolveXaiApiKey();
if (!apiKey) {
  console.error('Missing XAI_API_KEY or an env var ending in _XAI_API_KEY in .env / .env.local (try: vercel env pull).');
  process.exit(1);
}

const modelId =
  process.env.XAI_MODEL?.trim() ||
  process.env.AI_MODEL?.trim() ||
  'grok-4-fast-non-reasoning';

const xaiProvider = createXai({ apiKey });

const result = streamText({
  model: xaiProvider.responses(modelId),
  prompt: 'In one sentence, confirm you are running and name your model.',
});

process.stdout.write(`[${modelId}] `);
for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}
process.stdout.write('\n');
