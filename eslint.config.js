import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'out', 'coverage', '.vercel', 'node_modules']),

  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // Browser app
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat.recommended, jsxA11y.flatConfigs.recommended],
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Secrets and server code must never end up in the browser bundle.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/api', '**/api/**'],
              message: 'Server code (api/) cannot be imported in src/.',
            },
            {
              group: ['@neondatabase/*', 'node:*'],
              message: 'Server-only module in browser code.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'No process.env in browser code.' },
      ],
    },
  },

  // Server, scripts and tooling
  {
    files: [
      'api/**/*.ts',
      'shared/**/*.ts',
      'scripts/**/*.ts',
      'tests/**/*.ts',
      'vite-plugins/**/*.ts',
      '*.config.{ts,js}',
    ],
    languageOptions: { globals: globals.node },
  },

  prettier,
]);
