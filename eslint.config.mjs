import nextConfig from "eslint-config-next";
import tseslint from "typescript-eslint";

/**
 * Flat ESLint config for Next.js 16 + ESLint 10.
 *
 * eslint-config-next 16 ships a flat config (default export is an array).
 * We add our project-specific overrides on top, scoped to the right files.
 */
const config = [
  ...nextConfig,

  // TypeScript-specific overrides (require @typescript-eslint plugin).
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Project-wide overrides (no plugin needed).
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },

  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "supabase/.branches/**",
      "supabase/.temp/**",
      "src/db/migrations/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
