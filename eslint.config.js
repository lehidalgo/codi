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
