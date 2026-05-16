import { describe, it, expect } from "vitest";
import { runWorkflow, abandonWorkflow } from "#src/runtime/cli-handlers.js";
import { unwrap } from "../_brain-helper.js";
import { useTmpBrain, withBrain, human } from "./_setup.js";

const h = useTmpBrain();
const tmpDir = (): string => h.tmpDir();

void abandonWorkflow;

describe("project adaptive intake (Q14)", () => {
  it("resolveProjectAdaptation: profile='no-sheet' skips sync", async () => {
    const { resolveProjectAdaptation, computeProjectSkipPhases } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveProjectAdaptation({ profile: "no-sheet" });
    expect(a.noSheet).toBe(true);
    expect(computeProjectSkipPhases(a)).toContain("sync");
  });

  it("computeProjectNextPhase: no-sheet jumps decompose to done", async () => {
    const { resolveProjectAdaptation, computeProjectNextPhase } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveProjectAdaptation({ profile: "no-sheet" });
    expect(computeProjectNextPhase("decompose", a)).toBe("done");
  });

  it("runWorkflow stores project_adaptation in init payload", async () => {
    const { resolveProjectAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = unwrap(
      runWorkflow({
        workflowType: "project",
        task: "bootstrap saas v2",
        author: human,
        cwd: tmpDir(),
        projectAdaptation: resolveProjectAdaptation({ profile: "no-sheet" }),
      }),
    );
    withBrain(tmpDir(), (log) => {
      const events = log.loadEvents(r.workflowId);
      const init = events.find((e) => e.event_type === "init");
      const payload = init?.payload as { project_adaptation?: { no_sheet?: boolean } };
      expect(payload.project_adaptation?.no_sheet).toBe(true);
    });
  });
});
