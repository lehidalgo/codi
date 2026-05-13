/**
 * ISSUE-044 rewrite — exercises real hub-handlers internals.
 *
 * Pre-rewrite this file carried 21 `vi.mock("#src/...")` calls, mocking every
 * CLI sibling so each test could assert `expect(handler).toHaveBeenCalledWith(...)`.
 * That pattern tested the mocks, not the dispatcher. Per the project's
 * codi-testing rule ("Do not mock the module under test"), the file now:
 *
 *   - Keeps only @clack/prompts as a legitimate TTY boundary mock.
 *   - Drives every flow through real fs + real codi.yaml so the dispatcher
 *     resolves config the same way it does in production.
 *   - Asserts observable outcomes (multiselect option list, log warnings) —
 *     never the count of internal handler invocations.
 *
 * Dispatch-only tests that solely verified `expect(routeX).toHaveBeenCalled()`
 * were dropped; that surface is exercised by E2E via the real `codi` CLI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  multiselect: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
  },
}));

import * as p from "@clack/prompts";
import { isCancelled, handleGenerate } from "#src/cli/hub-handlers.js";
import { registerAllAdapters } from "#src/adapters/index.js";

// Adapters are normally registered as a side-effect of CLI startup. In a
// unit-style test that imports the dispatcher directly the registry is
// empty until we wire them in here.
registerAllAdapters();

describe("hub-handlers — pure utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  describe("isCancelled", () => {
    it("returns true for cancel symbols", () => {
      vi.mocked(p.isCancel).mockReturnValueOnce(true);
      expect(isCancelled(Symbol("cancel"))).toBe(true);
    });

    it("returns false for normal values", () => {
      vi.mocked(p.isCancel).mockReturnValueOnce(false);
      expect(isCancelled("value")).toBe(false);
    });
  });
});

describe("hub-handlers — handleGenerate manifest filter", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-hub-gen-"));
    await fs.mkdir(path.join(tmpRoot, ".codi"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  /**
   * Write a minimal `.codi/codi.yaml` with the supplied `agents` list. The
   * dispatcher calls `resolveConfig(projectRoot)` which loads from disk —
   * this fixture is what production reads.
   */
  async function writeManifest(agents: string[] | undefined): Promise<void> {
    const agentsLine =
      agents === undefined
        ? ""
        : agents.length === 0
          ? `agents: []\n`
          : `agents:\n${agents.map((a) => `  - ${a}`).join("\n")}\n`;
    const yaml = `name: hub-gen-test\nversion: "1"\n${agentsLine}`;
    await fs.writeFile(path.join(tmpRoot, ".codi", "codi.yaml"), yaml);
  }

  /**
   * `handleGenerate` would invoke `generateHandler` after a successful select.
   * We make `multiselect` return a cancel symbol AND scope `isCancel` to
   * exactly one call so the assertion target (the options list passed in)
   * is captured without doing any actual generation, but other prompts in
   * the same test stay non-cancelled.
   */
  function cancelAfterMultiselect(): void {
    const cancelToken = Symbol("cancel");
    vi.mocked(p.multiselect).mockResolvedValueOnce(cancelToken as never);
    vi.mocked(p.isCancel).mockImplementationOnce((v) => v === cancelToken);
  }

  it("restricts the multiselect to agents declared in the manifest", async () => {
    await writeManifest(["claude-code", "cursor"]);
    cancelAfterMultiselect();

    await handleGenerate(tmpRoot);

    const multiselectCall = vi.mocked(p.multiselect).mock.calls[0]?.[0];
    expect(multiselectCall?.options).toHaveLength(2);
    expect(multiselectCall?.options.map((o) => o.value).sort()).toEqual(["claude-code", "cursor"]);
    expect(multiselectCall?.initialValues?.sort()).toEqual(["claude-code", "cursor"]);
  });

  it("falls back to all registered adapters when manifest is unreadable", async () => {
    // No .codi/codi.yaml on disk → resolveConfig fails → fallback path
    rmSync(path.join(tmpRoot, ".codi"), { recursive: true, force: true });
    cancelAfterMultiselect();

    await handleGenerate(tmpRoot);

    expect(p.log.warn).toHaveBeenCalledWith(
      expect.stringContaining("falling back to all registered adapters"),
    );
    const multiselectCall = vi.mocked(p.multiselect).mock.calls[0]?.[0];
    expect((multiselectCall?.options.length ?? 0) >= 5).toBe(true);
  });

  it("errors and returns without prompting when manifest declares zero usable agents", async () => {
    await writeManifest([]);

    await handleGenerate(tmpRoot);

    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining("No usable agents configured"),
    );
    expect(p.multiselect).not.toHaveBeenCalled();
  });

  it("treats undefined manifest.agents as 'all detected' (use all adapters)", async () => {
    await writeManifest(undefined);
    cancelAfterMultiselect();

    await handleGenerate(tmpRoot);

    const multiselectCall = vi.mocked(p.multiselect).mock.calls[0]?.[0];
    expect((multiselectCall?.options.length ?? 0) >= 5).toBe(true);
  });

  // NOTE: the original "filters unknown adapters from manifest and warns" test
  // was deleted during the ISSUE-044 rewrite. It mocked `resolveConfig` so it
  // could feed `handleGenerate` a config with an unknown adapter id —
  // synthetic state that production never sees, because `validateConfig`
  // rejects unknown adapter ids upstream and `resolveConfig` returns
  // `ok: false`. The dispatcher's "unknown adapter" branch is reachable in
  // principle but not in practice with the current validator; it is exercised
  // by the existing config-validator tests instead.
});
