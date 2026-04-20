import { GoogleGenAI, Type } from '@google/genai';
import { GEMINI_MODEL_FLASH, isGeminiQuotaError, resolveExtractModel } from '../geminiModel';

export const config = { runtime: 'nodejs', maxDuration: 60 };

const MAX_BYTES = 6 * 1024 * 1024;
const SUPPORTED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    extracted: {
      type: Type.OBJECT,
      description: 'String field values only; use keys from the allowed list for this slot.',
    },
    confidence: { type: Type.NUMBER },
    notes: { type: Type.STRING },
  },
  required: ['extracted', 'confidence', 'notes'],
};

function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

type ExtractUserPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

async function runSlotExtract(
  ai: GoogleGenAI,
  model: string,
  parts: ExtractUserPart[]
): Promise<{ extracted?: Record<string, unknown>; confidence?: number; notes?: string }> {
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1,
    },
  });
  const text = response.text;
  if (!text) {
    throw new Error('Empty response from Gemini');
  }
  try {
    return JSON.parse(text) as { extracted?: Record<string, unknown>; confidence?: number; notes?: string };
  } catch {
    throw new Error('Invalid JSON from model');
  }
}

function allowedKeysForSlot(slot: string): Set<string> {
  if (slot === 'idUpload') {
    return new Set(['ownerName', 'ownerIdNumber']);
  }
  if (slot === 'registrationCertificate') {
    return new Set(['legalName', 'taxId', 'establishedDate', 'registeredAddress']);
  }
  if (slot === 'bankStatement') {
    return new Set(['bankName', 'accountNumber', 'routingNumber', 'ownerName', 'settlementCurrency']);
  }
  if (slot === 'proofOfAddress') {
    return new Set(['registeredAddress', 'operatingAddress']);
  }
  return new Set();
}

function sanitizeExtracted(
  slot: string,
  raw: Record<string, unknown>
): Record<string, string> {
  const allow = allowedKeysForSlot(slot);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!allow.has(k)) continue;
    if (typeof v !== 'string') continue;
    let s = v.trim();
    if (k.toLowerCase().includes('account') && s.replace(/\D/g, '').length > 4) {
      const digits = s.replace(/\D/g, '');
      s = `***${digits.slice(-4)}`;
    }
    if (s) out[k] = s;
  }
  return out;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 500, { error: 'GOOGLE_API_KEY not configured on the server.' });
  }

  let body: {
    blobUrl?: string;
    mimeType?: string;
    slot?: string;
    knownContext?: Record<string, unknown>;
  };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  const blobUrl = body.blobUrl || '';
  const mimeType = (body.mimeType || 'application/pdf').toLowerCase();
  const slot = body.slot || '';
  if (!blobUrl.startsWith('http')) {
    return json(res, 400, { error: 'blobUrl required (HTTPS Blob URL)' });
  }
  if (!allowedKeysForSlot(slot).size) {
    return json(res, 400, { error: 'Unsupported slot for extraction' });
  }
  if (!SUPPORTED.has(mimeType)) {
    return json(res, 400, { error: `Unsupported mime ${mimeType}` });
  }

  try {
    const resp = await fetch(blobUrl);
    if (!resp.ok) {
      return json(res, 502, { error: `Fetch document failed ${resp.status}` });
    }
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return json(res, 413, { error: 'Document exceeds extraction size cap' });
    }
    const b64 = Buffer.from(buf).toString('base64');

    const sys = `You extract structured onboarding fields from an uploaded merchant document image or PDF page.
Slot: ${slot}.
Only output keys from this allowed list: ${[...allowedKeysForSlot(slot)].join(', ')}.
Use ISO-like dates where applicable. Never invent values — omit a key if unreadable.
If you see full bank account numbers, mask to last 4 digits in extracted.accountNumber.
Known merchant context (may be empty): ${JSON.stringify(body.knownContext ?? {})}`;

    const parts: ExtractUserPart[] = [
      { text: `${sys}\n\nFilename context: extraction for slot "${slot}".` },
      { inlineData: { mimeType, data: b64 } },
      { text: 'Return JSON per schema with extracted fields.' },
    ];
    const primaryModel = resolveExtractModel();
    const ai = new GoogleGenAI({ apiKey });
    let parsed: { extracted?: Record<string, unknown>; confidence?: number; notes?: string };
    try {
      parsed = await runSlotExtract(ai, primaryModel, parts);
    } catch (firstErr) {
      if (primaryModel !== GEMINI_MODEL_FLASH && isGeminiQuotaError(firstErr)) {
        parsed = await runSlotExtract(ai, GEMINI_MODEL_FLASH, parts);
      } else {
        throw firstErr;
      }
    }

    const extracted = sanitizeExtracted(slot, parsed.extracted || {});
    return json(res, 200, {
      extracted,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json(res, 502, { error: message });
  }
}
