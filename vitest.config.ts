import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so tests never load the dev API plugin or .env secrets.
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', '.vercel/**'],
    environment: 'node',
    // Tests must not depend on a real database or real secrets.
    env: { DATABASE_URL: '', ADMIN_TOKEN: '', RSVP_DEADLINE: '', RATE_LIMIT_SECRET: '' },
  },
});
