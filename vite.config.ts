import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { POST as underwritePost } from './api/underwrite';

function underwritingDevApi(): Plugin {
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
          const origin = `http://${req.headers.host ?? 'localhost:3000'}`;
          const request = new Request(new URL('/api/underwrite', origin), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          const response = await underwritePost(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
          res.end(await response.text());
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
  // Populate process.env for resolveXaiApiKey in the dev middleware (loadEnv does not set process.env by default).
  for (const key of ['XAI_API_KEY', 'AI_MODEL', 'XAI_MODEL'] as const) {
    if (env[key] !== undefined && env[key] !== '') {
      process.env[key] = env[key];
    }
  }
  for (const k of Object.keys(env)) {
    if (k.endsWith('_XAI_API_KEY') && env[k]) {
      process.env[k] = env[k];
    }
  }
  return {
    plugins: [react(), tailwindcss(), underwritingDevApi()],
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
