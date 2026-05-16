/**
 * CORE-035 — coverage for update-check's pure helpers.
 *
 * `update-check.ts` was previously excluded from coverage because the
 * file as a whole hits the npm registry. The orchestrator
 * `checkForUpdate` still does (and stays excluded — it also runs a
 * `@clack/prompts` flow and spawns the package manager), but the
 * pure helpers `isNewer` and `installCommand` are now exported and
 * tested directly. No msw dep needed: the file's network surface is
 * a single `fetch(REGISTRY_URL)` call inside `fetchLatest` that
 * stays inside the orchestrator boundary.
 *
 * The other two files in the original "Network / git boundary"
 * exclusion (`contribute-git.ts`, `preset-github.ts`) need git-fixture
 * / gh-CLI subprocess mocks, not HTTP mocks — tracked separately.
 */
import { describe, it, expect } from "vitest";
import { isNewer, installCommand } from "#src/cli/update-check.js";

describe("isNewer (CORE-035)", () => {
  it("returns true when major bumps", () => {
    expect(isNewer("4.0.0", "3.0.0")).toBe(true);
  });

  it("returns true when minor bumps", () => {
    expect(isNewer("3.1.0", "3.0.0")).toBe(true);
  });

  it("returns true when patch bumps", () => {
    expect(isNewer("3.0.1", "3.0.0")).toBe(true);
  });

  it("returns false when versions match", () => {
    expect(isNewer("3.0.0", "3.0.0")).toBe(false);
  });

  it("returns false when current is newer", () => {
    expect(isNewer("3.0.0", "3.0.1")).toBe(false);
    expect(isNewer("3.0.0", "3.1.0")).toBe(false);
    expect(isNewer("3.0.0", "4.0.0")).toBe(false);
  });

  it("tolerates a leading `v` prefix on either side", () => {
    expect(isNewer("v3.1.0", "v3.0.0")).toBe(true);
    expect(isNewer("v3.0.0", "3.0.0")).toBe(false);
    expect(isNewer("3.1.0", "v3.0.0")).toBe(true);
  });

  it("strips prerelease tags before comparing the numeric triple", () => {
    // "3.1.0-beta.2" → triple [3,1,0]; still newer than [3,0,5].
    expect(isNewer("3.1.0-beta.2", "3.0.5")).toBe(true);
    // Same numeric triple → not newer (prerelease tag is ignored).
    expect(isNewer("3.0.0-rc.1", "3.0.0")).toBe(false);
  });

  it("treats malformed parts as 0 (no crash, conservative behaviour)", () => {
    expect(isNewer("", "")).toBe(false);
    expect(isNewer("not-a-version", "3.0.0")).toBe(false);
    expect(isNewer("3.0.0", "not-a-version")).toBe(true);
  });

  it("uses lexical fallback only when numeric parts equal — not as primary key", () => {
    // "3.10.0" must be newer than "3.9.0" (lexical sort would invert).
    expect(isNewer("3.10.0", "3.9.0")).toBe(true);
    expect(isNewer("3.2.10", "3.2.9")).toBe(true);
  });
});

describe("installCommand (CORE-035)", () => {
  it("emits `pnpm add -g codi-cli@latest` for pnpm", () => {
    expect(installCommand("pnpm")).toEqual({
      cmd: "pnpm",
      args: ["add", "-g", "codi-cli@latest"],
    });
  });

  it("emits `yarn global add codi-cli@latest` for yarn", () => {
    expect(installCommand("yarn")).toEqual({
      cmd: "yarn",
      args: ["global", "add", "codi-cli@latest"],
    });
  });

  it("emits `bun add -g codi-cli@latest` for bun", () => {
    expect(installCommand("bun")).toEqual({
      cmd: "bun",
      args: ["add", "-g", "codi-cli@latest"],
    });
  });

  it("emits `npm install -g codi-cli@latest` for npm (default)", () => {
    expect(installCommand("npm")).toEqual({
      cmd: "npm",
      args: ["install", "-g", "codi-cli@latest"],
    });
  });
});
