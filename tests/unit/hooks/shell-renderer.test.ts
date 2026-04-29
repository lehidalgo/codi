import { describe, it, expect } from "vitest";
import { buildHuskyCommands } from "#src/core/hooks/hook-installer.js";
import { renderShellHooks } from "#src/core/hooks/renderers/shell-renderer.js";
import { getHooksForLanguage, getGlobalHooks } from "#src/core/hooks/hook-registry.js";

const canonicalHooks = () => [
  ...getHooksForLanguage("typescript"),
  ...getHooksForLanguage("python"),
  ...getGlobalHooks().filter((h) => h.name !== "commitlint"),
];

describe("shell renderer parity (golden snapshot)", () => {
  it("matches snapshot for typescript+python+global hooks (excluding commitlint)", () => {
    const out = buildHuskyCommands(canonicalHooks());
    expect(out).toMatchSnapshot();
  });
});

describe("shell renderer parity (new path)", () => {
  it("renderShellHooks produces same output as buildHuskyCommands", () => {
    const oldOut = buildHuskyCommands(canonicalHooks());
    const newOut = renderShellHooks(canonicalHooks(), "husky");
    expect(newOut).toBe(oldOut);
  });

  it("renderShellHooks output is identical for husky/standalone/lefthook", () => {
    const husky = renderShellHooks(canonicalHooks(), "husky");
    const standalone = renderShellHooks(canonicalHooks(), "standalone");
    const lefthook = renderShellHooks(canonicalHooks(), "lefthook");
    expect(standalone).toBe(husky);
    expect(lefthook).toBe(husky);
  });
});

describe("renderShellHooks — stage filter (regression for #12)", () => {
  it("default (pre-commit) excludes pre-push hooks (tsc, mypy, basedpyright, pyright)", () => {
    const out = renderShellHooks(canonicalHooks(), "husky");
    expect(out).not.toContain("npx tsc --noEmit");
    expect(out).not.toMatch(/\bmypy\b/);
    expect(out).not.toMatch(/\bbasedpyright\b/);
    expect(out).not.toMatch(/\bpyright\b/);
    expect(out).not.toContain("commitlint");
    // pre-commit-stage hooks remain
    expect(out).toContain("npx eslint --fix");
    expect(out).toContain("ruff check --fix");
  });

  it("pre-push stage emits only pre-push hooks (tsc, mypy, basedpyright, pyright)", () => {
    const out = renderShellHooks(canonicalHooks(), "husky", "pre-push");
    expect(out).toContain("npx tsc --noEmit");
    expect(out).toMatch(/\bmypy\b/);
    expect(out).toMatch(/\bbasedpyright\b/);
    expect(out).not.toContain("npx eslint --fix");
    expect(out).not.toContain("ruff check --fix");
    expect(out).not.toContain("commitlint");
    // pre-push body has no STAGED prelude (no concept of staged files at push time)
    expect(out).not.toContain("STAGED=$(git diff --cached --name-only");
    // No re-stage at pre-push
    expect(out).not.toContain("xargs git add");
  });

  it("commit-msg stage emits only commit-msg hooks (commitlint)", () => {
    const allHooks = [...getHooksForLanguage("typescript"), ...getGlobalHooks()];
    const out = renderShellHooks(allHooks, "husky", "commit-msg");
    expect(out).toContain("commitlint");
    expect(out).not.toContain("eslint --fix");
    expect(out).not.toContain("STAGED=$(git diff --cached --name-only");
  });

  it("returns empty string when no specs match the requested stage", () => {
    const onlyPreCommit = canonicalHooks().filter((h) => h.stages.includes("pre-commit"));
    expect(renderShellHooks(onlyPreCommit, "husky", "pre-push")).toBe("");
    expect(renderShellHooks(onlyPreCommit, "husky", "commit-msg")).toBe("");
  });
});
