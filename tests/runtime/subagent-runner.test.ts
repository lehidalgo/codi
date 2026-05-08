import { describe, it, expect } from "vitest";
import {
  runSubagent,
  SubagentSchemaError,
  SubagentTimeoutError,
} from "#src/runtime/subagent-runner.js";
import type { GateResult } from "#src/runtime/gate-types.js";

describe("runSubagent", () => {
  it("accepts a valid GateResult from the dispatcher", async () => {
    const result = await runSubagent({
      skillName: "gate-test",
      inputs: { foo: "bar" },
      dispatch: async () => {
        const r: GateResult = {
          check_id: "test_check",
          verdict: "pass",
          summary: "ok",
        };
        return r;
      },
    });
    expect(result.verdict).toBe("pass");
    expect(result.check_id).toBe("test_check");
  });

  it("rejects malformed output (missing check_id)", async () => {
    await expect(
      runSubagent({
        skillName: "gate-test",
        inputs: {},
        retryOnSchemaFailure: false,
        dispatch: async () => ({ verdict: "pass" }), // missing check_id
      }),
    ).rejects.toBeInstanceOf(SubagentSchemaError);
  });

  it("rejects malformed output (invalid verdict value)", async () => {
    await expect(
      runSubagent({
        skillName: "gate-test",
        inputs: {},
        retryOnSchemaFailure: false,
        dispatch: async () => ({ check_id: "x", verdict: "maybe" }),
      }),
    ).rejects.toBeInstanceOf(SubagentSchemaError);
  });

  it("retries once on schema failure when allowed", async () => {
    let calls = 0;
    const result = await runSubagent({
      skillName: "gate-test",
      inputs: {},
      dispatch: async () => {
        calls += 1;
        if (calls === 1) return { verdict: "pass" }; // missing check_id
        return { check_id: "x", verdict: "pass" };
      },
    });
    expect(calls).toBe(2);
    expect(result.verdict).toBe("pass");
  });

  it("times out if dispatch never resolves", async () => {
    await expect(
      runSubagent({
        skillName: "gate-slow",
        inputs: {},
        timeoutMs: 50,
        retryOnSchemaFailure: false,
        dispatch: () =>
          new Promise(() => {
            /* never resolves */
          }),
      }),
    ).rejects.toBeInstanceOf(SubagentTimeoutError);
  });

  it("propagates timeout details", async () => {
    try {
      await runSubagent({
        skillName: "gate-slow",
        inputs: {},
        timeoutMs: 30,
        retryOnSchemaFailure: false,
        dispatch: () => new Promise(() => {}),
      });
      throw new Error("expected throw");
    } catch (err) {
      if (err instanceof SubagentTimeoutError) {
        expect(err.skillName).toBe("gate-slow");
        expect(err.timeoutMs).toBe(30);
      } else {
        throw err;
      }
    }
  });
});
