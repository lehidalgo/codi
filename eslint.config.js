import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      ".git/**",
      "src/templates/skills/*/assets/**",
      "src/templates/skills/*/references/**",
      "src/templates/skills/*/scripts/python/**",
      "src/templates/skills/*/scripts/office/**",
      "src/templates/skills/*/scripts/vendor/**",
      "src/templates/skills/*/scripts/export/**",
      "src/templates/skills/*/scripts/*.cjs",
      "src/templates/skills/*/scripts/*.js",
      "**/*.xsd",
      // Sprint 1 — DevLoop sources imported per ADR-v3ed0-002, refactor (lint compliance + imports + types) en Sprint 2
      "src/runtime/**",
      "tests/runtime/**",
      "scripts/runtime/**",
      "src/templates/skills-devloop-staging/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
