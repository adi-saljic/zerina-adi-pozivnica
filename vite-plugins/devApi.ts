// `npm run dev`: serves the Vercel functions in api/ from the Vite dev server,
// so local development needs no Vercel account. It mirrors Vercel's routing:
// /api/<path> -> api/<path>.ts, files/folders starting with "_" are private,
// and /api/admin/export.csv is rewritten to /api/admin/export (see vercel.json).
//
// Not used by `vercel dev` (VERCEL=1) or by Vitest, and never part of a build.

import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';

const REWRITES: Record<string, string> = { '/api/admin/export.csv': '/api/admin/export' };

interface WebHandler {
  fetch: (request: Request) => Promise<Response>;
}

function toWebRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `http://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  headers.set('x-forwarded-for', req.socket.remoteAddress ?? '127.0.0.1');

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : undefined,
    // Required by Node's fetch for streaming request bodies.
    duplex: 'half',
  } as RequestInit);
}

async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function devApi(): Plugin {
  return {
    name: 'pozivnica:dev-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      if (process.env.VERCEL === '1' || process.env.VITEST) return;

      // Server-side env for the handlers (DATABASE_URL, ADMIN_TOKEN, ...).
      // This only touches the dev server's Node process, never the browser bundle.
      const env = loadEnv(server.config.mode, server.config.root, '');
      for (const [key, value] of Object.entries(env)) process.env[key] ??= value;

      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        if (!pathname.startsWith('/api/')) return next();

        const path = REWRITES[pathname] ?? pathname;
        const segments = path.split('/').filter(Boolean);
        const valid = /^\/api(\/[a-zA-Z0-9-]+)+$/.test(path);
        if (!valid || segments.some((s) => s.startsWith('_'))) {
          return sendJson(res, 404, { error: 'not_found' });
        }
        const file = resolve(server.config.root, `.${path}.ts`);
        if (!existsSync(file)) return sendJson(res, 404, { error: 'not_found' });

        void (async () => {
          try {
            const mod = (await server.ssrLoadModule(file)) as { default?: WebHandler };
            if (!mod.default?.fetch) throw new Error(`${path}.ts has no default { fetch } export`);
            await sendWebResponse(res, await mod.default.fetch(toWebRequest(req)));
          } catch (error) {
            if (error instanceof Error) server.ssrFixStacktrace(error);
            console.error('[dev-api]', error);
            if (!res.headersSent) sendJson(res, 500, { error: 'server_error' });
          }
        })();
      });
    },
  };
}
