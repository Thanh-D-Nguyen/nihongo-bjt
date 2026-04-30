import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      ".turbo/**",
      "apps/*/.next/**",
      "apps/*/dist/**",
      "apps/web/public/sw.js",
      "archive/**",
      "blob-report/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "data/generated/**",
      "node_modules/**",
      "packages/*/src/*.js",
      "packages/database/generated/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ]
    }
  },
  // Test files: relax no-explicit-any (as any casts are normal in mocks/fixtures)
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  // Node.js scripts: add node globals
  {
    files: ["scripts/**/*.mjs", "apps/*/scripts/**/*.mjs", "apps/*/scripts/**/*.ts"],
    languageOptions: {
      globals: {
        AbortSignal: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly"
      }
    }
  }
];
