import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';

export default ts.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/.turbo/**',
      'apps/mobile/ios/**',
      'apps/mobile/android/**',
      '**/expo-env.d.ts',
      '.public-snapshot/**',
      'roundups-landing/**',
      'roundups-ops-bot/**',
      'apps/mobile/build/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    files: [
      'packages/backend/src/**/*.ts',
      'packages/integrations/src/**/*.ts',
      'apps/api/src/**/*.ts',
      'apps/worker/src/**/*.ts',
    ],
    rules: { complexity: ['error', { max: 12, variant: 'classic' }] },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': hooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
);
