import obsidianmd from './node_modules/eslint-plugin-obsidianmd/dist/lib/index.js';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    plugins: { obsidianmd },
    languageOptions: {
      parser: tsparser,
    },
    rules: {
      'obsidianmd/ui/sentence-case': ['error', { allowAutoFix: true }],
      'obsidianmd/hardcoded-config-path': 'error',
    },
    files: ['**/*.ts'],
  }
];
