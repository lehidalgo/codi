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
  {
    // Biome — single Rust-based tool covering both lint and format.
    // Mutually exclusive with the eslint+prettier pair: when js_format_lint
    // is set to 'biome' the filter logic in hook-config-generator drops
    // eslint and prettier from the spec list and keeps this hook instead.
    name: "biome",
    language: "typescript",
    category: "lint",
    files: "**/*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css}",
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
