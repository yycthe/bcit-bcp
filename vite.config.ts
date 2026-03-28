import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Connect, Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { runUnderwriting } from './server/runUnderwriting';

function underwritingDevApi(gatewayKey: string | undefined): Plugin {
  return {
    name: 'underwriting-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? '';
        if (pathname !== '/api/underwrite') {
          next();
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        if (!gatewayKey?.trim()) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error:
                'Set AI_GATEWAY_API_KEY in .env or .env.local (not exposed to the browser). On Vercel, add it under Environment Variables or rely on OIDC.',
            })
          );
          return;
        }
        const chunks: Buffer[] = [];
        try {
          for await (const chunk of req as NodeJS.ReadableStream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Could not read request body' }));
          return;
        }
        let body: { merchantData?: unknown };
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { merchantData?: unknown };
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }
        if (!body.merchantData || typeof body.merchantData !== 'object') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing merchantData in JSON body' }));
          return;
        }
        try {
          const result = await runUnderwriting(
            gatewayKey.trim(),
            body.merchantData as import('./src/types').MerchantData
          );
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Underwriting failed';
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), underwritingDevApi(env.AI_GATEWAY_API_KEY)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
