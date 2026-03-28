import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

function resolveXaiApiKey(): string | undefined {
  const direct = process.env.XAI_API_KEY?.trim();
  if (direct) return direct;

  const prefixed = Object.keys(process.env)
    .filter((key) => key.endsWith('_XAI_API_KEY'))
    .sort();

  for (const key of prefixed) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return undefined;
}

const apiKey = resolveXaiApiKey();
if (!apiKey) {
  console.error('Missing XAI_API_KEY or an env var ending in _XAI_API_KEY in .env / .env.local (try: vercel env pull).');
  process.exit(1);
}

const modelId = process.env.XAI_MODEL?.trim() || process.env.AI_MODEL?.trim() || 'grok-4-fast';

const response = await fetch('https://api.x.ai/v1/responses', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: modelId,
    store: false,
    input: 'In one sentence, confirm you are running and name your model.',
  }),
});

const text = await response.text();
if (!response.ok) {
  console.error(`xAI smoke test failed (${response.status}): ${text}`);
  process.exit(1);
}

process.stdout.write(`[${modelId}] ${text}\n`);
