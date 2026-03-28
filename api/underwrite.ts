import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveXaiApiKey, runUnderwriting } from '../server/runUnderwriting';
import type { MerchantData } from '../src/types';

function sendJson(res: ServerResponse, code: number, data: unknown) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parseBody(raw: unknown): { merchantData?: MerchantData } {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as { merchantData?: MerchantData };
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && raw !== null) {
    return raw as { merchantData?: MerchantData };
  }
  return {};
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const withBody = req as IncomingMessage & { body?: unknown };
  if (withBody.body !== undefined && withBody.body !== null) {
    return withBody.body;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const rawBody = await readJsonBody(req);
  const { merchantData } = parseBody(rawBody);
  if (!merchantData || typeof merchantData !== 'object') {
    sendJson(res, 400, { error: 'Missing merchantData in JSON body' });
    return;
  }

  const hasXai = !!resolveXaiApiKey();
  const hasGatewayKey = !!process.env.AI_GATEWAY_API_KEY?.trim();
  const onVercel = process.env.VERCEL === '1';
  // On Vercel, AI Gateway can use OIDC without AI_GATEWAY_API_KEY in env.
  if (!hasXai && !hasGatewayKey && !onVercel) {
    sendJson(res, 500, {
      error:
        'Server is not configured: set XAI_API_KEY or Vercel xAI integration (*_XAI_API_KEY), or AI_GATEWAY_API_KEY (local). On Vercel, OIDC can supply Gateway auth without the key.',
    });
    return;
  }

  try {
    const result = await runUnderwriting(merchantData as MerchantData);
    sendJson(res, 200, result);
  } catch (e) {
    console.error('[v0] Underwriting API error:', e);
    const message = e instanceof Error ? e.message : 'Underwriting failed';
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[v0] Error message:', message);
    console.error('[v0] Error stack:', stack);
    sendJson(res, 500, { error: message, details: stack });
  }
}
