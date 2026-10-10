// Fills the __OG_*__ placeholders in index.html at build/dev time, so the
// og: tags stay static HTML (crawlers don't run JS) but are never out of sync
// with shared/event.ts and src/i18n/bs.ts.
//
// Only PUBLIC_BASE_URL is read from the environment; no secret is touched.

import { loadEnv, type Plugin } from 'vite';
import { bs } from '../src/i18n/bs.js';
import { event } from '../shared/event.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function resolveBaseUrl(env: Record<string, string | undefined>): string | null {
  const configured = env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;
  return null;
}

export function ogMeta(): Plugin {
  let baseUrl = 'http://localhost:5173';

  return {
    name: 'pozivnica:og-meta',
    configResolved(config) {
      const fileEnv = loadEnv(config.mode, config.root, '');
      const resolved = resolveBaseUrl({
        PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? fileEnv.PUBLIC_BASE_URL,
        VERCEL_PROJECT_PRODUCTION_URL:
          process.env.VERCEL_PROJECT_PRODUCTION_URL ?? fileEnv.VERCEL_PROJECT_PRODUCTION_URL,
      });
      if (resolved) {
        new URL(resolved); // throws on a malformed value
        baseUrl = resolved;
      } else if (config.command === 'build') {
        throw new Error(
          'PUBLIC_BASE_URL is not set. og:url / og:image must be absolute URLs, ' +
            'so the build needs it (e.g. PUBLIC_BASE_URL=https://pozivnica.example.com).',
        );
      }
      if (config.command === 'build' && !baseUrl.startsWith('https://')) {
        config.logger.warn(
          `[og-meta] PUBLIC_BASE_URL is ${baseUrl}; link previews need https in production.`,
        );
      }
    },
    transformIndexHtml(html) {
      const values: Record<string, string> = {
        __OG_BASE_URL__: baseUrl,
        __OG_TITLE__: bs.og.title,
        __OG_DESCRIPTION__: bs.og.description,
        __OG_IMAGE_ALT__: bs.og.imageAlt,
        __OG_SITE_NAME__: event.coupleNames,
      };
      let out = html;
      for (const [placeholder, value] of Object.entries(values)) {
        out = out.replaceAll(placeholder, escapeHtml(value));
      }
      const leftover = /__OG_[A-Z_]+__/.exec(out);
      if (leftover) throw new Error(`[og-meta] unknown placeholder ${leftover[0]} in index.html`);
      return out;
    },
  };
}
