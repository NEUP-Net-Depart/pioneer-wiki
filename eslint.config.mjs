import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintComments from "eslint-plugin-eslint-comments";
import jsdoc from "eslint-plugin-jsdoc";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "eslint-comments": eslintComments,
      jsdoc,
    },
    linterOptions: {
      // An unused suppression usually means the code or rule changed; keep it visible in CI.
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      // Keep line and block comments readable without prescribing their language or content.
      "spaced-comment": ["error", "always", { markers: ["/", "!"] }],

      // Suppressions are part of the review surface: name the rule, explain the exception,
      // and never leave a broad or duplicate directive behind.
      "eslint-comments/no-aggregating-enable": "error",
      "eslint-comments/no-duplicate-disable": "error",
      "eslint-comments/no-unlimited-disable": "error",
      "eslint-comments/no-unused-disable": "error",
      "eslint-comments/require-description": ["error", { ignore: ["eslint-enable"] }],

      // Validate the JSDoc that the codebase already uses, without requiring documentation
      // for every function or forcing a particular prose language.
      "jsdoc/check-alignment": "error",
      "jsdoc/check-tag-names": "error",
      "jsdoc/no-blank-blocks": "error",
      "jsdoc/require-asterisk-prefix": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "tmp/**",
    "output/**",
  ]),
]);

export default eslintConfig;
