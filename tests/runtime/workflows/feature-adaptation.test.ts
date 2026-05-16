import { describe, it, expect } from "vitest";
import { runWorkflow, abandonWorkflow } from "#src/runtime/cli-handlers.js";
import { unwrap } from "../_brain-helper.js";
import { useTmpBrain, withBrain, human } from "./_setup.js";

const h = useTmpBrain();
const tmpDir = (): string => h.tmpDir();

void abandonWorkflow;

describe("feature adaptive intake (Q11)", () => {
  it("resolveFeatureAdaptation: profile='prototype' enables fast-path", async () => {
    const { resolveFeatureAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = resolveFeatureAdaptation({ profile: "prototype" });
    expect(r.profile).toBe("prototype");
    expect(r.complexity).toBe("trivial");
    expect(r.designExists).toBe(true);
    expect(r.scope).toBe("single");
    expect(r.tddStrict).toBe(false);
  });

  it("resolveFeatureAdaptation: profile='deep' requires grill + subagent", async () => {
    const { resolveFeatureAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = resolveFeatureAdaptation({ profile: "deep" });
    expect(r.complexity).toBe("large");
    expect(r.scope).toBe("multi");
    expect(r.executeMode).toBe("subagent");
    expect(r.grill).toBe(true);
    expect(r.tddStrict).toBe(true);
  });

  it("resolveFeatureAdaptation: explicit overrides win over profile", async () => {
    const { resolveFeatureAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = resolveFeatureAdaptation({
      profile: "standard",
      complexity: "large",
      executeMode: "subagent",
    });
    expect(r.complexity).toBe("large");
    expect(r.executeMode).toBe("subagent");
    expect(r.scope).toBe("multi"); // standard default kept
  });

  it("computeFeatureSkipPhases: 'decompose' when complexity=trivial", async () => {
    const { resolveFeatureAdaptation, computeFeatureSkipPhases } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveFeatureAdaptation({ profile: "prototype" });
    expect(computeFeatureSkipPhases(a)).toContain("decompose");
  });

  it("computeFeatureSkipPhases: 'decompose' when scope=single", async () => {
    const { resolveFeatureAdaptation, computeFeatureSkipPhases } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveFeatureAdaptation({ profile: "standard", scope: "single" });
    expect(computeFeatureSkipPhases(a)).toContain("decompose");
  });

  it("computeFeatureSkipPhases: empty for standard profile multi-scope", async () => {
    const { resolveFeatureAdaptation, computeFeatureSkipPhases } =
      await import("#src/runtime/workflows/index.js");
    expect(computeFeatureSkipPhases(resolveFeatureAdaptation({ profile: "standard" }))).toEqual([]);
  });

  it("computeFeatureNextPhase: prototype skips decompose", async () => {
    const { resolveFeatureAdaptation, computeFeatureNextPhase } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveFeatureAdaptation({ profile: "prototype" });
    expect(computeFeatureNextPhase("plan", a)).toBe("execute");
  });

  it("computeFeatureNextPhase: standard preserves full ordering", async () => {
    const { resolveFeatureAdaptation, computeFeatureNextPhase } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveFeatureAdaptation({ profile: "standard" });
    expect(computeFeatureNextPhase("intent", a)).toBe("plan");
    expect(computeFeatureNextPhase("plan", a)).toBe("decompose");
    expect(computeFeatureNextPhase("decompose", a)).toBe("execute");
    expect(computeFeatureNextPhase("execute", a)).toBe("verify");
    expect(computeFeatureNextPhase("verify", a)).toBe("done");
  });

  it("runWorkflow stores feature_adaptation in init payload", async () => {
    const { resolveFeatureAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "add dark mode",
        author: human,
        cwd: tmpDir(),
        featureAdaptation: resolveFeatureAdaptation({ profile: "deep" }),
      }),
    );
    withBrain(tmpDir(), (log) => {
      const events = log.loadEvents(r.workflowId);
      const init = events.find((e) => e.event_type === "init");
      const payload = init?.payload as {
        feature_adaptation?: { profile?: string; complexity?: string; grill?: boolean };
      };
      expect(payload.feature_adaptation?.profile).toBe("deep");
      expect(payload.feature_adaptation?.complexity).toBe("large");
      expect(payload.feature_adaptation?.grill).toBe(true);
    });
  });
});
