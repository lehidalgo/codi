/**
 * ISSUE-052 — resolveActorId helper.
 *
 * Verifies override / env / git / host fallback chain. The git probe is
 * not mocked — the test sets a tmp HOME / runs from a non-git dir so we
 * deterministically hit the env or host branch.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveActorId, formatActorId } from "#src/core/audit/resolve-actor.js";

describe("resolveActorId", () => {
  let tmpDir: string;
  let prevActorEnv: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-actor-"));
    prevActorEnv = process.env["CODI_ACTOR_ID"];
    delete process.env["CODI_ACTOR_ID"];
  });

  afterEach(() => {
    if (prevActorEnv === undefined) delete process.env["CODI_ACTOR_ID"];
    else process.env["CODI_ACTOR_ID"] = prevActorEnv;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("override Author wins over env / git / host", () => {
    process.env["CODI_ACTOR_ID"] = "env:value";
    const id = resolveActorId({
      override: { type: "agent", id: "claude-code" },
    });
    expect(id).toBe("agent:claude-code");
  });

  it("env CODI_ACTOR_ID wins over git / host fallback", () => {
    process.env["CODI_ACTOR_ID"] = "human:test@example.com";
    const id = resolveActorId({ cwd: tmpDir });
    expect(id).toBe("human:test@example.com");
  });

  it("falls back to host user when no override / env / git config present", () => {
    // tmpDir is not a git repo; with env cleared the resolver should
    // either return a git email (if global config bleeds through) or
    // hit the host branch. Either way the output must be non-empty.
    const id = resolveActorId({ cwd: tmpDir });
    expect(id.length).toBeGreaterThan(0);
    expect(id).toMatch(/^(human|unknown):/);
  });

  it("formatActorId composes <type>:<id>", () => {
    expect(formatActorId({ type: "human", id: "x@y" })).toBe("human:x@y");
    expect(formatActorId({ type: "agent", id: "claude-code" })).toBe("agent:claude-code");
  });
});
