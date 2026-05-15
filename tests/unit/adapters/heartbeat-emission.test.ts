/**
 * CORE-006 — `buildHeartbeatArtifacts` contract.
 *
 * Covers the gating matrix that previously lived inline across three
 * adapters (claude-code, codex, copilot). The byte-equal output of the
 * scripts themselves is exercised by `output-snapshots.test.ts`; this
 * file pins the path layout, gating semantics, and return shape.
 */
import { describe, it, expect } from "vitest";
import { buildHeartbeatArtifacts } from "#src/adapters/heartbeat-emission.js";
import { PROJECT_DIR } from "#src/constants.js";

describe("buildHeartbeatArtifacts", () => {
  it("emits tracker + observer + launcher when both flags true", () => {
    const result = buildHeartbeatArtifacts({ emitTracker: true, emitObserver: true });
    const paths = result.files.map((f) => f.path);
    expect(paths).toHaveLength(3);
    expect(paths).toContain(result.trackerPath);
    expect(paths).toContain(result.observerPath);
    expect(paths).toContain(result.launcherPath);
  });

  it("emits only observer + launcher when emitTracker=false (codex semantics)", () => {
    const result = buildHeartbeatArtifacts({ emitTracker: false, emitObserver: true });
    const paths = result.files.map((f) => f.path);
    expect(paths).toHaveLength(2);
    expect(paths).not.toContain(result.trackerPath);
    expect(paths).toContain(result.observerPath);
    expect(paths).toContain(result.launcherPath);
  });

  it("emits only launcher when both heartbeat flags are false", () => {
    const result = buildHeartbeatArtifacts({ emitTracker: false, emitObserver: false });
    const paths = result.files.map((f) => f.path);
    expect(paths).toHaveLength(1);
    expect(paths).toContain(result.launcherPath);
  });

  it("returned paths are project-root-relative under .codi/hooks/", () => {
    const result = buildHeartbeatArtifacts({ emitTracker: true, emitObserver: true });
    expect(result.trackerPath.startsWith(`${PROJECT_DIR}/`)).toBe(true);
    expect(result.observerPath.startsWith(`${PROJECT_DIR}/`)).toBe(true);
    expect(result.launcherPath.startsWith(`${PROJECT_DIR}/`)).toBe(true);
  });

  it("emitted GeneratedFile shape is well-formed", () => {
    const result = buildHeartbeatArtifacts({ emitTracker: true, emitObserver: true });
    for (const f of result.files) {
      expect(f.path).toBeTruthy();
      expect(f.content.length).toBeGreaterThan(0);
      expect(f.sources.length).toBeGreaterThan(0);
      expect(f.hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("is deterministic (two calls produce byte-equal outputs)", () => {
    const a = buildHeartbeatArtifacts({ emitTracker: true, emitObserver: true });
    const b = buildHeartbeatArtifacts({ emitTracker: true, emitObserver: true });
    expect(a.files.map((f) => [f.path, f.hash])).toEqual(b.files.map((f) => [f.path, f.hash]));
  });
});
