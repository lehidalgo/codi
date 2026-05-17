/**
 * Unit tests for `getStatePath` in `src/core/config/state.ts`.
 *
 * Single source of truth for the `.codi/state/state.json` path — every
 * caller (backup-manager, watch, …) must use this helper instead of
 * composing the path inline, to avoid drift like ISSUE-005.
 *
 * Added 2026-05-17 with the fix for ISSUE-004 + ISSUE-005.
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { getStatePath } from "#src/core/config/state.js";
import { STATE_DIR, STATE_FILENAME } from "#src/constants.js";

describe("getStatePath", () => {
  it("returns configDir/state/state.json (post-CORE-002 layout)", () => {
    const configDir = "/project/.codi";
    expect(getStatePath(configDir)).toBe(join(configDir, STATE_DIR, STATE_FILENAME));
  });

  it("does NOT return the legacy `.codi/state.json` path", () => {
    const configDir = "/project/.codi";
    expect(getStatePath(configDir)).not.toBe(join(configDir, STATE_FILENAME));
  });

  it("composes correctly for relative configDir", () => {
    expect(getStatePath(".codi")).toBe(join(".codi", STATE_DIR, STATE_FILENAME));
  });
});
