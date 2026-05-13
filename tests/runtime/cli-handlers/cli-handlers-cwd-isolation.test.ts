/**
 * ISSUE-036 regression — every CLI handler must agree with `getStatus` on
 * which workflow is "active for this cwd".
 *
 * The pre-fix bug: `codi workflow status` filtered the active pointer by
 * `init.payload.cwd` (so a workflow started in project A appeared inactive
 * when the user ran `status` from project B), but every transition / scope /
 * lifecycle handler called bare `getActiveWorkflowId()` and happily mutated
 * the foreign workflow from project B. Status and transitions disagreed.
 *
 * Fixture: start a workflow under tmpDirA (init.payload.cwd=tmpDirA), then
 * invoke transition / abandon from tmpDirB. They must throw
 * BrainNoActiveWorkflowError instead of mutating the workflow from A.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrainNoActiveWorkflowError } from "#src/runtime/brain-event-log.js";
import { runWorkflow } from "#src/runtime/cli-handlers/workflow.js";
import {
  proposeTransition,
  approveTransition,
  rejectTransition,
  advanceWorkflow,
} from "#src/runtime/cli-handlers/transitions.js";
import { abandonWorkflow } from "#src/runtime/cli-handlers/lifecycle.js";
import { proposeScopeExpansion } from "#src/runtime/cli-handlers/scope.js";
import type { Author } from "#src/runtime/types.js";

const AUTHOR: Author = { type: "agent", id: "test" };

describe("ISSUE-036 — CLI handlers must agree with status on cwd", () => {
  let projectA: string;
  let projectB: string;
  let dbPath: string;

  beforeEach(() => {
    projectA = mkdtempSync(join(tmpdir(), "codi-iso-A-"));
    projectB = mkdtempSync(join(tmpdir(), "codi-iso-B-"));
    mkdirSync(join(projectA, "docs"), { recursive: true });
    writeFileSync(join(projectA, "docs", "CONTEXT.md"), "# ctx\n");
    dbPath = join(mkdtempSync(join(tmpdir(), "codi-iso-db-")), "brain.db");
    process.env["CODI_BRAIN_DB"] = dbPath;
    runWorkflow({
      workflowType: "feature",
      task: "isolation test",
      author: AUTHOR,
      cwd: projectA,
    });
  });

  afterEach(() => {
    delete process.env["CODI_BRAIN_DB"];
    rmSync(projectA, { recursive: true, force: true });
    rmSync(projectB, { recursive: true, force: true });
  });

  it("proposeTransition from foreign cwd throws BrainNoActiveWorkflowError", () => {
    expect(() => proposeTransition({ toPhase: "plan", author: AUTHOR, cwd: projectB })).toThrow(
      BrainNoActiveWorkflowError,
    );
  });

  it("approveTransition from foreign cwd throws BrainNoActiveWorkflowError", () => {
    proposeTransition({ toPhase: "plan", author: AUTHOR, cwd: projectA });
    expect(() => approveTransition({ author: AUTHOR, cwd: projectB })).toThrow(
      BrainNoActiveWorkflowError,
    );
  });

  it("rejectTransition from foreign cwd throws BrainNoActiveWorkflowError", () => {
    proposeTransition({ toPhase: "plan", author: AUTHOR, cwd: projectA });
    expect(() => rejectTransition({ reason: "no", author: AUTHOR, cwd: projectB })).toThrow(
      BrainNoActiveWorkflowError,
    );
  });

  it("advanceWorkflow from foreign cwd throws BrainNoActiveWorkflowError", () => {
    expect(() => advanceWorkflow({ author: AUTHOR, cwd: projectB })).toThrow(
      BrainNoActiveWorkflowError,
    );
  });

  it("abandonWorkflow from foreign cwd throws BrainNoActiveWorkflowError", () => {
    expect(() => abandonWorkflow({ reason: "x", author: AUTHOR, cwd: projectB })).toThrow(
      BrainNoActiveWorkflowError,
    );
  });

  it("proposeScopeExpansion from foreign cwd throws BrainNoActiveWorkflowError", () => {
    expect(() =>
      proposeScopeExpansion({
        filePath: "x.ts",
        reason: "y",
        author: AUTHOR,
        cwd: projectB,
      }),
    ).toThrow(BrainNoActiveWorkflowError);
  });

  it("matching cwd still resolves to the workflow (sanity)", () => {
    expect(() =>
      proposeTransition({ toPhase: "plan", author: AUTHOR, cwd: projectA }),
    ).not.toThrow();
  });
});
