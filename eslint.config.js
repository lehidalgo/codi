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
      "src/templates/skills/*/scripts/**/*.cjs",
      "src/templates/skills/*/scripts/**/*.js",
      "**/*.xsd",
      // CORE-016 (resolved): Sprint 2 cleanup completed organically across
      // CORE-001..015 — runtime/ + tests/runtime/ + scripts/runtime/ are
      // now lint-clean and re-enabled. The DevLoop staging directory
      // remains ignored because it ships verbatim to consumer projects
      // and is governed by its own linting rules.
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
