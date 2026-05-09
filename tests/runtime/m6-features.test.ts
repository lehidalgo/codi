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
import { createIsolatedBrain, type IsolatedBrain } from "./_brain-helper.js";

const human: Author = { type: "human", id: "tester" };
const maintainer: Author = { type: "human", id: "maintainer" };

describe("handover", () => {
  let scope: IsolatedBrain;
  let dir: string;

  beforeEach(() => {
    scope = createIsolatedBrain("codi-m6-");
    dir = scope.dir;
    runWorkflow({
      workflowType: "feature",
      task: "Test handover",
      author: human,
      cwd: dir,
    });
  });

  afterEach(() => {
    scope.dispose();
  });

  it("transfers ownership", () => {
    const result = handover({
      toDevId: "ana@example.com",
      reason: "vacation",
      author: human,
      cwd: dir,
    });
    expect(result.fromDevId).toBe("tester");
    expect(result.toDevId).toBe("ana@example.com");

    const status = getStatus({ cwd: dir });
    expect(status.state?.current_owner).toBe("ana@example.com");
  });

  it("rejects empty to or reason", () => {
    expect(() => handover({ toDevId: "", reason: "x", author: human, cwd: dir })).toThrow(
      "requires --to",
    );
    expect(() => handover({ toDevId: "x", reason: "", author: human, cwd: dir })).toThrow(
      "requires --reason",
    );
  });

  it("rejects handover after abandon clears active workflow", () => {
    abandonWorkflow({ reason: "test", author: human, cwd: dir });
    expect(() => handover({ toDevId: "ana", reason: "vacation", author: human, cwd: dir })).toThrow(
      "No active workflow",
    );
  });

  it("force-handover transfers with maintainer authority", () => {
    forceHandover({
      toDevId: "ana@example.com",
      maintainerId: "maintainer",
      reason: "developer left company",
      author: maintainer,
      cwd: dir,
    });
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
    runWorkflow({
      workflowType: "feature",
      task: "First",
      author: human,
      cwd: dir,
    });
    abandonWorkflow({ reason: "test", author: human, cwd: dir });
    runWorkflow({
      workflowType: "bug-fix",
      task: "Second",
      author: human,
      cwd: dir,
    });

    const stats = computeWorkflowStats({ cwd: dir });
    expect(stats.durations.workflowCount).toBe(2);
    expect(stats.byWorkflowType.feature).toBe(1);
    expect(stats.byWorkflowType["bug-fix"]).toBe(1);
  });

  it("aggregates durations", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Test",
      author: human,
      cwd: dir,
    });
    abandonWorkflow({ reason: "test", author: human, cwd: dir });

    const stats = computeWorkflowStats({ cwd: dir });
    expect(stats.durations.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(stats.durations.averageDurationMs).toBeGreaterThanOrEqual(0);
  });
});
