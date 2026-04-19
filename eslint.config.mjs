// @ts-check
import tseslint from "typescript-eslint";

/**
 * NOTE: eslint-plugin-obsidianmd (github:obsidianmd/eslint-plugin) installs
 * without its compiled dist, so we cannot use it directly. The Obsidian
 * submission bot runs it on their end — run `npm run lint` here to catch the
 * TypeScript / floating-promise / no-any issues before pushing.
 *
 * Obsidian-specific rules to fix manually (not covered here):
 *   - obsidianmd/no-config-dir       → use app.vault.configDir, not '.obsidian'
 *   - obsidianmd/no-leaf-detach      → don't call leaf.detach() in onunload
 *   - obsidianmd/sentence-case       → UI strings: sentence case only
 *   - obsidianmd/prefer-css-classes  → no element.style.display/.visibility
 *   - obsidianmd/prefer-setting-heading → use new Setting().setHeading()
 *   - obsidianmd/no-confirm          → no window.confirm(), use Modal
 *   - obsidianmd/no-command-id-prefix → don't prefix command IDs with plugin id
 */
export default tseslint.config(
  {
    ignores: ["node_modules/**", "docs/**", "*.mjs", "*.config.*", "**/*.js"],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // === Errors (required by Obsidian submission) ===
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-require-imports": "error",

      // === Warnings (nice to have) ===
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // === Off — patterns we use intentionally ===
      // We use void operator for fire-and-forget event handlers; this is
      // expected in Obsidian plugin patterns.
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
);
