import type { HookSpec } from "../hook-spec.js";

export const TYPESCRIPT_HOOKS: HookSpec[] = [
  {
    name: "eslint",
    language: "typescript",
    category: "lint",
    files: "**/*.{ts,tsx,js,jsx}",
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
    language: "typescript",
    category: "format",
    files: "**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,mdx,yaml,yml,css,scss,html}",
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
    name: "tsc",
    language: "typescript",
    category: "type-check",
    files: "**/*.{ts,tsx}",
    stages: ["pre-push"],
    required: true,
    shell: {
      command: "npx tsc --noEmit",
      passFiles: false,
      modifiesFiles: false,
      toolBinary: "tsc",
    },
    preCommit: {
      kind: "local",
      entry: "npx tsc --noEmit",
      language: "system",
      passFilenames: false,
    },
    installHint: { command: "npm install -D typescript" },
  },
];
