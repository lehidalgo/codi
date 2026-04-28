import type { HookSpec } from "../hook-spec.js";

export const JAVASCRIPT_HOOKS: HookSpec[] = [
  {
    name: "eslint",
    language: "javascript",
    category: "lint",
    files: "**/*.{js,jsx,mjs,cjs}",
    stages: ["pre-commit"],
    required: false,
    shell: {
      command: "npx eslint --fix",
      passFiles: true,
      modifiesFiles: true,
      toolBinary: "eslint",
    },
    preCommit: {
      kind: "local",
      entry: "npx eslint --fix",
      language: "system",
    },
    installHint: { command: "npm install -D eslint" },
  },
  {
    name: "prettier",
    language: "javascript",
    category: "format",
    files: "**/*.{js,jsx,mjs,cjs,json,md,mdx,yaml,yml,css,scss,html}",
    stages: ["pre-commit"],
    required: false,
    shell: {
      command: "npx prettier --write",
      passFiles: true,
      modifiesFiles: true,
      toolBinary: "prettier",
    },
    preCommit: {
      kind: "upstream",
      repo: "https://github.com/pre-commit/mirrors-prettier",
      rev: "v4.0.0-alpha.8",
      id: "prettier",
    },
    installHint: { command: "npm install -D prettier" },
  },
];
