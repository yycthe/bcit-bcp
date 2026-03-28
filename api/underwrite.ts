import { resolveXaiApiKey, runUnderwriting } from '../server/runUnderwriting';
import type { MerchantData } from '../src/types';

function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function parseBody(raw: unknown): { merchantData?: MerchantData } {
  if (raw == null || typeof raw !== 'object') {
    return {};
  }
  return raw as { merchantData?: MerchantData };
}

async function handleUnderwrite(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json(
      { error: 'Method not allowed' },
      {
        status: 405,
        headers: { Allow: 'POST' },
      }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { merchantData } = parseBody(rawBody);
  if (!merchantData || typeof merchantData !== 'object') {
    return json({ error: 'Missing merchantData in JSON body' }, { status: 400 });
  }

  if (!resolveXaiApiKey()) {
    return json(
      {
        error:
          'Server is not configured: set XAI_API_KEY or an environment variable ending in _XAI_API_KEY (for example a Vercel xAI integration variable).',
      },
      { status: 500 }
    );
  }

  try {
    const result = await runUnderwriting(merchantData as MerchantData);
    return json(result, { status: 200 });
  } catch (error) {
    console.error('[underwrite] API error:', error);
    const message = error instanceof Error ? error.message : 'Underwriting failed';
    const stack = error instanceof Error ? error.stack : undefined;
    const payload: { error: string; details?: string } = { error: message };
    if (process.env.NODE_ENV !== 'production' && stack) {
      payload.details = stack;
    }
    return json(payload, { status: 500 });
  }
}

export default {
  fetch: handleUnderwrite,
};
