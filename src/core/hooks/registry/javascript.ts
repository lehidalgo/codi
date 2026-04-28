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
  {
    // Biome — see registry/typescript.ts for rationale. Duplicated here so
    // pure-JS projects (no tsconfig.json) can opt into Biome too.
    name: "biome",
    language: "javascript",
    category: "lint",
    files: "**/*.{js,jsx,mjs,cjs,json,jsonc,css}",
    stages: ["pre-commit"],
    required: false,
    shell: {
      command: "npx @biomejs/biome check --write --no-errors-on-unmatched",
      passFiles: true,
      modifiesFiles: true,
      toolBinary: "biome",
    },
    preCommit: {
      kind: "upstream",
      repo: "https://github.com/biomejs/pre-commit",
      rev: "v0.6.1",
      id: "biome-check",
      args: ["--write", "--no-errors-on-unmatched"],
      additionalDependencies: ["@biomejs/biome@2.3.0"],
    },
    installHint: { command: "npm install -D @biomejs/biome" },
  },
];
