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
