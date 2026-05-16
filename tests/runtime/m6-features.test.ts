import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  runWorkflow,
  handover,
  forceHandover,
  abandonWorkflow,
  getStatus,
  computeWorkflowStats,
} from "#src/runtime/cli-handlers.js";
import type { Author } from "#src/runtime/types.js";
import { createIsolatedBrain, unwrap, type IsolatedBrain } from "./_brain-helper.js";

const human: Author = { type: "human", id: "tester" };
const maintainer: Author = { type: "human", id: "maintainer" };

describe("handover", () => {
  let scope: IsolatedBrain;
  let dir: string;

  beforeEach(() => {
    scope = createIsolatedBrain("codi-m6-");
    dir = scope.dir;
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "Test handover",
        author: human,
        cwd: dir,
      }),
    );
  });

  afterEach(() => {
    scope.dispose();
  });

  it("transfers ownership", () => {
    const result = unwrap(
      handover({
        toDevId: "ana@example.com",
        reason: "vacation",
        author: human,
        cwd: dir,
      }),
    );
    expect(result.fromDevId).toBe("tester");
    expect(result.toDevId).toBe("ana@example.com");

    const status = getStatus({ cwd: dir });
    expect(status.state?.current_owner).toBe("ana@example.com");
  });

  it("rejects empty to or reason", () => {
    const r1 = handover({ toDevId: "", reason: "x", author: human, cwd: dir });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors[0]?.code).toBe("E_HANDOVER_TO_REQUIRED");
    const r2 = handover({ toDevId: "x", reason: "", author: human, cwd: dir });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors[0]?.code).toBe("E_REASON_REQUIRED");
  });

  it("rejects handover after abandon clears active workflow", () => {
    unwrap(abandonWorkflow({ reason: "test", author: human, cwd: dir }));
    const r = handover({ toDevId: "ana", reason: "vacation", author: human, cwd: dir });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_NO_ACTIVE_WORKFLOW");
  });

  it("force-handover transfers with maintainer authority", () => {
    unwrap(
      forceHandover({
        toDevId: "ana@example.com",
        maintainerId: "maintainer",
        reason: "developer left company",
        author: maintainer,
        cwd: dir,
      }),
    );
    const status = getStatus({ cwd: dir });
    expect(status.state?.current_owner).toBe("ana@example.com");
  });
});

describe("stats", () => {
  let scope: IsolatedBrain;
  let dir: string;

  beforeEach(() => {
    scope = createIsolatedBrain("codi-m6-");
    dir = scope.dir;
  });

  afterEach(() => {
    scope.dispose();
  });

  it("returns zeros when no archives", () => {
    const stats = computeWorkflowStats({ cwd: dir });
    expect(stats.durations.workflowCount).toBe(0);
    expect(stats.tokens.totalTokens).toBe(0);
    expect(stats.retries.failureRate).toBe(0);
  });

  it("counts workflows in archives", () => {
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "First",
        author: human,
        cwd: dir,
      }),
    );
    unwrap(abandonWorkflow({ reason: "test", author: human, cwd: dir }));
    unwrap(
      runWorkflow({
        workflowType: "bug-fix",
        task: "Second",
        author: human,
        cwd: dir,
      }),
    );

    const stats = computeWorkflowStats({ cwd: dir });
    expect(stats.durations.workflowCount).toBe(2);
    expect(stats.byWorkflowType.feature).toBe(1);
    expect(stats.byWorkflowType["bug-fix"]).toBe(1);
  });

  it("aggregates durations", () => {
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "Test",
        author: human,
        cwd: dir,
      }),
    );
    unwrap(abandonWorkflow({ reason: "test", author: human, cwd: dir }));

    const stats = computeWorkflowStats({ cwd: dir });
    expect(stats.durations.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(stats.durations.averageDurationMs).toBeGreaterThanOrEqual(0);
  });
});
