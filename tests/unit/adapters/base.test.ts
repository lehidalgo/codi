/**
 * CORE-006 — AdapterDefinition + defineAdapter contract tests.
 *
 * The byte-equal output guarantee for the six real adapters lives in
 * `output-snapshots.test.ts` and per-adapter suites. This file exercises
 * the BaseAdapter shape itself: detection wiring, idempotence of the
 * declarative `markers` detect, and that the resulting `AgentAdapter`
 * satisfies the public contract.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defineAdapter, type AdapterDefinition } from "#src/adapters/base.js";
import type { AgentPaths, AgentCapabilities } from "#src/types/agent.js";

const dummyPaths: AgentPaths = {
  configRoot: ".dummy",
  rules: ".dummy/rules",
  skills: null,
  agents: null,
  instructionFile: "DUMMY.md",
  mcpConfig: null,
};
const dummyCaps: AgentCapabilities = {
  rules: false,
  skills: false,
  mcp: false,
  frontmatter: false,
  progressiveLoading: false,
  agents: false,
  maxContextTokens: 0,
};

function baseDef(overrides: Partial<AdapterDefinition>): AdapterDefinition {
  return {
    id: "dummy",
    name: "Dummy",
    paths: dummyPaths,
    capabilities: dummyCaps,
    detect: { markers: ["DUMMY.md"] },
    generate: async () => [],
    ...overrides,
  };
}

describe("defineAdapter / AdapterDefinition", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `codi-base-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("produces an AgentAdapter satisfying the public contract", () => {
    const adapter = defineAdapter(baseDef({}));
    expect(adapter.id).toBe("dummy");
    expect(adapter.name).toBe("Dummy");
    expect(adapter.paths).toBe(dummyPaths);
    expect(adapter.capabilities).toBe(dummyCaps);
    expect(typeof adapter.detect).toBe("function");
    expect(typeof adapter.generate).toBe("function");
  });

  it("detect.markers returns true when any marker exists", async () => {
    const adapter = defineAdapter(baseDef({ detect: { markers: ["A.md", "B.md"] } }));
    await writeFile(join(tmpDir, "B.md"), "");
    expect(await adapter.detect(tmpDir)).toBe(true);
  });

  it("detect.markers returns false when no marker exists", async () => {
    const adapter = defineAdapter(baseDef({ detect: { markers: ["X.md", "Y.md"] } }));
    expect(await adapter.detect(tmpDir)).toBe(false);
  });

  it("detect.fn escape hatch is honoured verbatim", async () => {
    let calls = 0;
    const adapter = defineAdapter(
      baseDef({
        detect: {
          fn: async (root) => {
            calls += 1;
            return root.length > 0;
          },
        },
      }),
    );
    expect(await adapter.detect(tmpDir)).toBe(true);
    expect(calls).toBe(1);
  });

  it("detect is pure across repeated calls (idempotent)", async () => {
    const adapter = defineAdapter(baseDef({ detect: { markers: ["M.md"] } }));
    await writeFile(join(tmpDir, "M.md"), "");
    expect(await adapter.detect(tmpDir)).toBe(true);
    expect(await adapter.detect(tmpDir)).toBe(true);
  });

  it("delegates generate() to the definition unchanged", async () => {
    const calls: string[] = [];
    const adapter = defineAdapter(
      baseDef({
        generate: async (_config, options) => {
          calls.push(options.projectRoot ?? "no-root");
          return [{ path: "x", content: "", sources: [], hash: "" }];
        },
      }),
    );
    const files = await adapter.generate({} as never, { projectRoot: tmpDir });
    expect(files).toHaveLength(1);
    expect(calls).toEqual([tmpDir]);
  });
});
