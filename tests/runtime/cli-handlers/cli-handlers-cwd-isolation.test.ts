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
 * invoke transition / abandon from tmpDirB. They must return Result.err with
 * E_NO_ACTIVE_WORKFLOW (CORE-017) instead of mutating the workflow from A.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
import { unwrap } from "../_brain-helper.js";

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
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "isolation test",
        author: AUTHOR,
        cwd: projectA,
      }),
    );
  });

  afterEach(() => {
    delete process.env["CODI_BRAIN_DB"];
    rmSync(projectA, { recursive: true, force: true });
    rmSync(projectB, { recursive: true, force: true });
  });

  it("proposeTransition from foreign cwd returns E_NO_ACTIVE_WORKFLOW", () => {
    const r = proposeTransition({ toPhase: "plan", author: AUTHOR, cwd: projectB });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_NO_ACTIVE_WORKFLOW");
  });

  it("approveTransition from foreign cwd returns E_NO_ACTIVE_WORKFLOW", () => {
    unwrap(proposeTransition({ toPhase: "plan", author: AUTHOR, cwd: projectA }));
    const r = approveTransition({ author: AUTHOR, cwd: projectB });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_NO_ACTIVE_WORKFLOW");
  });

  it("rejectTransition from foreign cwd returns E_NO_ACTIVE_WORKFLOW", () => {
    unwrap(proposeTransition({ toPhase: "plan", author: AUTHOR, cwd: projectA }));
    const r = rejectTransition({ reason: "no", author: AUTHOR, cwd: projectB });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_NO_ACTIVE_WORKFLOW");
  });

  it("advanceWorkflow from foreign cwd returns E_NO_ACTIVE_WORKFLOW", () => {
    const r = advanceWorkflow({ author: AUTHOR, cwd: projectB });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_NO_ACTIVE_WORKFLOW");
  });

  it("abandonWorkflow from foreign cwd returns E_NO_ACTIVE_WORKFLOW", () => {
    const r = abandonWorkflow({ reason: "x", author: AUTHOR, cwd: projectB });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_NO_ACTIVE_WORKFLOW");
  });

  it("proposeScopeExpansion from foreign cwd returns E_NO_ACTIVE_WORKFLOW", () => {
    const r = proposeScopeExpansion({
      filePath: "x.ts",
      reason: "y",
      author: AUTHOR,
      cwd: projectB,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_NO_ACTIVE_WORKFLOW");
  });

  it("matching cwd still resolves to the workflow (sanity)", () => {
    const r = proposeTransition({ toPhase: "plan", author: AUTHOR, cwd: projectA });
    expect(r.ok).toBe(true);
  });
});
