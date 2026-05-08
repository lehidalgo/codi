import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  runWorkflow,
  proposeScopeExpansion,
  approveScopeExpansion,
  rejectScopeExpansion,
  recordIncidentalChange,
  getStatus,
} from "#src/runtime/cli-handlers.js";
import type { Author } from "#src/runtime/types.js";

const human: Author = { type: "human", id: "tester" };
const agent: Author = { type: "agent", id: "claude-code" };

function setup(): string {
  const dir = mkdtempSync(join(tmpdir(), "devloop-scope-"));
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# Context\n", "utf-8");
  runWorkflow({
    workflowType: "feature",
    task: "Test scope",
    author: human,
    cwd: dir,
  });
  return dir;
}

describe("scope expansion handlers", () => {
  let dir: string;

  beforeEach(() => {
    dir = setup();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("proposes a scope expansion", () => {
    const result = proposeScopeExpansion({
      filePath: "src/new.ts",
      reason: "needed for feature",
      author: agent,
      cwd: dir,
    });
    expect(result.filePath).toBe("src/new.ts");
    expect(result.proposedEventId).toBeTruthy();
  });

  it("rejects propose with empty reason", () => {
    expect(() =>
      proposeScopeExpansion({
        filePath: "src/x.ts",
        reason: "",
        author: agent,
        cwd: dir,
      }),
    ).toThrow("requires --reason");
  });

  it("rejects propose with empty file path", () => {
    expect(() =>
      proposeScopeExpansion({
        filePath: "",
        reason: "x",
        author: agent,
        cwd: dir,
      }),
    ).toThrow("requires --file");
  });

  it("rejects propose for file already in plan", () => {
    proposeScopeExpansion({
      filePath: "src/x.ts",
      reason: "first",
      author: agent,
      cwd: dir,
    });
    approveScopeExpansion({ author: human, cwd: dir });
    expect(() =>
      proposeScopeExpansion({
        filePath: "src/x.ts",
        reason: "second",
        author: agent,
        cwd: dir,
      }),
    ).toThrow("already in scope");
  });

  it("approves the latest unresolved proposal", () => {
    proposeScopeExpansion({
      filePath: "src/a.ts",
      reason: "a",
      author: agent,
      cwd: dir,
    });
    const result = approveScopeExpansion({ author: human, cwd: dir });
    expect(result.filePath).toBe("src/a.ts");

    const status = getStatus({ cwd: dir });
    expect(status.state?.scope.files_in_plan).toContain("src/a.ts");
    expect(status.state?.scope.scope_expansions_approved).toBe(1);
  });

  it("approves a specific proposal by --file when multiple pending", () => {
    proposeScopeExpansion({
      filePath: "src/a.ts",
      reason: "a",
      author: agent,
      cwd: dir,
    });
    proposeScopeExpansion({
      filePath: "src/b.ts",
      reason: "b",
      author: agent,
      cwd: dir,
    });
    const result = approveScopeExpansion({
      filePath: "src/a.ts",
      author: human,
      cwd: dir,
    });
    expect(result.filePath).toBe("src/a.ts");

    const status = getStatus({ cwd: dir });
    expect(status.state?.scope.files_in_plan).toEqual(["src/a.ts"]);
  });

  it("rejects approve when no proposal pending", () => {
    expect(() => approveScopeExpansion({ author: human, cwd: dir })).toThrow(
      "No pending scope expansion proposal",
    );
  });

  it("rejects scope rejection", () => {
    proposeScopeExpansion({
      filePath: "src/x.ts",
      reason: "x",
      author: agent,
      cwd: dir,
    });
    rejectScopeExpansion({
      reason: "out of scope",
      author: human,
      cwd: dir,
    });

    const status = getStatus({ cwd: dir });
    expect(status.state?.scope.scope_expansions_rejected).toBe(1);
    expect(status.state?.scope.files_in_plan).toEqual([]);
  });

  it("rejects reject without reason", () => {
    proposeScopeExpansion({
      filePath: "src/x.ts",
      reason: "x",
      author: agent,
      cwd: dir,
    });
    expect(() => rejectScopeExpansion({ reason: "", author: human, cwd: dir })).toThrow(
      "Reject requires",
    );
  });

  it("a rejected proposal can be re-proposed and approved", () => {
    proposeScopeExpansion({
      filePath: "src/x.ts",
      reason: "first",
      author: agent,
      cwd: dir,
    });
    rejectScopeExpansion({
      reason: "wait",
      author: human,
      cwd: dir,
    });
    proposeScopeExpansion({
      filePath: "src/x.ts",
      reason: "now needed",
      author: agent,
      cwd: dir,
    });
    approveScopeExpansion({ author: human, cwd: dir });

    const status = getStatus({ cwd: dir });
    expect(status.state?.scope.files_in_plan).toContain("src/x.ts");
    expect(status.state?.scope.scope_expansions_approved).toBe(1);
    expect(status.state?.scope.scope_expansions_rejected).toBe(1);
  });
});

describe("incidental change recording", () => {
  let dir: string;

  beforeEach(() => {
    dir = setup();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("appends an incidental_change_recorded event", () => {
    recordIncidentalChange({
      filePath: "src/utils.ts",
      linesChanged: 1,
      classifierReason: "imports only",
      author: { type: "system", id: "post-tool-use-hook" },
      cwd: dir,
    });
    const status = getStatus({ cwd: dir });
    expect(status.state?.scope.incidental_changes).toBe(1);
  });

  it("counts multiple incidentals", () => {
    for (const f of ["a.ts", "b.ts", "c.ts"]) {
      recordIncidentalChange({
        filePath: f,
        linesChanged: 1,
        classifierReason: "imports only",
        author: { type: "system", id: "post-tool-use-hook" },
        cwd: dir,
      });
    }
    const status = getStatus({ cwd: dir });
    expect(status.state?.scope.incidental_changes).toBe(3);
  });
});
