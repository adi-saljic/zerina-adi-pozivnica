import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { devApi } from './vite-plugins/devApi.js';
import { ogMeta } from './vite-plugins/ogMeta.js';

// Dev only. React's fast-refresh preamble is an inline script, so dev needs
// 'unsafe-inline'; production uses the strict CSP from vercel.json. Under
// `vercel dev` this header replaces the one from vercel.json.
const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' ws: wss:",
  'frame-src https://www.google.com',
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');

export default defineConfig({
  plugins: [react(), ogMeta(), devApi()],
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      'Content-Security-Policy': DEV_CSP,
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  },
  build: {
    // No data: URIs in the bundle, so the production CSP can stay strict.
    assetsInlineLimit: 0,
  },
});
