/**
 * F8 — Tests for the three previously fake-pass gate checks now wired to
 * real evidence:
 *   - no_unresolved_scope_proposals
 *   - validation_passes
 *   - all_planned_files_modified
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDeterministicCheck, type DeterministicCheckContext } from "#src/runtime/gate-runner.js";
import {
  runWorkflow,
  proposeScopeExpansion,
  approveScopeExpansion,
  rejectScopeExpansion,
} from "#src/runtime/cli-handlers.js";
import { reduce } from "#src/runtime/reducer.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { createEvent } from "#src/runtime/event-factory.js";
import { git } from "#src/runtime/git-utils.js";
import type { Author, GateCheck, ManifestEvent } from "#src/runtime/types.js";
import type { GateCheck as Gate } from "#src/runtime/gate-types.js";

const human: Author = { type: "human", id: "tester" };

function bootstrapKb(d: string): void {
  mkdirSync(join(d, "docs"), { recursive: true });
  writeFileSync(join(d, "docs", "CONTEXT.md"), "# C\n", "utf-8");
}

function buildCtx(cwd: string): DeterministicCheckContext {
  const log = BrainEventLog.open();
  try {
    const id = log.getActiveWorkflowId();
    if (!id) throw new Error("no workflow");
    const events = log.loadEvents(id);
    return { cwd, state: reduce(events), events };
  } finally {
    log.dispose();
  }
}

let dir: string;
let savedBrain: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codi-gate-fix-"));
  bootstrapKb(dir);
  savedBrain = process.env["CODI_BRAIN_DB"];
  process.env["CODI_BRAIN_DB"] = join(dir, "brain.db");
  runWorkflow({ workflowType: "feature", task: "x", author: human, cwd: dir });
});

afterEach(() => {
  if (savedBrain === undefined) delete process.env["CODI_BRAIN_DB"];
  else process.env["CODI_BRAIN_DB"] = savedBrain;
  rmSync(dir, { recursive: true, force: true });
});

const noUnresolved: Gate = { id: "no_unresolved_scope_proposals", type: "deterministic" };
const validationPasses: Gate = { id: "validation_passes", type: "deterministic" };
const allPlannedFilesModified: Gate = { id: "all_planned_files_modified", type: "deterministic" };

describe("no_unresolved_scope_proposals (F8)", () => {
  it("passes when there are no proposals at all", () => {
    const outcome = runDeterministicCheck(noUnresolved, buildCtx(dir));
    expect(outcome.result.verdict).toBe("pass");
  });

  it("fails when a proposal is pending", () => {
    proposeScopeExpansion({
      filePath: "src/x.ts",
      reason: "needed",
      author: human,
      cwd: dir,
    });
    const outcome = runDeterministicCheck(noUnresolved, buildCtx(dir));
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.summary).toContain("src/x.ts");
    expect(outcome.result.suggested_action).toContain("approve");
  });

  it("passes after the proposal is approved", () => {
    proposeScopeExpansion({
      filePath: "src/x.ts",
      reason: "needed",
      author: human,
      cwd: dir,
    });
    approveScopeExpansion({ author: human, cwd: dir });
    const outcome = runDeterministicCheck(noUnresolved, buildCtx(dir));
    expect(outcome.result.verdict).toBe("pass");
  });

  it("passes after the proposal is rejected", () => {
    proposeScopeExpansion({
      filePath: "src/x.ts",
      reason: "needed",
      author: human,
      cwd: dir,
    });
    rejectScopeExpansion({
      filePath: "src/x.ts",
      reason: "wrong file",
      author: human,
      cwd: dir,
    });
    const outcome = runDeterministicCheck(noUnresolved, buildCtx(dir));
    expect(outcome.result.verdict).toBe("pass");
  });

  it("fails when one of multiple files has no resolution", () => {
    proposeScopeExpansion({ filePath: "src/a.ts", reason: "a", author: human, cwd: dir });
    proposeScopeExpansion({ filePath: "src/b.ts", reason: "b", author: human, cwd: dir });
    approveScopeExpansion({ filePath: "src/a.ts", author: human, cwd: dir });
    const outcome = runDeterministicCheck(noUnresolved, buildCtx(dir));
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.summary).toContain("src/b.ts");
    expect(outcome.result.summary).not.toContain("src/a.ts");
  });
});

describe("validation_passes (F8)", () => {
  function appendEvent(event: ManifestEvent): void {
    const log = BrainEventLog.open();
    try {
      const id = log.getActiveWorkflowId();
      if (!id) throw new Error("no workflow");
      log.append(id, event);
    } finally {
      log.dispose();
    }
  }

  it("fails when no validation_run event has been recorded", () => {
    const outcome = runDeterministicCheck(validationPasses, buildCtx(dir));
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.summary).toContain("No validation_run");
    expect(outcome.result.suggested_action).toContain("validate");
  });

  it("passes when the latest validation_run has exit_code 0", () => {
    appendEvent(
      createEvent({
        eventType: "validation_run",
        payload: { command: "npm run test", exit_code: 0, duration_ms: 1234 },
        author: { type: "system", id: "ci" },
        parentEventId: null,
      }),
    );
    const outcome = runDeterministicCheck(validationPasses, buildCtx(dir));
    expect(outcome.result.verdict).toBe("pass");
    expect(outcome.result.summary).toContain("exit 0");
    expect(outcome.result.summary).toContain("npm run test");
  });

  it("fails when the latest validation_run has non-zero exit", () => {
    appendEvent(
      createEvent({
        eventType: "validation_run",
        payload: { command: "npm run test", exit_code: 1, duration_ms: 1234 },
        author: { type: "system", id: "ci" },
        parentEventId: null,
      }),
    );
    const outcome = runDeterministicCheck(validationPasses, buildCtx(dir));
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.summary).toContain("exit 1");
    expect(outcome.result.suggested_action).toContain("Fix");
  });

  it("uses the most recent validation_run when several exist", () => {
    appendEvent(
      createEvent({
        eventType: "validation_run",
        payload: { command: "first", exit_code: 1, duration_ms: 1 },
        author: { type: "system", id: "ci" },
        parentEventId: null,
      }),
    );
    appendEvent(
      createEvent({
        eventType: "validation_run",
        payload: { command: "second", exit_code: 0, duration_ms: 1 },
        author: { type: "system", id: "ci" },
        parentEventId: null,
      }),
    );
    const outcome = runDeterministicCheck(validationPasses, buildCtx(dir));
    expect(outcome.result.verdict).toBe("pass");
    expect(outcome.result.summary).toContain("second");
    expect(outcome.result.summary).not.toContain("first");
  });
});

describe("all_planned_files_modified (F8)", () => {
  function gitInit(): void {
    git(["init", "-b", "main"], dir);
    git(["config", "user.email", "test@codi.local"], dir);
    git(["config", "user.name", "test"], dir);
    writeFileSync(join(dir, ".gitkeep"), "", "utf-8");
    git(["add", "."], dir);
    git(["commit", "-m", "init"], dir);
  }

  it("fails when the plan scope is empty", () => {
    gitInit();
    const outcome = runDeterministicCheck(allPlannedFilesModified, buildCtx(dir));
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.summary).toContain("empty");
  });

  it("fails when planned files have no working-tree changes", () => {
    gitInit();
    // Create an unchanged baseline file.
    writeFileSync(join(dir, "untouched.ts"), "// baseline\n", "utf-8");
    git(["add", "untouched.ts"], dir);
    git(["commit", "-m", "baseline"], dir);

    proposeScopeExpansion({
      filePath: "untouched.ts",
      reason: "in plan",
      author: human,
      cwd: dir,
    });
    approveScopeExpansion({ author: human, cwd: dir });

    const outcome = runDeterministicCheck(allPlannedFilesModified, buildCtx(dir));
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.summary).toContain("untouched.ts");
  });

  it("passes when each planned file has working-tree changes", () => {
    gitInit();
    writeFileSync(join(dir, "edited.ts"), "// baseline\n", "utf-8");
    git(["add", "edited.ts"], dir);
    git(["commit", "-m", "baseline"], dir);

    proposeScopeExpansion({
      filePath: "edited.ts",
      reason: "in plan",
      author: human,
      cwd: dir,
    });
    approveScopeExpansion({ author: human, cwd: dir });

    // Modify the file.
    writeFileSync(join(dir, "edited.ts"), "// changed\n", "utf-8");

    const outcome = runDeterministicCheck(allPlannedFilesModified, buildCtx(dir));
    expect(outcome.result.verdict).toBe("pass");
    expect(outcome.result.summary).toContain("1 planned file");
  });

  it("treats untracked planned files as modified (new files in plan)", () => {
    gitInit();
    proposeScopeExpansion({
      filePath: "src/new.ts",
      reason: "new feature",
      author: human,
      cwd: dir,
    });
    approveScopeExpansion({ author: human, cwd: dir });
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "new.ts"), "// new file\n", "utf-8");

    const outcome = runDeterministicCheck(allPlannedFilesModified, buildCtx(dir));
    expect(outcome.result.verdict).toBe("pass");
  });

  it("fails when git is unavailable (not a repo)", () => {
    // No gitInit() — the tmp dir is not a git repo.
    proposeScopeExpansion({
      filePath: "any.ts",
      reason: "x",
      author: human,
      cwd: dir,
    });
    approveScopeExpansion({ author: human, cwd: dir });
    const outcome = runDeterministicCheck(allPlannedFilesModified, buildCtx(dir));
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.summary).toContain("git status failed");
  });
});

// Type re-export to satisfy strict imports without leaking GateCheck name.
export type { GateCheck };
