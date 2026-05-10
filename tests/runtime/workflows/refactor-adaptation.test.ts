import { describe, it, expect } from "vitest";
import { runWorkflow, abandonWorkflow } from "#src/runtime/cli-handlers.js";
import { useTmpBrain, withBrain, human } from "./_setup.js";

const h = useTmpBrain();
const tmpDir = (): string => h.tmpDir();

void abandonWorkflow;

describe("refactor adaptive intake (Q12)", () => {
  it("resolveRefactorAdaptation: profile='deadcode' skips baseline", async () => {
    const { resolveRefactorAdaptation, computeRefactorSkipPhases } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveRefactorAdaptation({ profile: "deadcode" });
    expect(a.kind).toBe("deadcode");
    expect(computeRefactorSkipPhases(a)).toContain("baseline");
  });

  it("resolveRefactorAdaptation: profile='deep' grills + subagent", async () => {
    const { resolveRefactorAdaptation } = await import("#src/runtime/workflows/index.js");
    const a = resolveRefactorAdaptation({ profile: "deep" });
    expect(a.kind).toBe("deepen");
    expect(a.executeMode).toBe("subagent");
    expect(a.grill).toBe(true);
  });

  it("computeRefactorNextPhase: deadcode jumps from intent to plan", async () => {
    const { resolveRefactorAdaptation, computeRefactorNextPhase } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveRefactorAdaptation({ profile: "deadcode" });
    expect(computeRefactorNextPhase("intent", a)).toBe("plan");
  });

  it("runWorkflow stores refactor_adaptation in init payload", async () => {
    const { resolveRefactorAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = runWorkflow({
      workflowType: "refactor",
      task: "extract module x",
      author: human,
      cwd: tmpDir(),
      refactorAdaptation: resolveRefactorAdaptation({ profile: "deep" }),
    });
    withBrain(tmpDir(), (log) => {
      const events = log.loadEvents(r.workflowId);
      const init = events.find((e) => e.event_type === "init");
      const payload = init?.payload as { refactor_adaptation?: { kind?: string } };
      expect(payload.refactor_adaptation?.kind).toBe("deepen");
    });
  });
});
