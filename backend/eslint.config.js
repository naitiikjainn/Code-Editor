import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        // Allow browser globals for Puppeteer scripts
        document: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-undef": "error",
      "no-useless-escape": "warn",
    },
  },
  {
    // Specific overrides for script files that use Puppeteer heavily
    files: ["scripts/**/*.js", "scripts/**/*.cjs", "test_search.cjs"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-undef": "off", // Relax no-undef for these scripts as they have mixed contexts
    },
  },
  {
    // Jest tests
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  prettier,
];
