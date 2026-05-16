import { describe, it, expect } from "vitest";
import { runWorkflow, abandonWorkflow } from "#src/runtime/cli-handlers.js";
import { unwrap } from "../_brain-helper.js";
import { useTmpBrain, withBrain, human } from "./_setup.js";

const h = useTmpBrain();
const tmpDir = (): string => h.tmpDir();

void abandonWorkflow;

describe("migration adaptive intake (Q13)", () => {
  it("resolveMigrationAdaptation: profile='schema' is low-risk + rollback-tested", async () => {
    const { resolveMigrationAdaptation, computeMigrationSkipPhases } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveMigrationAdaptation({ profile: "schema" });
    expect(a.riskLevel).toBe("low");
    expect(a.rollbackTested).toBe(true);
    expect(computeMigrationSkipPhases(a)).toContain("data-validation");
  });

  it("computeMigrationNextPhase: schema profile skips data-validation", async () => {
    const { resolveMigrationAdaptation, computeMigrationNextPhase } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveMigrationAdaptation({ profile: "schema" });
    expect(computeMigrationNextPhase("execute", a)).toBe("verify");
  });

  it("runWorkflow stores migration_adaptation in init payload", async () => {
    const { resolveMigrationAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = unwrap(
      runWorkflow({
        workflowType: "migration",
        task: "add index",
        author: human,
        cwd: tmpDir(),
        migrationAdaptation: resolveMigrationAdaptation({ profile: "schema" }),
      }),
    );
    withBrain(tmpDir(), (log) => {
      const events = log.loadEvents(r.workflowId);
      const init = events.find((e) => e.event_type === "init");
      const payload = init?.payload as { migration_adaptation?: { risk_level?: string } };
      expect(payload.migration_adaptation?.risk_level).toBe("low");
    });
  });
});
