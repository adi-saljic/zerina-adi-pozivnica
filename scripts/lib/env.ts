import { existsSync } from 'node:fs';

/** Loads .env from the project root (existing environment variables win). */
export function loadDotEnv(): void {
  if (existsSync('.env')) process.loadEnvFile('.env');
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`✖ ${name} nije postavljen. Dodaj ga u .env (vidi .env.example).`);
    process.exit(1);
  }
  return value;
}

export function publicBaseUrl(): string {
  return requireEnv('PUBLIC_BASE_URL').replace(/\/+$/, '');
}
