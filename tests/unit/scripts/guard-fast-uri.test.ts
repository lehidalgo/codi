/**
 * ISSUE: pnpm → npm migration — verify the fast-uri supply-chain
 * override lives at the npm-canonical top-level `overrides` field
 * (not the legacy `pnpm.overrides` location). The guard script
 * scripts/guard-fast-uri.mjs reads from this location; if the override
 * is moved or stripped, the guard must surface that, not silently pass.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("guard-fast-uri reads override from npm location", () => {
  it("package.json declares fast-uri override at top-level overrides (not pnpm.overrides)", () => {
    const pkg = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"),
    ) as Record<string, unknown>;
    const overrides = pkg.overrides as Record<string, string> | undefined;
    expect(overrides?.["fast-uri"]).toMatch(/^>=3\.1\.2$/);
    expect(pkg.pnpm).toBeUndefined();
  });
});
