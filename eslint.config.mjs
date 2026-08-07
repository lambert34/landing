import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/.next/**', '**/dist/**', '**/node_modules/**', '**/*.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{ts,tsx}'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  prettier,
);
