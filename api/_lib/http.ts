import type { ApiErrorCode } from '../../shared/schemas.js';

type Method = 'GET' | 'POST';
type Handler = (request: Request) => Promise<Response>;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    readonly headers: Record<string, string> = {},
  ) {
    super(code);
  }
}

const BASE_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
} as const;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...BASE_HEADERS, ...headers },
  });
}

export function withBaseHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(BASE_HEADERS)) {
    if (!response.headers.has(key)) response.headers.set(key, value);
  }
  return response;
}

/**
 * Wraps per-method handlers into a Vercel Web-standard function
 * (`export default route({...})`). Unknown methods get 405, HttpError becomes
 * a generic JSON error, anything else is logged server-side and returns 500.
 */
export function route(handlers: Partial<Record<Method, Handler>>): {
  fetch: (request: Request) => Promise<Response>;
} {
  const allow = Object.keys(handlers).join(', ');
  return {
    async fetch(request) {
      const handler = handlers[request.method as Method];
      if (!handler) return json({ error: 'method_not_allowed' }, 405, { allow });
      try {
        return withBaseHeaders(await handler(request));
      } catch (error) {
        if (error instanceof HttpError) {
          return json({ error: error.code }, error.status, error.headers);
        }
        console.error(`[api] ${request.method} ${new URL(request.url).pathname} failed`, error);
        return json({ error: 'server_error' }, 500);
      }
    },
  };
}

const MAX_JSON_BODY_BYTES = 16 * 1024;

/** Same-origin JSON body: rejects cross-site requests, wrong content type and oversized bodies. */
export async function readJsonBody(request: Request): Promise<unknown> {
  assertSameOrigin(request);

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'unsupported_media_type');
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_JSON_BODY_BYTES) throw new HttpError(413, 'payload_too_large');

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, 'payload_too_large');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, 'invalid_request');
  }
}

/**
 * Browsers send Sec-Fetch-Site and Origin on POST. Anything that is not our own
 * page is refused. (Non-browser clients send neither and are still rate limited.)
 */
export function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new HttpError(403, 'forbidden');
  }
  const origin = request.headers.get('origin');
  if (origin) {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      // "null" or malformed origin
    }
    if (!host || originHost !== host) throw new HttpError(403, 'forbidden');
  }
}
