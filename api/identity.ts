export const runtime = 'nodejs';

import type { MerchantData } from '../src/types';
import {
  evaluateMockIdentityBundle,
  fieldToRemediation,
  remediationsForProvider,
  type IdentityDemoScenario,
  type MockRemediationItem,
} from '../src/lib/mockIdentityVerification';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Service = 'suite' | 'kyc' | 'kyb' | 'persona' | 'persona_webhook';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Demo-only simulated HTTP integration points:
 * - KYC vendor (owner / ID signals)
 * - KYB vendor (business registry / docs)
 * - Persona-style inquiry completion + webhook-shaped payload
 *
 * POST JSON: { merchantData: MerchantData, scenario?: IdentityDemoScenario, service?: Service }
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      merchantData?: unknown;
      scenario?: IdentityDemoScenario;
      service?: Service;
    };

    if (!isPlainObject(body) || !isPlainObject(body.merchantData)) {
      return jsonResponse({ error: 'Request body must include a merchantData object.' }, 400);
    }

    const scenario: IdentityDemoScenario = body.scenario ?? 'default';
    const service: Service = body.service ?? 'suite';
    const merchantData = body.merchantData as MerchantData;
    const bundle = evaluateMockIdentityBundle(merchantData, scenario);

    if (service === 'kyc') {
      return jsonResponse(
        {
          meta: { simulated: true, interface: 'kyc_vendor', path: '/api/identity', service: 'kyc' },
          payload: bundle.kyc,
          remediations: remediationsForProvider(bundle, 'kyc_vendor'),
        },
        200
      );
    }

    if (service === 'kyb') {
      return jsonResponse(
        {
          meta: { simulated: true, interface: 'kyb_vendor', path: '/api/identity', service: 'kyb' },
          payload: bundle.kyb,
          remediations: remediationsForProvider(bundle, 'kyb_vendor'),
        },
        200
      );
    }

    if (service === 'persona') {
      const fromFields = bundle.persona.fieldsFailed
        .map((f) => fieldToRemediation(f.field, f.reason, 'persona'))
        .filter((x): x is MockRemediationItem => x != null);
      const remediations =
        fromFields.length > 0 ? fromFields : remediationsForProvider(bundle, 'persona');
      return jsonResponse(
        {
          meta: { simulated: true, interface: 'persona_inquiry', path: '/api/identity', service: 'persona' },
          payload: bundle.persona,
          remediations,
        },
        200
      );
    }

    if (service === 'persona_webhook') {
      return jsonResponse(
        {
          meta: {
            simulated: true,
            interface: 'persona_webhook',
            path: '/api/identity',
            service: 'persona_webhook',
            note: 'Shape-only simulation of inquiry.completed / inquiry.failed delivery.',
          },
          event: bundle.persona.webhookEvent,
          inquiry_id: bundle.persona.inquiryId,
          status: bundle.persona.status,
          decision: bundle.persona.decision,
          fields_failed: bundle.persona.fieldsFailed,
          remediations: bundle.remediations,
        },
        200
      );
    }

    return jsonResponse(
      {
        meta: { simulated: true, interface: 'suite', path: '/api/identity', service: 'suite' },
        kyc: bundle.kyc,
        kyb: bundle.kyb,
        persona: bundle.persona,
        remediations: bundle.remediations,
      },
      200
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Identity demo failed';
    console.error('[identity demo]', message);
    return jsonResponse({ error: message }, 500);
  }
}

export default {
  async fetch(request: Request) {
    return POST(request);
  },
};
