import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  runWorkflow,
  proposeScopeExpansion,
  approveScopeExpansion,
  rejectScopeExpansion,
  recordIncidentalChange,
  getStatus,
} from "#src/runtime/cli-handlers.js";
import type { Author } from "#src/runtime/types.js";
import { createIsolatedBrain, unwrap, type IsolatedBrain } from "./_brain-helper.js";

const human: Author = { type: "human", id: "tester" };
const agent: Author = { type: "agent", id: "claude-code" };

function setup(): { scope: IsolatedBrain; dir: string } {
  const scope = createIsolatedBrain("codi-scope-");
  unwrap(
    runWorkflow({
      workflowType: "feature",
      task: "Test scope",
      author: human,
      cwd: scope.dir,
    }),
  );
  return { scope, dir: scope.dir };
}

describe("scope expansion handlers", () => {
  let scope: IsolatedBrain;
  let dir: string;

  beforeEach(() => {
    ({ scope, dir } = setup());
  });

  afterEach(() => {
    scope.dispose();
  });

  it("proposes a scope expansion", () => {
    const result = unwrap(
      proposeScopeExpansion({
        filePath: "src/new.ts",
        reason: "needed for feature",
        author: agent,
        cwd: dir,
      }),
    );
    expect(result.filePath).toBe("src/new.ts");
    expect(result.proposedEventId).toBeTruthy();
  });

  it("rejects propose with empty reason", () => {
    const r = proposeScopeExpansion({
      filePath: "src/x.ts",
      reason: "",
      author: agent,
      cwd: dir,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_REASON_REQUIRED");
  });

  it("rejects propose with empty file path", () => {
    const r = proposeScopeExpansion({
      filePath: "",
      reason: "x",
      author: agent,
      cwd: dir,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_SCOPE_FILE_REQUIRED");
  });

  it("rejects propose for file already in plan", () => {
    unwrap(
      proposeScopeExpansion({
        filePath: "src/x.ts",
        reason: "first",
        author: agent,
        cwd: dir,
      }),
    );
    unwrap(approveScopeExpansion({ author: human, cwd: dir }));
    const r = proposeScopeExpansion({
      filePath: "src/x.ts",
      reason: "second",
      author: agent,
      cwd: dir,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_SCOPE_FILE_ALREADY_IN");
  });

  it("approves the latest unresolved proposal", () => {
    unwrap(
      proposeScopeExpansion({
        filePath: "src/a.ts",
        reason: "a",
        author: agent,
        cwd: dir,
      }),
    );
    const result = unwrap(approveScopeExpansion({ author: human, cwd: dir }));
    expect(result.filePath).toBe("src/a.ts");

    const status = getStatus({ cwd: dir });
    expect(status.state?.scope.files_in_plan).toContain("src/a.ts");
    expect(status.state?.scope.scope_expansions_approved).toBe(1);
  });

  it("approves a specific proposal by --file when multiple pending", () => {
    unwrap(
      proposeScopeExpansion({
        filePath: "src/a.ts",
        reason: "a",
        author: agent,
        cwd: dir,
      }),
    );
    unwrap(
      proposeScopeExpansion({
        filePath: "src/b.ts",
        reason: "b",
        author: agent,
        cwd: dir,
      }),
    );
    const result = unwrap(
      approveScopeExpansion({
        filePath: "src/a.ts",
        author: human,
        cwd: dir,
      }),
    );
    expect(result.filePath).toBe("src/a.ts");

    const status = getStatus({ cwd: dir });
    expect(status.state?.scope.files_in_plan).toEqual(["src/a.ts"]);
  });

  it("rejects approve when no proposal pending", () => {
    const r = approveScopeExpansion({ author: human, cwd: dir });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_PROPOSAL_NOT_PENDING");
  });

  it("rejects scope rejection", () => {
    unwrap(
      proposeScopeExpansion({
        filePath: "src/x.ts",
        reason: "x",
        author: agent,
        cwd: dir,
      }),
    );
    unwrap(
      rejectScopeExpansion({
        reason: "out of scope",
        author: human,
        cwd: dir,
      }),
    );

    const status = getStatus({ cwd: dir });
    expect(status.state?.scope.scope_expansions_rejected).toBe(1);
    expect(status.state?.scope.files_in_plan).toEqual([]);
  });

  it("rejects reject without reason", () => {
    unwrap(
      proposeScopeExpansion({
        filePath: "src/x.ts",
        reason: "x",
        author: agent,
        cwd: dir,
      }),
    );
    const r = rejectScopeExpansion({ reason: "", author: human, cwd: dir });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_REASON_REQUIRED");
  });

  it("a rejected proposal can be re-proposed and approved", () => {
    unwrap(
      proposeScopeExpansion({
        filePath: "src/x.ts",
        reason: "first",
        author: agent,
        cwd: dir,
      }),
    );
    unwrap(
      rejectScopeExpansion({
        reason: "wait",
        author: human,
        cwd: dir,
      }),
    );
    unwrap(
      proposeScopeExpansion({
        filePath: "src/x.ts",
        reason: "now needed",
        author: agent,
        cwd: dir,
      }),
    );
    unwrap(approveScopeExpansion({ author: human, cwd: dir }));

    const status = getStatus({ cwd: dir });
    expect(status.state?.scope.files_in_plan).toContain("src/x.ts");
    expect(status.state?.scope.scope_expansions_approved).toBe(1);
    expect(status.state?.scope.scope_expansions_rejected).toBe(1);
  });
});

describe("incidental change recording", () => {
  let scope: IsolatedBrain;
  let dir: string;

  beforeEach(() => {
    ({ scope, dir } = setup());
  });

  afterEach(() => {
    scope.dispose();
  });

  it("appends an incidental_change_recorded event", () => {
    unwrap(
      recordIncidentalChange({
        filePath: "src/utils.ts",
        linesChanged: 1,
        classifierReason: "imports only",
        author: { type: "system", id: "post-tool-use-hook" },
        cwd: dir,
      }),
    );
    const status = getStatus({ cwd: dir });
    expect(status.state?.scope.incidental_changes).toBe(1);
  });

  it("counts multiple incidentals", () => {
    for (const f of ["a.ts", "b.ts", "c.ts"]) {
      unwrap(
        recordIncidentalChange({
          filePath: f,
          linesChanged: 1,
          classifierReason: "imports only",
          author: { type: "system", id: "post-tool-use-hook" },
          cwd: dir,
        }),
      );
    }
    const status = getStatus({ cwd: dir });
    expect(status.state?.scope.incidental_changes).toBe(3);
  });
});
