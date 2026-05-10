# Workflow Gates + Team Readiness — Implementation Plan

> **For agentic workers:** Use `codi-plan-execution` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `gate-runner` as advisory at phase-transition time, surface gate verdicts to the agent in UserPromptSubmit, filter `getActiveWorkflowId` by `cwd`, and ship a team workflow handbook — so the codi team can start a guided pilot tomorrow.

**Architecture:** Reuse existing modules (`gate-runner.ts`, `iron-laws-enforcer.ts`'s block pattern, `BrainEventLog`). Add one new bridge module + one new advisory block builder. Modify `approveTransition`, `getActiveWorkflowId`, the `init` event payload, and the UserPromptSubmit dispatcher. Single commit at end of session.

**Tech Stack:** TypeScript strict, vitest, better-sqlite3, js-yaml, node:fs/path/child_process.

**Source spec:** `docs/20260510_032859_[PLAN]_workflow-gates-team-readiness.md`
**Audit reference:** `docs/20260510_032225_[AUDIT]_workflows-skills-gates-team-readiness.md`

---

## Conventions

- TDD: write test → run → confirm RED → implement → run → confirm GREEN.
- **No commits inside individual tasks.** Task G is the only commit, at the end.
- Strict TS, no `any`. Files target ≤ 200 LoC.
- Both adapters honoured automatically via the existing single `codi hook` event channel — zero adapter-specific code.

---

## Task A: gate-runner-bridge module

- [ ] **Files**: `src/runtime/gate-runner-bridge.ts` (new), `tests/runtime/gate-runner-bridge.test.ts` (new)
- [ ] **Est**: 8 minutes

**Steps**

1. Write failing test `tests/runtime/gate-runner-bridge.test.ts`:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import { mkdtempSync, rmSync } from "node:fs";
   import { tmpdir } from "node:os";
   import { join } from "node:path";
   import { runPhaseGates, formatGateAdvisory } from "#src/runtime/gate-runner-bridge.js";
   import { BrainEventLog } from "#src/runtime/brain-event-log.js";
   import { reduce } from "#src/runtime/reducer.js";
   import { createEvent } from "#src/runtime/event-factory.js";
   import type { Author, ManifestEvent } from "#src/runtime/types.js";

   const SYSTEM_AUTHOR: Author = { type: "system", id: "codi" };

   describe("gate-runner-bridge", () => {
     let cwd: string;
     let dbDir: string;
     beforeEach(() => {
       cwd = mkdtempSync(join(tmpdir(), "codi-gb-"));
       dbDir = mkdtempSync(join(tmpdir(), "codi-gb-db-"));
     });
     afterEach(() => {
       rmSync(cwd, { recursive: true, force: true });
       rmSync(dbDir, { recursive: true, force: true });
     });

     function newLog(): BrainEventLog {
       return BrainEventLog.open({ dbPath: join(dbDir, `${Date.now()}.db`) });
     }

     it("runs the right gates for fromPhase=intent (task_described)", () => {
       const log = newLog();
       const init = createEvent({
         eventType: "init",
         payload: {
           workflow_id: "w1",
           workflow_type: "feature",
           task: "Test feature",
           plugin_version: "0.1.0",
         },
         author: SYSTEM_AUTHOR,
         parentEventId: null,
       });
       log.initWorkflow("w1", init);
       log.append(
         "w1",
         createEvent({
           eventType: "phase_started",
           payload: { phase: "intent" },
           author: SYSTEM_AUTHOR,
           parentEventId: init.event_id,
         }),
       );
       const events = log.loadEvents("w1");
       const state = reduce(events);
       const result = runPhaseGates("intent", {
         cwd,
         workflowType: "feature",
         workflowId: "w1",
         state,
         events,
         log,
       });
       expect(result.passed).toBe(true);
       expect(result.outcomes.map((o) => o.check.id)).toEqual(["task_described"]);
     });

     it("returns failing result when scope_files_listed has zero files", () => {
       const log = newLog();
       const init = createEvent({
         eventType: "init",
         payload: {
           workflow_id: "w2",
           workflow_type: "feature",
           task: "x",
           plugin_version: "0.1.0",
         },
         author: SYSTEM_AUTHOR,
         parentEventId: null,
       });
       log.initWorkflow("w2", init);
       log.append(
         "w2",
         createEvent({
           eventType: "phase_started",
           payload: { phase: "plan" },
           author: SYSTEM_AUTHOR,
           parentEventId: init.event_id,
         }),
       );
       const events = log.loadEvents("w2");
       const state = reduce(events);
       const result = runPhaseGates("plan", {
         cwd,
         workflowType: "feature",
         workflowId: "w2",
         state,
         events,
         log,
       });
       expect(result.passed).toBe(false);
       const ids = result.outcomes.map((o) => o.check.id);
       expect(ids).toContain("scope_files_listed");
       expect(ids).toContain("plan_artifact_exists");
     });

     it("never throws on internal errors — fail-open with summary", () => {
       const log = newLog();
       const init = createEvent({
         eventType: "init",
         payload: {
           workflow_id: "w3",
           workflow_type: "feature",
           task: "x",
           plugin_version: "0.1.0",
         },
         author: SYSTEM_AUTHOR,
         parentEventId: null,
       });
       log.initWorkflow("w3", init);
       const events: ManifestEvent[] = [];
       const state = reduce(log.loadEvents("w3"));
       const result = runPhaseGates("plan", {
         cwd: "/nonexistent/path/that/does/not/exist",
         workflowType: "feature",
         workflowId: "w3",
         state,
         events,
         log,
       });
       expect(result).toBeDefined();
       expect(typeof result.passed).toBe("boolean");
     });

     it("persists gate_check_started + gate_check_failed events for failures", () => {
       const log = newLog();
       const init = createEvent({
         eventType: "init",
         payload: {
           workflow_id: "w4",
           workflow_type: "feature",
           task: "x",
           plugin_version: "0.1.0",
         },
         author: SYSTEM_AUTHOR,
         parentEventId: null,
       });
       log.initWorkflow("w4", init);
       log.append(
         "w4",
         createEvent({
           eventType: "phase_started",
           payload: { phase: "plan" },
           author: SYSTEM_AUTHOR,
           parentEventId: init.event_id,
         }),
       );
       const events = log.loadEvents("w4");
       const state = reduce(events);
       runPhaseGates("plan", {
         cwd,
         workflowType: "feature",
         workflowId: "w4",
         state,
         events,
         log,
       });
       const after = log.loadEvents("w4");
       const startedCount = after.filter((e) => e.event_type === "gate_check_started").length;
       const failedCount = after.filter((e) => e.event_type === "gate_check_failed").length;
       expect(startedCount).toBeGreaterThan(0);
       expect(failedCount).toBeGreaterThan(0);
     });

     it("formatGateAdvisory produces multi-line stderr text with suggested actions", () => {
       const text = formatGateAdvisory({
         gate_name: "plan",
         passed: false,
         outcomes: [
           {
             check: { id: "scope_files_listed", type: "deterministic" },
             result: {
               check_id: "scope_files_listed",
               verdict: "fail",
               summary: "scope.files_in_plan is empty.",
               suggested_action: "Use codi workflow scope propose-expansion --file <path>.",
             },
             retries_used: 0,
           },
         ],
         failed_checks: [],
         retries_remaining: 0,
         next_step: "Investigate the failed check.",
       });
       expect(text).toContain("scope_files_listed");
       expect(text).toContain("scope.files_in_plan is empty.");
       expect(text).toContain("propose-expansion");
     });
   });
   ```

2. Run: `pnpm test tests/runtime/gate-runner-bridge.test.ts` — expected: 5 failing.
3. Implement `src/runtime/gate-runner-bridge.ts`:

   ```typescript
   /**
    * Bridge: connects approveTransition to the gate-runner.
    *
    * Loads the active workflow's gate list for `fromPhase`, runs each
    * deterministic checker, persists gate_check_* events, and returns a
    * GateRunResult. Always returns. Fail-open: any thrown error becomes a
    * gate failure with the message in summary; never throws to caller.
    *
    * Advisory by design — the caller (approveTransition) decides whether
    * to act on the result. Default behaviour is to approve regardless.
    */

   import { existsSync, readFileSync } from "node:fs";
   import { join } from "node:path";
   import { parse as parseYaml } from "yaml";
   import type { CheckOutcome, GateCheck, GateResult, GateRunResult } from "./gate-types.js";
   import { aggregateOutcomes, runDeterministicCheck } from "./gate-runner.js";
   import type { BrainEventLog } from "./brain-event-log.js";
   import type { ManifestEvent, Phase, ReducedState } from "./types.js";
   import { createEvent } from "./event-factory.js";

   const SYSTEM_AUTHOR = { type: "system" as const, id: "codi" };

   export interface BridgeContext {
     cwd: string;
     workflowType: string;
     workflowId: string;
     state: ReducedState;
     events: ManifestEvent[];
     log: BrainEventLog;
   }

   interface WorkflowYaml {
     id: string;
     phases: Record<string, { gates?: string[]; next?: string[] }>;
   }

   function findWorkflowYaml(workflowType: string): string | null {
     // Resolve relative to this compiled module so the lookup works whether
     // the runtime is invoked from inside the codi project itself or from
     // a consumer scratch project (where process.cwd() is unrelated).
     const filename = `${workflowType}.yaml`;
     const moduleAnchored: string[] = [];
     try {
       const here = new URL(".", import.meta.url).pathname;
       moduleAnchored.push(
         join(here, "..", "templates", "workflows", filename), // dist layout
         join(here, "..", "..", "templates", "workflows", filename), // src layout
       );
     } catch {
       // import.meta.url may be unavailable under some test runners; fall through.
     }
     const candidates = [
       ...moduleAnchored,
       join(process.cwd(), "src", "templates", "workflows", filename),
       join(process.cwd(), "dist", "templates", "workflows", filename),
     ];
     for (const p of candidates) {
       if (existsSync(p)) return p;
     }
     return null;
   }

   function gatesForPhase(workflowType: string, phase: Phase): string[] {
     const path = findWorkflowYaml(workflowType);
     if (!path) return [];
     try {
       const raw = readFileSync(path, "utf8");
       const parsed = parseYaml(raw) as WorkflowYaml;
       const phaseSpec = parsed.phases?.[phase];
       return phaseSpec?.gates ?? [];
     } catch {
       return [];
     }
   }

   export function runPhaseGates(fromPhase: Phase, ctx: BridgeContext): GateRunResult {
     const gateNames = gatesForPhase(ctx.workflowType, fromPhase);
     const checks: GateCheck[] = gateNames.map((id) => ({ id, type: "deterministic" }));
     const outcomes: CheckOutcome[] = [];

     for (const check of checks) {
       try {
         ctx.log.append(
           ctx.workflowId,
           createEvent({
             eventType: "gate_check_started",
             payload: { gate_name: fromPhase, check_id: check.id },
             author: SYSTEM_AUTHOR,
             parentEventId: null,
           }),
         );
       } catch {
         // Persistence failure does not block the check itself.
       }

       let result: GateResult;
       try {
         result = runDeterministicCheck(check, {
           cwd: ctx.cwd,
           state: ctx.state,
           events: ctx.events,
         });
       } catch (e) {
         const message = e instanceof Error ? e.message : String(e);
         result = {
           check_id: check.id,
           verdict: "fail",
           summary: `Bridge error running ${check.id}: ${message}`,
         };
       }

       try {
         ctx.log.append(
           ctx.workflowId,
           createEvent({
             eventType: result.verdict === "pass" ? "gate_check_passed" : "gate_check_failed",
             payload: {
               gate_name: fromPhase,
               check_id: check.id,
               summary: result.summary ?? "",
               suggested_action: result.suggested_action ?? "",
             },
             author: SYSTEM_AUTHOR,
             parentEventId: null,
           }),
         );
       } catch {
         // Persistence failure does not block the result.
       }

       outcomes.push({ check, result, retries_used: 0 });
     }

     return aggregateOutcomes(fromPhase, outcomes);
   }

   export function formatGateAdvisory(result: GateRunResult): string {
     const lines: string[] = [];
     lines.push(
       `Gates for phase '${result.gate_name}' ran. ${result.passed ? "All passed." : "Some failed (advisory — transition still completes)."}`,
     );
     for (const outcome of result.outcomes) {
       if (outcome.result.verdict === "pass") continue;
       const id = outcome.check.id;
       lines.push(`  [${id}] ${outcome.result.summary ?? ""}`);
       const sa = outcome.result.suggested_action;
       if (sa && sa.length > 0) lines.push(`    → ${sa}`);
     }
     return lines.join("\n");
   }
   ```

4. Run: `pnpm test tests/runtime/gate-runner-bridge.test.ts` — expected: 5 passing.

**Verification**: `pnpm test tests/runtime/gate-runner-bridge.test.ts && pnpm build` — expected: green + clean.

---

## Task B: Wire bridge into approveTransition

- [ ] **Files**: `src/runtime/cli-handlers/transitions.ts` (modify), `tests/runtime/cli-handlers/transitions-gate-bridge.test.ts` (new)
- [ ] **Est**: 6 minutes

**Steps**

1. Write failing test `tests/runtime/cli-handlers/transitions-gate-bridge.test.ts`:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import { mkdtempSync, rmSync } from "node:fs";
   import { tmpdir } from "node:os";
   import { join } from "node:path";
   import { BrainEventLog } from "#src/runtime/brain-event-log.js";
   import { createEvent } from "#src/runtime/event-factory.js";
   import { approveTransition, proposeTransition } from "#src/runtime/cli-handlers/transitions.js";
   import { runWorkflow } from "#src/runtime/cli-handlers/workflow.js";
   import type { Author } from "#src/runtime/types.js";

   const AGENT_AUTHOR: Author = { type: "agent", id: "test" };

   describe("approveTransition runs phase gates as advisory", () => {
     let scratch: string;
     let prevCwd: string;
     beforeEach(() => {
       prevCwd = process.cwd();
       scratch = mkdtempSync(join(tmpdir(), "codi-tg-"));
       process.env.CODI_BRAIN_DB = join(mkdtempSync(join(tmpdir(), "codi-test-")), "brain.db");
     });
     afterEach(() => {
       delete process.env.CODI_BRAIN_DB;
       process.chdir(prevCwd);
       rmSync(scratch, { recursive: true, force: true });
     });

     it("plan→decompose with empty scope persists gate_check_failed but still approves", () => {
       runWorkflow({
         workflowType: "feature",
         task: "Test gate firing",
         author: AGENT_AUTHOR,
         cwd: scratch,
       });
       proposeTransition({ toPhase: "plan", author: AGENT_AUTHOR, cwd: scratch });
       approveTransition({ author: AGENT_AUTHOR });
       proposeTransition({ toPhase: "decompose", author: AGENT_AUTHOR, cwd: scratch });
       const result = approveTransition({ author: AGENT_AUTHOR });
       expect(result.fromPhase).toBe("plan");
       expect(result.toPhase).toBe("decompose");
       const log = BrainEventLog.open();
       const events = log.loadEvents(result.workflowId);
       const failed = events.filter((e) => e.event_type === "gate_check_failed");
       expect(failed.length).toBeGreaterThan(0);
       const phaseCompleted = events.find(
         (e) =>
           e.event_type === "phase_completed" && (e.payload as { phase?: string }).phase === "plan",
       );
       expect(phaseCompleted).toBeDefined();
       expect((phaseCompleted!.payload as { gate_passed?: boolean }).gate_passed).toBe(false);
     });

     it("intent→plan with task set passes task_described and emits gate_check_passed", () => {
       runWorkflow({
         workflowType: "feature",
         task: "Real task",
         author: AGENT_AUTHOR,
         cwd: scratch,
       });
       proposeTransition({ toPhase: "plan", author: AGENT_AUTHOR, cwd: scratch });
       const result = approveTransition({ author: AGENT_AUTHOR });
       const log = BrainEventLog.open();
       const events = log.loadEvents(result.workflowId);
       const passed = events.filter(
         (e) =>
           e.event_type === "gate_check_passed" &&
           (e.payload as { check_id?: string }).check_id === "task_described",
       );
       expect(passed.length).toBe(1);
     });
   });
   ```

2. Run: `pnpm test tests/runtime/cli-handlers/transitions-gate-bridge.test.ts` — expected: 2 failing.
3. Modify `src/runtime/cli-handlers/transitions.ts`. Replace the body of `approveTransition` from the `state` reduce up through the `phase_completed` append with the gated version. Concretely:

   Add at the top of the file:

   ```typescript
   import { runPhaseGates, formatGateAdvisory } from "../gate-runner-bridge.js";
   ```

   Replace the block starting at `const state = reduce(events);` and the existing `phase_completed` append (lines around 138–151) with:

   ```typescript
   const state = reduce(events);
   const fromPhase = proposalPayload.from_phase;
   const gateResult = runPhaseGates(fromPhase, {
     cwd: process.cwd(),
     workflowType: state.workflow_type,
     workflowId,
     state,
     events,
     log,
   });

   // Stderr advisory — dev sees suggested actions immediately.
   if (!gateResult.passed) {
     process.stderr.write(`[codi gate-advisory]\n${formatGateAdvisory(gateResult)}\n`);
   }

   log.append(
     workflowId,
     createEvent({
       eventType: "phase_completed",
       payload: {
         phase: fromPhase,
         duration_ms: computePhaseDuration(state, fromPhase),
         gate_passed: gateResult.passed,
       },
       author: SYSTEM_AUTHOR,
       parentEventId: lastProposed.event_id,
     }),
   );
   ```

   Leave the rest of `approveTransition` (the `phase_transition_approved` and `phase_started` appends, plus the `done`-terminal handling) unchanged.

4. Run: `pnpm test tests/runtime/cli-handlers/transitions-gate-bridge.test.ts` — expected: 2 passing.
5. Run: `pnpm test` — expected: full suite green.

**Verification**: `pnpm build && pnpm test` — green.

---

## Task C: buildGateAdvisoryBlock + UserPromptSubmit wire

- [ ] **Files**: `src/runtime/hook-logic.ts` (modify), `src/cli/agent-hooks.ts` (modify), `tests/runtime/hook-logic-gate-advisory.test.ts` (new)
- [ ] **Est**: 6 minutes

**Steps**

1. Write failing test `tests/runtime/hook-logic-gate-advisory.test.ts`:

   ```typescript
   import { describe, it, expect, afterEach } from "vitest";
   import { mkdtempSync } from "node:fs";
   import { tmpdir } from "node:os";
   import { join } from "node:path";
   import { BrainEventLog } from "#src/runtime/brain-event-log.js";
   import { createEvent } from "#src/runtime/event-factory.js";
   import { buildGateAdvisoryBlock } from "#src/runtime/hook-logic.js";
   import type { Author } from "#src/runtime/types.js";

   const SYSTEM: Author = { type: "system", id: "codi" };

   describe("buildGateAdvisoryBlock", () => {
     it("returns empty when no active workflow", () => {
       const dbPath = join(mkdtempSync(join(tmpdir(), "codi-gab-")), "brain.db");
       const log = BrainEventLog.open({ dbPath });
       expect(buildGateAdvisoryBlock(log)).toBe("");
     });

     it("returns empty when no gate_check_failed events", () => {
       process.env.CODI_BRAIN_DB = join(mkdtempSync(join(tmpdir(), "codi-test-")), "brain.db");
       try {
         const log = BrainEventLog.open();
         const init = createEvent({
           eventType: "init",
           payload: {
             workflow_id: "w1",
             workflow_type: "feature",
             task: "x",
             plugin_version: "0.1.0",
           },
           author: SYSTEM,
           parentEventId: null,
         });
         log.initWorkflow("w1", init);
         expect(buildGateAdvisoryBlock(log)).toBe("");
       } finally {
         delete process.env.CODI_BRAIN_DB;
       }
     });

     it("emits block with rule ids and suggested actions when gate_check_failed since last approval", () => {
       process.env.CODI_BRAIN_DB = join(mkdtempSync(join(tmpdir(), "codi-test-")), "brain.db");
       try {
         const log = BrainEventLog.open();
         const init = createEvent({
           eventType: "init",
           payload: {
             workflow_id: "w2",
             workflow_type: "feature",
             task: "x",
             plugin_version: "0.1.0",
           },
           author: SYSTEM,
           parentEventId: null,
         });
         log.initWorkflow("w2", init);
         log.append(
           "w2",
           createEvent({
             eventType: "gate_check_failed",
             payload: {
               gate_name: "plan",
               check_id: "scope_files_listed",
               summary: "scope.files_in_plan is empty.",
               suggested_action: "Use codi workflow scope propose-expansion --file <path>.",
             },
             author: SYSTEM,
             parentEventId: null,
           }),
         );
         const out = buildGateAdvisoryBlock(log);
         expect(out).toContain("<gate-advisory>");
         expect(out).toContain("scope_files_listed");
         expect(out).toContain("scope.files_in_plan is empty.");
         expect(out).toContain("propose-expansion");
         expect(out).toContain("</gate-advisory>");
       } finally {
         delete process.env.CODI_BRAIN_DB;
       }
     });

     it("suppresses block after a phase_transition_approved supersedes the failures", () => {
       process.env.CODI_BRAIN_DB = join(mkdtempSync(join(tmpdir(), "codi-test-")), "brain.db");
       try {
         const log = BrainEventLog.open();
         const init = createEvent({
           eventType: "init",
           payload: {
             workflow_id: "w3",
             workflow_type: "feature",
             task: "x",
             plugin_version: "0.1.0",
           },
           author: SYSTEM,
           parentEventId: null,
         });
         log.initWorkflow("w3", init);
         log.append(
           "w3",
           createEvent({
             eventType: "gate_check_failed",
             payload: {
               gate_name: "intent",
               check_id: "task_described",
               summary: "Task is empty.",
               suggested_action: "Set the task at workflow init.",
             },
             author: SYSTEM,
             parentEventId: null,
           }),
         );
         log.append(
           "w3",
           createEvent({
             eventType: "phase_transition_approved",
             payload: { from_phase: "intent", to_phase: "plan" },
             author: SYSTEM,
             parentEventId: null,
           }),
         );
         expect(buildGateAdvisoryBlock(log)).toBe("");
       } finally {
         delete process.env.CODI_BRAIN_DB;
       }
     });
   });
   ```

2. Run: `pnpm test tests/runtime/hook-logic-gate-advisory.test.ts` — expected: 4 failing.
3. Add `buildGateAdvisoryBlock` to `src/runtime/hook-logic.ts`. Append at end of file (or near `buildCaptureReminderBlock`):

   ```typescript
   /**
    * Iron Law-style advisory block surfacing gate failures since the most
    * recent phase_transition_approved on the active workflow. Empty string
    * when there is no active workflow or no unresolved gate failures.
    *
    * Mirrors the shape of buildIronLawsBlock + buildPullReminder — block
    * markers + multi-line body + suggested actions.
    */
   export function buildGateAdvisoryBlock(log: BrainEventLog): string {
     try {
       const workflowId = log.getActiveWorkflowId();
       if (!workflowId) return "";
       const events = log.loadEvents(workflowId);

       // Find index of most recent phase_transition_approved.
       let lastApprovedIdx = -1;
       for (let i = events.length - 1; i >= 0; i -= 1) {
         const ev = events[i];
         if (ev?.event_type === "phase_transition_approved") {
           lastApprovedIdx = i;
           break;
         }
       }

       // Collect gate_check_failed events that are AFTER the last approval.
       const failures = events
         .slice(lastApprovedIdx + 1)
         .filter((e) => e.event_type === "gate_check_failed");

       if (failures.length === 0) return "";

       const lines: string[] = [
         "<gate-advisory>",
         "Phase gates flagged the following at the most recent approve. Advisory — transition was approved by the developer; act on these before the next transition.",
       ];
       for (const ev of failures) {
         const p = ev.payload as {
           check_id?: string;
           summary?: string;
           suggested_action?: string;
         };
         const id = p.check_id ?? "(unknown)";
         lines.push(`[${id}] ${p.summary ?? ""}`);
         if (p.suggested_action && p.suggested_action.length > 0) {
           lines.push(`  → ${p.suggested_action}`);
         }
       }
       lines.push("</gate-advisory>");
       return lines.join("\n");
     } catch {
       return "";
     }
   }
   ```

   Add the import for `BrainEventLog` at the top of the file (next to other runtime imports):

   ```typescript
   import type { BrainEventLog } from "./brain-event-log.js";
   ```

4. Wire into `src/cli/agent-hooks.ts` `runUserPromptSubmit`. Add static imports near the top of the file (next to other runtime imports):
   ```typescript
   import { BrainEventLog } from "../runtime/brain-event-log.js";
   import { buildGateAdvisoryBlock } from "../runtime/hook-logic.js";
   ```
   Then locate the block:
   ```typescript
   const out = [captureBlock, stateBlock, ironLawsBlock].filter((s) => s.length > 0).join("\n\n");
   ```
   Replace with:
   ```typescript
   let gateAdvisoryBlock = "";
   try {
     const handle = openBrain();
     try {
       applyMigrations(handle.raw);
       gateAdvisoryBlock = buildGateAdvisoryBlock(BrainEventLog.wrap(handle));
     } finally {
       handle.close();
     }
   } catch {
     // Advisory only.
   }
   const out = [captureBlock, stateBlock, ironLawsBlock, gateAdvisoryBlock]
     .filter((s) => s.length > 0)
     .join("\n\n");
   ```
   `BrainEventLog.wrap(handle)` already exists at `brain-event-log.ts:114`. Static imports avoid first-prompt-latency overhead and surface type errors at build time.
5. Run: `pnpm test tests/runtime/hook-logic-gate-advisory.test.ts` — expected: 4 passing.
6. Run: `pnpm build && pnpm test` — full suite green.

**Verification**: `pnpm test && pnpm build` — green.

---

## Task D: cwd filter on getActiveWorkflowId

- [ ] **Files**: `src/runtime/cli-handlers/workflow.ts` (modify init payload), `src/runtime/brain-event-log.ts` (modify `getActiveWorkflowId`), `tests/runtime/brain-event-log-cwd-filter.test.ts` (new)
- [ ] **Est**: 7 minutes

**Steps**

1. **D.1 Add `cwd` to init payload**. Modify `src/runtime/cli-handlers/workflow.ts` `runWorkflow` near line 87:
   ```typescript
   const initPayload: Record<string, unknown> = {
     workflow_id: workflowId,
     workflow_type: opts.workflowType,
     task: opts.task,
     plugin_version: "0.1.0",
     cwd: opts.cwd ?? process.cwd(),
   };
   ```
2. Write failing test `tests/runtime/brain-event-log-cwd-filter.test.ts`:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import { mkdtempSync, rmSync } from "node:fs";
   import { tmpdir } from "node:os";
   import { join } from "node:path";
   import { BrainEventLog } from "#src/runtime/brain-event-log.js";
   import { createEvent } from "#src/runtime/event-factory.js";
   import type { Author } from "#src/runtime/types.js";

   const AUTHOR: Author = { type: "system", id: "codi" };

   describe("getActiveWorkflowId cwd filter", () => {
     let projectA: string;
     let projectB: string;
     let prevCwd: string;
     beforeEach(() => {
       prevCwd = process.cwd();
       projectA = mkdtempSync(join(tmpdir(), "codi-cwdA-"));
       projectB = mkdtempSync(join(tmpdir(), "codi-cwdB-"));
       process.env.CODI_BRAIN_DB = join(mkdtempSync(join(tmpdir(), "codi-test-")), "brain.db");
     });
     afterEach(() => {
       delete process.env.CODI_BRAIN_DB;
       process.chdir(prevCwd);
       rmSync(projectA, { recursive: true, force: true });
       rmSync(projectB, { recursive: true, force: true });
     });

     it("returns id when cwd matches workflow init payload", () => {
       process.chdir(projectA);
       const log = BrainEventLog.open();
       const init = createEvent({
         eventType: "init",
         payload: {
           workflow_id: "wA",
           workflow_type: "feature",
           task: "x",
           plugin_version: "0.1.0",
           cwd: projectA,
         },
         author: AUTHOR,
         parentEventId: null,
       });
       log.initWorkflow("wA", init);
       expect(log.getActiveWorkflowId()).toBe("wA");
     });

     it("returns null when cwd is a different project from active workflow", () => {
       process.chdir(projectA);
       const log = BrainEventLog.open();
       const init = createEvent({
         eventType: "init",
         payload: {
           workflow_id: "wA",
           workflow_type: "feature",
           task: "x",
           plugin_version: "0.1.0",
           cwd: projectA,
         },
         author: AUTHOR,
         parentEventId: null,
       });
       log.initWorkflow("wA", init);
       process.chdir(projectB);
       expect(log.getActiveWorkflowId()).toBe(null);
     });

     it("back-compat: returns id when init payload has no cwd field", () => {
       process.chdir(projectA);
       const log = BrainEventLog.open();
       const init = createEvent({
         eventType: "init",
         payload: {
           workflow_id: "wOld",
           workflow_type: "feature",
           task: "x",
           plugin_version: "0.1.0",
         },
         author: AUTHOR,
         parentEventId: null,
       });
       log.initWorkflow("wOld", init);
       expect(log.getActiveWorkflowId()).toBe("wOld");
     });
   });
   ```

3. Run: `pnpm test tests/runtime/brain-event-log-cwd-filter.test.ts` — expected: 1 fails (foreign-cwd does not return null today).
4. Modify `src/runtime/brain-event-log.ts` `getActiveWorkflowId` (around line 125). Replace the body with:

   ```typescript
   getActiveWorkflowId(): string | null {
     // Existing query: most recent non-terminal workflow.
     const row = this.raw
       .prepare(
         `SELECT workflow_id FROM workflow_runs
          WHERE status IN ('active', 'paused')
          ORDER BY started_at DESC
          LIMIT 1`,
       )
       .get() as { workflow_id?: string } | undefined;
     if (!row?.workflow_id) return null;

     // cwd filter: prefer the active workflow only when the init payload's
     // cwd matches the current process cwd (resolved through git root if
     // available). Workflows created before this filter shipped have no
     // cwd in their payload; for those, fall through and return the id
     // (back-compat).
     try {
       const events = this.loadEvents(row.workflow_id);
       const initEvent = events.find((e) => e.event_type === "init");
       const initCwd = (initEvent?.payload as { cwd?: string } | undefined)?.cwd;
       if (typeof initCwd !== "string" || initCwd.length === 0) {
         return row.workflow_id; // no cwd recorded → back-compat
       }
       const currentRoot = resolveProjectRoot(process.cwd());
       const initRoot = resolveProjectRoot(initCwd);
       return currentRoot === initRoot ? row.workflow_id : null;
     } catch {
       return row.workflow_id; // any failure → back-compat
     }
   }
   ```

   Add the helper at the top of the file (or below the class):

   ```typescript
   import { execFileSync } from "node:child_process";
   import { resolve } from "node:path";

   function resolveProjectRoot(cwd: string): string {
     try {
       const out = execFileSync("git", ["rev-parse", "--show-toplevel"], {
         cwd,
         encoding: "utf8",
         stdio: ["ignore", "pipe", "ignore"],
       });
       return out.trim();
     } catch {
       return resolve(cwd);
     }
   }
   ```

5. Run: `pnpm test tests/runtime/brain-event-log-cwd-filter.test.ts` — expected: 3 passing.
6. Run: `pnpm test` — full suite green.

**Verification**: `pnpm test && pnpm build` — green.

---

## Task E: Team workflow handbook

- [ ] **Files**: `docs/<plan-timestamp>_[GUIDE]_workflow-handbook.md` (new)
- [ ] **Est**: 25 minutes

**Steps**

1. Capture timestamp:
   ```bash
   date +"%Y%m%d_%H%M%S"
   # → e.g. 20260510_040000 — use this in the filename below
   ```
2. Write `docs/<TS>_[GUIDE]_workflow-handbook.md` with the structure below. The body is opinionated and team-facing; write it as a reference docfor a dev who has just installed codi and wants to start their first workflow today.

   ````markdown
   # Codi Workflow Handbook

   - **Date**: <ISO date matching TS>
   - **Document**: <TS>\_[GUIDE]\_workflow-handbook.md
   - **Category**: GUIDE
   - **Audience**: developers using codi inside a team

   ## When to use codi

   ```mermaid
   flowchart TD
     Start[New work item] --> Q1{Is something broken?}
     Q1 -- yes --> BugFix[bug-fix workflow]
     Q1 -- no --> Q2{New functionality?}
     Q2 -- yes --> Feature[feature workflow]
     Q2 -- no --> Q3{Module deepen, no behaviour change?}
     Q3 -- yes --> Refactor[refactor workflow]
     Q3 -- no --> Q4{Schema or data migration?}
     Q4 -- yes --> Migration[migration workflow]
     Q4 -- no --> Q5{Bootstrapping a new project?}
     Q5 -- yes --> Project[project workflow]
     Q5 -- no --> Skip[no workflow — single-file fix is fine]
   ```
   ````

   ## Lifecycle

   Every workflow is a phase graph. The phases differ per archetype but the rules are the same.

   ```mermaid
   flowchart LR
     intent --> plan
     plan --> decompose
     decompose --> execute
     execute --> verify
     verify --> done
     verify --> execute
     plan --> abandoned
     execute --> abandoned
     verify --> abandoned
   ```

   - `intent`: state the task; gate `task_described` fires.
   - `plan`: list scope files + write a plan markdown; gates `scope_files_listed` and `plan_artifact_exists` fire.
   - `decompose` / `execute`: implementation work.
   - `verify`: run validation and confirm planned files moved; gates `validation_passes`, `no_unresolved_scope_proposals`, `all_planned_files_modified` fire.
   - `done`: terminal, workflow complete.
   - `abandoned`: terminal, workflow recorded as abandoned with a reason.

   ## CLI cheatsheet

   | Command                                                       | Effect                                                            | Typical phase  |
   | ------------------------------------------------------------- | ----------------------------------------------------------------- | -------------- |
   | `codi workflow run <type> "<task>"`                           | Start a new workflow                                              | beginning      |
   | `codi workflow status`                                        | Show the active workflow's reduced state                          | any            |
   | `codi workflow transition --to <phase>`                       | Propose a phase transition                                        | any            |
   | `codi workflow transition --approve`                          | Approve the pending transition (gates fire here)                  | any            |
   | `codi workflow transition --reject --reason "<text>"`         | Reject the pending transition                                     | any            |
   | `codi workflow scope propose --file <path> --reason "<text>"` | Propose adding a file to scope                                    | plan / execute |
   | `codi workflow scope approve [--file <path>]`                 | Approve a scope proposal                                          | plan / execute |
   | `codi workflow abandon --reason "<text>"`                     | End the workflow without success                                  | any            |
   | `codi workflow recover`                                       | Restore the active pointer to the most recent non-terminal run    | rare           |
   | `codi workflow handover --to <agent>`                         | Hand the workflow to another developer                            | any            |
   | `codi workflow stats`                                         | Aggregate stats across all runs (durations, tokens, gate retries) | review         |

   ## Gates as advisories

   Codi runs deterministic gate checks at every phase transition. The gates are advisory: codi never blocks — it surfaces verdicts to the developer, who decides whether to act on them. The verdict reaches you in three places:
   - **At `transition --approve`** time, on stderr if any gate failed.
   - **In the next `UserPromptSubmit`** as a `<gate-advisory>` block until the next approval clears it.
   - **In the brain UI** as `gate_check_started` and `gate_check_passed/failed` events.

   The six built-in gates:

   | Gate id                         | What it checks                                                    | Suggested action when it fails                                                                                   |
   | ------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
   | `task_described`                | reduced state has a non-empty task                                | set the task at `workflow run` time                                                                              |
   | `scope_files_listed`            | scope.files_in_plan length ≥ 1                                    | run `codi workflow scope propose --file <path> --reason "<why>"` and approve                                     |
   | `plan_artifact_exists`          | docs/ contains a `YYYYMMDD_HHMMSS_[PLAN]_*.md` file               | write the plan markdown using the codi categorized doc convention                                                |
   | `no_unresolved_scope_proposals` | every `scope_expansion_proposed` has a matching approve/reject    | resolve each pending proposal via `codi workflow scope approve` / `codi workflow scope reject --reason "<text>"` |
   | `validation_passes`             | latest `validation_run` event has `exit_code === 0`               | run your validation (`pnpm test`, `pytest`, etc.) and append the result event                                    |
   | `all_planned_files_modified`    | every file in scope has a non-empty `git status --porcelain` line | edit each planned file or remove it from scope                                                                   |

   ## Brain visibility

   Codi's brain is per-user, machine-global at `~/.codi/brain.db`. `codi workflow status` is filtered by your current `cwd` so you only see workflows from the current project. If a workflow is missing from `status`, you started it in a different folder — `cd` there.

   `codi workflow stats` ignores the cwd filter and reports across all your projects.

   ## Iron Laws (4–8) in one paragraph each
   - **Iron Law 4 — Hard gates need 'ok'.** Phase transitions are pending until the developer types the literal "ok" (case-insensitive). "looks good", "yeah", "sure" do not pass.
   - **Iron Law 5 — Pull before patch.** When the brain state is older than 60 seconds before a mutating Edit / Write tool call, codi emits a pull-reminder in the next prompt block. Refresh by reading the brain (any `codi workflow status` call counts).
   - **Iron Law 7 — No commit without approval.** `git commit / push / merge / tag / release` are blocked unless a recent prompt contains one of those verbs verbatim. Type the verb to authorise.
   - **Iron Law 8 — Output mode honours the project preference.** The default is caveman. Type `?` for the current turn only to opt into the verbose mode. Override per project in `.codi/preferences.json`.
   - **Iron Law 9 — Capture everything.** The agent emits `|TYPE: "..."|` markers at the end of any response that detected a canonical capture type. False positives are not tolerated; the brain consolidator deduplicates.

   ## Common pitfalls

   | Symptom                                           | Likely cause                                          | Fix                                                                                               |
   | ------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
   | "Knowledge base missing: docs/CONTEXT.md"         | first workflow run on a fresh project                 | create `docs/CONTEXT.md` with project domain glossary and rerun                                   |
   | "Another workflow is already active"              | a workflow from a previous session is still running   | `codi workflow status` to see which; either continue it or `codi workflow abandon --reason "..."` |
   | `<gate-advisory>` keeps appearing every prompt    | failed gate has not been resolved since last approval | act on the suggested action, then transition through the next phase                               |
   | "git mutation requires explicit approval"         | Iron Law 7                                            | include a commit/push/merge/tag/release verb in your prompt                                       |
   | Status says no active workflow but I just ran one | you `cd`d to a different folder                       | `cd` back to the project root                                                                     |

   ## Supervision contract

   Codi is a recommendation engine. It never blocks. At every `transition --approve`, the developer is the source of truth: the gates surface findings; the developer decides whether to proceed. The role of the dev is:
   1. Read the gate advisory at every approve.
   2. Decide whether the suggested action is worth doing now or deferring.
   3. Track open advisories — every block that keeps appearing is a deferred decision.

   The role of codi is to make the right action visible. The role of the dev is to make the right call.

   ```

   ```

3. Run validate-docs:
   ```bash
   python3 scripts/validate-docs.py 2>&1 | grep workflow-handbook | head -3 || echo "naming valid"
   ```
4. Open the handbook in your editor and proofread the mermaid blocks render.

**Verification**: handbook present, `<filename>` matches the validate-docs convention, mermaid syntax parses (renders in markdown preview).

---

## Task F: Manual smoke test

- [ ] **Files**: none
- [ ] **Est**: 8 minutes

**Steps**

1. Build:
   ```bash
   cd /Users/laht/projects/codi
   pnpm build
   ```
2. Scaffold scratch project:
   ```bash
   SCRATCH=/tmp/codi-fxsmoke-$(date +%s)
   mkdir -p $SCRATCH/docs
   cd $SCRATCH
   git init -q
   git commit --allow-empty -q -m initial
   echo "# context" > docs/CONTEXT.md
   ```
3. Run a feature workflow and observe gate advisories:

   ```bash
   node /Users/laht/projects/codi/dist/cli.js workflow abandon --reason "smoke prep" 2>&1 | tail -2
   node /Users/laht/projects/codi/dist/cli.js workflow run feature "Smoke gate test" 2>&1 | head -5

   # intent → plan: task_described should pass
   node /Users/laht/projects/codi/dist/cli.js workflow transition --to plan 2>&1 | tail -3
   node /Users/laht/projects/codi/dist/cli.js workflow transition --approve 2>&1 | tail -10
   # Expect no stderr advisory (gate passed).

   # plan → decompose: should emit advisory for scope_files_listed + plan_artifact_exists
   node /Users/laht/projects/codi/dist/cli.js workflow transition --to decompose 2>&1 | tail -3
   node /Users/laht/projects/codi/dist/cli.js workflow transition --approve 2>&1 | tail -15
   # Expect [codi gate-advisory] header + 2 gate failure lines on stderr.
   ```

4. Verify the next-turn UserPromptSubmit block emits via the hook:
   ```bash
   echo '{"session_id":"fxsmoke","prompt":"hello","cwd":"'$SCRATCH'"}' \
     | node /Users/laht/projects/codi/dist/cli.js hook user-prompt-submit
   # Expect <gate-advisory>...</gate-advisory> block in stdout.
   ```
5. Verify `workflow status` only sees the scratch workflow:
   ```bash
   cd $SCRATCH && node /Users/laht/projects/codi/dist/cli.js workflow status 2>&1 | grep workflow_id
   # Expect: feat-smoke-gate-test-... (not the codi self-dev workflow)
   cd /Users/laht/projects/codi && node /Users/laht/projects/codi/dist/cli.js workflow status 2>&1 | grep workflow_id
   # Expect: a different id (or "no active workflow").
   ```
6. Cleanup:
   ```bash
   cd /Users/laht/projects/codi
   node /Users/laht/projects/codi/dist/cli.js workflow abandon --reason "smoke cleanup" 2>&1 | tail -2 || true
   rm -rf $SCRATCH
   ```

**Verification**: all four expected outputs observed (advisory at approve, advisory in UserPromptSubmit, cwd-filtered status, both projects independently visible). If any fails, do not proceed to Task G — escalate the failure first.

---

## Task G: Single atomic commit

- [ ] **Files**: all files modified across Tasks A–E + CHANGELOG.md
- [ ] **Est**: 5 minutes

**Steps**

1. Update `CHANGELOG.md` under `## [Unreleased]`. Add a new section above the existing entries:

   ```markdown
   ### Workflow gates wired as advisory + cwd filter + handbook

   #### Added

   - `gate-runner-bridge.ts` connects `gate-runner` to `approveTransition` so phase transitions run the configured deterministic checks.
   - `buildGateAdvisoryBlock` surfaces failed gates in the next `UserPromptSubmit` until the next approval supersedes them.
   - `<TS>_[GUIDE]_workflow-handbook.md` covering decision tree, lifecycle, CLI cheatsheet, gate semantics, brain visibility, Iron Laws summary, common pitfalls, and supervision contract.
   - `gate_check_started` / `gate_check_passed` / `gate_check_failed` events now persisted on every phase transition (previously declared as event types but never emitted).

   #### Changed

   - `approveTransition` no longer hardcodes `gate_passed: true`. The flag in the emitted `phase_completed` event reflects the real verdict.
   - `getActiveWorkflowId()` now filters by current `cwd`. Workflows from other projects on the same machine no longer surface in `codi workflow status`. Back-compat for workflows whose init payload predates the cwd field — they keep returning the active id.
   - `workflow_init` payload now includes `cwd: process.cwd()`.

   #### Fixed

   - Gate-runner code path was unreachable in production; the 6 deterministic checkers now run on every phase transition as advisory.
   ```

2. Stage:
   ```bash
   git add \
     src/runtime/gate-runner-bridge.ts \
     src/runtime/cli-handlers/transitions.ts \
     src/runtime/cli-handlers/workflow.ts \
     src/runtime/brain-event-log.ts \
     src/runtime/hook-logic.ts \
     src/cli/agent-hooks.ts \
     tests/runtime/gate-runner-bridge.test.ts \
     tests/runtime/cli-handlers/transitions-gate-bridge.test.ts \
     tests/runtime/hook-logic-gate-advisory.test.ts \
     tests/runtime/brain-event-log-cwd-filter.test.ts \
     docs/<TS>_[GUIDE]_workflow-handbook.md \
     CHANGELOG.md
   ```
   (Replace `<TS>` with the actual handbook filename from Task E.)
3. Commit:

   ```bash
   git commit -m "feat(workflow): wire gate-runner advisory + cwd filter + team handbook

   - Bridge gate-runner into approveTransition so the 6 deterministic gates
     (task_described, scope_files_listed, plan_artifact_exists,
     no_unresolved_scope_proposals, validation_passes,
     all_planned_files_modified) actually run on every phase transition.
     Verdict is advisory: stderr surfaces suggested actions for the dev,
     gate_check_* events persist for the brain UI, the transition still
     completes regardless. phase_completed.gate_passed now reflects the
     real verdict instead of the hardcoded true.
   - Add buildGateAdvisoryBlock to UserPromptSubmit so the next agent turn
     sees failed gates until the next phase_transition_approved supersedes
     them. Same shape as buildIronLawsBlock.
   - Filter getActiveWorkflowId by current cwd so codi workflow status
     only shows workflows from the current project. workflow_init payload
     now records cwd. Back-compat: workflows without cwd in their payload
     still resolve.
   - New docs/[GUIDE]_workflow-handbook.md covers the decision tree, the
     lifecycle, the CLI cheatsheet, gate semantics, brain visibility,
     Iron Laws 4-9 summary, common pitfalls, and the supervision contract."
   ```

4. Verify the commit landed:
   ```bash
   git log --oneline -3
   ```

**Verification**: single commit on the branch, working tree clean, the four behaviours from Task F still pass with `pnpm build && pnpm test`.

---

## Pre-write self-review (executed)

| Check                                                                                                    | Result                                                         |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Spec coverage — every spec section mapped to a task                                                      | ✅ F-1 (A+B), F-2 (C), F-3 (D), F-6 (E), Smoke (F), Commit (G) |
| Placeholder scan — no TBD / TODO in code blocks                                                          | ✅                                                             |
| Type consistency — `BridgeContext`, `GateRunResult`, `BrainEventLog` referenced identically across tasks | ✅                                                             |
| TDD ordering — every code task writes test before impl                                                   | ✅ A, B, C, D                                                  |
| No per-task commits — single Task G commit at end                                                        | ✅ explicit                                                    |

## Execution

After this plan is approved, hand off to **codi-plan-execution**. That skill will ask whether to execute INLINE (sequential, watch-along) or via SUBAGENT (fresh subagent per task with two-stage review).
