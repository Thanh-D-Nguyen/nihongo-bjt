import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

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
      "database/**",
      "docs/admin-guide/**/*.cjs",
      "docs/admin-guide/**/*.js",
      "node_modules/**",
      "packages/*/src/*.js",
      "packages/database/generated/**",
      "scripts/fix-*.ts",
      "scripts/generate_admin_purposes.js"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // React hooks rules (exhaustive-deps, etc.) - register plugin in flat config format
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
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
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: {
        module: "readonly"
      }
    }
  },
  {
    files: ["apps/web/public/sw-*.js"],
    languageOptions: {
      globals: {
        clients: "readonly",
        self: "readonly"
      }
    }
  }
];
