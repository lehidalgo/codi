import { describe, it, expect } from "vitest";
import { renderPreCommitConfig } from "#src/core/hooks/renderers/yaml-renderer.js";
import type { HookSpec } from "#src/core/hooks/hook-spec.js";

const ruff: HookSpec = {
  name: "ruff-check",
  language: "python",
  category: "lint",
  files: "**/*.py",
  stages: ["pre-commit"],
  required: true,
  shell: { command: "ruff check --fix", passFiles: true, modifiesFiles: true, toolBinary: "ruff" },
  preCommit: {
    kind: "upstream",
    repo: "https://github.com/astral-sh/ruff-pre-commit",
    rev: "v0.15.12",
    id: "ruff-check",
    args: ["--fix"],
  },
  installHint: { command: "pip install ruff" },
};

const eslintLocal: HookSpec = {
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
  preCommit: { kind: "local", entry: "npx eslint --fix", language: "system" },
  installHint: { command: "npm i -D eslint" },
};

describe("renderPreCommitConfig — case set", () => {
  it("1. empty file produces fresh repos: list with managed entries", () => {
    const out = renderPreCommitConfig([ruff], null);
    expect(out).toMatch(/default_install_hook_types:/);
    expect(out).toMatch(/exclude:/);
    expect(out).toMatch(/repos:/);
    expect(out).toMatch(/astral-sh\/ruff-pre-commit/);
    expect(out).toMatch(/rev: v0\.15\.12/);
    expect(out).toMatch(/managed by codi/);
    expect(out).toMatch(/ruff-check/);
    expect(out).toMatch(/--fix/);
    expect(out.endsWith("\n")).toBe(true);
  });

  it("2. existing file with one external repo, no nested hooks → Codi block sibling", () => {
    const existing = `repos:\n  - repo: https://github.com/external/tool\n    rev: v1.0.0\n`;
    const out = renderPreCommitConfig([ruff], existing);
    expect(out).toMatch(/external\/tool/);
    expect(out).toMatch(/astral-sh\/ruff-pre-commit/);
    const externalIdx = out.indexOf("external/tool");
    const ruffIdx = out.indexOf("astral-sh/ruff-pre-commit");
    expect(externalIdx).toBeLessThan(ruffIdx);
  });

  it("3. external repo with nested hooks (C1 case) — Codi block remains sibling under repos:", () => {
    const existing = [
      "repos:",
      "  - repo: https://github.com/external/tool",
      "    rev: v1.0.0",
      "    hooks:",
      "      - id: existing-1",
      "      - id: existing-2",
      "",
    ].join("\n");
    const out = renderPreCommitConfig([ruff], existing);
    expect(out).toMatch(/existing-1/);
    expect(out).toMatch(/existing-2/);
    expect(out).toMatch(/astral-sh\/ruff-pre-commit/);
    // ruff-pre-commit must be on a top-level repos: list line at two-space indent
    const ruffLine = out.split("\n").find((l) => l.includes("ruff-pre-commit"));
    expect(ruffLine).toMatch(/^ {2}- repo:/);
  });

  it("4. multiple external repos at varied indent — Codi entry uses canonical two-space indent", () => {
    const existing = [
      "repos:",
      "  - repo: https://github.com/a/a",
      "    rev: v1",
      "  - repo: https://github.com/b/b",
      "    rev: v2",
      "    hooks:",
      "      - id: b-hook",
      "",
    ].join("\n");
    const out = renderPreCommitConfig([ruff], existing);
    const ruffLine = out.split("\n").find((l) => l.includes("ruff-pre-commit"));
    expect(ruffLine).toMatch(/^ {2}- repo:/);
  });

  it("5. file Codi previously wrote (text-marker form) → migration removes block", () => {
    // Use the canonical Codi marker (capital C, matches PROJECT_NAME_DISPLAY)
    const existing = [
      "repos:",
      "  - repo: https://github.com/external/tool",
      "    rev: v1.0.0",
      "  # Codi hooks: BEGIN (auto-generated — do not edit between markers)",
      "  - repo: local",
      "    hooks:",
      "      - id: codi-staged-junk-check",
      "        entry: node .git/hooks/codi-staged-junk-check.mjs",
      "  # Codi hooks: END",
      "",
    ].join("\n");
    const out = renderPreCommitConfig([ruff], existing);
    expect(out).not.toMatch(/Codi hooks: BEGIN/);
    expect(out).toMatch(/external\/tool/);
    expect(out).toMatch(/astral-sh\/ruff-pre-commit/);
  });

  it("6. malformed YAML → falls back to fresh document", () => {
    const existing = ": not yaml :::\n  - foo\n bar";
    const out = renderPreCommitConfig([ruff], existing);
    expect(out).toMatch(/astral-sh\/ruff-pre-commit/);
  });

  it("7. user-pinned rev preserved on regenerate (rev: v0.15.10 stays)", () => {
    const first = renderPreCommitConfig([ruff], null);
    // Simulate the user editing only the rev: pin (e.g. via pre-commit autoupdate)
    const userEdited = first.replace("rev: v0.15.12", "rev: v0.15.10");
    const second = renderPreCommitConfig([ruff], userEdited);
    expect(second).toMatch(/rev: v0\.15\.10/);
    expect(second).not.toMatch(/rev: v0\.15\.12/);
  });

  it("8. polyglot: TS + Python both rendered", () => {
    const out = renderPreCommitConfig([eslintLocal, ruff], null);
    expect(out).toMatch(/eslint/);
    expect(out).toMatch(/astral-sh\/ruff-pre-commit/);
  });

  it("9. re-rendering identical input produces identical output", () => {
    const first = renderPreCommitConfig([eslintLocal, ruff], null);
    const second = renderPreCommitConfig([eslintLocal, ruff], first);
    expect(second).toBe(first);
  });

  it("10. user adds external repo between renders → preserved", () => {
    const first = renderPreCommitConfig([ruff], null);
    const userEdited = first.replace(
      "repos:",
      "repos:\n  - repo: https://github.com/user/added\n    rev: v9\n",
    );
    const second = renderPreCommitConfig([ruff], userEdited);
    expect(second).toMatch(/user\/added/);
    expect(second).toMatch(/astral-sh\/ruff-pre-commit/);
  });

  it("11. local entries (Codi .mjs scripts) emit always_run for catch-all files", () => {
    const local: HookSpec = {
      name: "codi-staged-junk-check",
      language: "global",
      category: "lint",
      files: "**",
      stages: ["pre-commit"],
      required: false,
      shell: {
        command: "node .git/hooks/codi-staged-junk-check.mjs",
        passFiles: true,
        modifiesFiles: false,
        toolBinary: "node",
      },
      preCommit: {
        kind: "local",
        entry: "node .git/hooks/codi-staged-junk-check.mjs",
        language: "system",
      },
      installHint: { command: "" },
    };
    const out = renderPreCommitConfig([local], null);
    expect(out).toMatch(/codi-staged-junk-check/);
    expect(out).toMatch(/always_run: true/);
  });

  it("12. existing top-level keys preserved (does not overwrite user-set defaults)", () => {
    const existing =
      "default_install_hook_types: [pre-commit]\nminimum_pre_commit_version: '4.0.0'\nrepos:\n";
    const out = renderPreCommitConfig([ruff], existing);
    // user's tighter values stay; we don't overwrite them
    expect(out).toMatch(/minimum_pre_commit_version: '?4\.0\.0/);
    // exclude was missing — we add it
    expect(out).toMatch(/exclude:/);
  });
});
