import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { evaluateToolCall, buildContext, type ToolCall } from "#src/runtime/hook-logic.js";
import { runWorkflow, proposeTransition, approveTransition } from "#src/runtime/cli-handlers.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { createEvent } from "#src/runtime/event-factory.js";
import type { Author } from "#src/runtime/types.js";

const human: Author = { type: "human", id: "tester" };

function bootstrapKb(dir: string): void {
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# Context\n", "utf-8");
}

function setupActiveWorkflow(dir: string): void {
  bootstrapKb(dir);
  runWorkflow({
    workflowType: "feature",
    task: "Test",
    author: human,
    cwd: dir,
  });
  // Move to execute phase so file edits are evaluated by classifier
  proposeTransition({ toPhase: "plan", author: human, cwd: dir });
  approveTransition({ author: human, cwd: dir });
  proposeTransition({ toPhase: "decompose", author: human, cwd: dir });
  approveTransition({ author: human, cwd: dir });
  proposeTransition({ toPhase: "execute", author: human, cwd: dir });
  approveTransition({ author: human, cwd: dir });
}

function addToScope(_dir: string, files: string[]): void {
  const log = BrainEventLog.open();
  try {
    const id = log.getActiveWorkflowId();
    if (!id) throw new Error("no active workflow");
    log.append(
      id,
      createEvent({
        eventType: "scope_expansion_approved",
        payload: { file_path: files[0] ?? "x", added_to_scope: files },
        author: human,
        parentEventId: null,
      }),
    );
  } finally {
    log.dispose();
  }
}

let prevBrainDb: string | undefined;
function isolateBrain(dir: string): void {
  prevBrainDb = process.env["CODI_BRAIN_DB"];
  process.env["CODI_BRAIN_DB"] = join(dir, "brain.db");
}
function restoreBrain(): void {
  if (prevBrainDb === undefined) delete process.env["CODI_BRAIN_DB"];
  else process.env["CODI_BRAIN_DB"] = prevBrainDb;
}
/** Run cb with the brain re-pointed at `dir/brain.db`, then restore. */
function withFreshBrain<T>(dir: string, cb: () => T): T {
  const saved = process.env["CODI_BRAIN_DB"];
  process.env["CODI_BRAIN_DB"] = join(dir, "brain.db");
  try {
    return cb();
  } finally {
    if (saved === undefined) delete process.env["CODI_BRAIN_DB"];
    else process.env["CODI_BRAIN_DB"] = saved;
  }
}

describe("evaluateToolCall — pass-through cases", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-hook-test-"));
    isolateBrain(tmpDir);
  });

  afterEach(() => {
    restoreBrain();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("allows when no active workflow", () => {
    const ctx = buildContext(tmpDir);
    expect(ctx.state).toBeNull();
    const decision = evaluateToolCall(
      { tool_name: "Edit", tool_input: { file_path: "anything" } },
      ctx,
    );
    expect(decision.allow).toBe(true);
  });

  it("allows Read tool always (not in switch)", () => {
    setupActiveWorkflow(tmpDir);
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      { tool_name: "Read", tool_input: { file_path: "src/x.ts" } },
      ctx,
    );
    expect(decision.allow).toBe(true);
  });
});

describe("evaluateToolCall — file edits", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-hook-edit-"));
    isolateBrain(tmpDir);
    setupActiveWorkflow(tmpDir);
  });

  afterEach(() => {
    restoreBrain();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("allows edits to files in scope", () => {
    addToScope(tmpDir, ["src/in-scope.ts"]);
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      {
        tool_name: "Edit",
        tool_input: { file_path: "src/in-scope.ts", old_string: "", new_string: "" },
      },
      ctx,
    );
    expect(decision.allow).toBe(true);
  });

  it("advises on edits to test files (always scope-expansion)", () => {
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      {
        tool_name: "Edit",
        tool_input: { file_path: "src/foo.test.ts" },
      },
      ctx,
    );
    expect(decision.allow).toBe(true);
    if (decision.allow) {
      expect(decision.advisories).toBeDefined();
      const joined = (decision.advisories ?? []).join(" | ");
      expect(joined).toContain("not in the plan");
      expect(joined).toContain("scope propose");
    }
  });

  it("advises elevation for migration files", () => {
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      {
        tool_name: "Write",
        tool_input: {
          file_path: "migrations/001_init.sql",
          content: "CREATE TABLE x();",
        },
      },
      ctx,
    );
    expect(decision.allow).toBe(true);
    if (decision.allow) {
      expect(decision.advisories).toBeDefined();
      const joined = (decision.advisories ?? []).join(" | ");
      expect(joined).toContain("elevation");
      expect(joined).toContain("migration");
    }
  });

  it("advises on edits in pre-execute phases (intent, plan, decompose)", () => {
    // Fresh workflow stays in intent
    const fresh = mkdtempSync(join(tmpdir(), "codi-fresh-"));
    try {
      withFreshBrain(fresh, () => {
        bootstrapKb(fresh);
        runWorkflow({ workflowType: "feature", task: "x", author: human, cwd: fresh });
        const ctx = buildContext(fresh);
        const decision = evaluateToolCall(
          {
            tool_name: "Edit",
            tool_input: { file_path: "src/anything.ts" },
          },
          ctx,
        );
        expect(decision.allow).toBe(true);
        if (decision.allow) {
          expect(decision.advisories).toBeDefined();
          const joined = (decision.advisories ?? []).join(" | ");
          expect(joined).toContain("phase intent");
          expect(joined).toContain("transition --to execute");
        }
      });
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it("permits writes to .codi/project.json in any phase (workflow-state artifact)", () => {
    // Fresh workflow stays in intent — this would normally block file edits
    const fresh = mkdtempSync(join(tmpdir(), "codi-state-"));
    try {
      withFreshBrain(fresh, () => {
        bootstrapKb(fresh);
        runWorkflow({ workflowType: "project", task: "bootstrap acme", author: human, cwd: fresh });
        const ctx = buildContext(fresh);
        const decision = evaluateToolCall(
          {
            tool_name: "Write",
            tool_input: {
              file_path: ".codi/project.json",
              content: '{"project_name":"acme","sheet_id":"X","sheet_template_version":1}',
            },
          },
          ctx,
        );
        expect(decision.allow).toBe(true);
        if (decision.allow) {
          expect(decision.reason ?? "").toContain("codi-state");
        }
      });
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it("permits writes to .codi/draft/discover.json (nested) in any phase", () => {
    const fresh = mkdtempSync(join(tmpdir(), "codi-draft-"));
    try {
      withFreshBrain(fresh, () => {
        bootstrapKb(fresh);
        runWorkflow({ workflowType: "project", task: "x", author: human, cwd: fresh });
        const ctx = buildContext(fresh);
        const decision = evaluateToolCall(
          {
            tool_name: "Write",
            tool_input: {
              file_path: ".codi/draft/discover.json",
              content: '{"BusinessGoal":[]}',
            },
          },
          ctx,
        );
        expect(decision.allow).toBe(true);
      });
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it("permits writes to .gitignore in any phase", () => {
    const fresh = mkdtempSync(join(tmpdir(), "codi-gi-"));
    try {
      withFreshBrain(fresh, () => {
        bootstrapKb(fresh);
        runWorkflow({ workflowType: "feature", task: "x", author: human, cwd: fresh });
        const ctx = buildContext(fresh);
        const decision = evaluateToolCall(
          {
            tool_name: "Write",
            tool_input: {
              file_path: ".gitignore",
              content: ".workflow/\n",
            },
          },
          ctx,
        );
        expect(decision.allow).toBe(true);
      });
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it("permits writes to .codi/sheets-queue.jsonl in any phase", () => {
    const fresh = mkdtempSync(join(tmpdir(), "codi-queue-"));
    try {
      withFreshBrain(fresh, () => {
        bootstrapKb(fresh);
        runWorkflow({ workflowType: "feature", task: "x", author: human, cwd: fresh });
        const ctx = buildContext(fresh);
        const decision = evaluateToolCall(
          {
            tool_name: "Write",
            tool_input: {
              file_path: ".codi/sheets-queue.jsonl",
              content: '{"queue_id":"q1"}\n',
            },
          },
          ctx,
        );
        expect(decision.allow).toBe(true);
      });
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it("permits Write with import-only content as incidental", () => {
    // Create file with existing content
    writeFileSync(join(tmpDir, "src.ts"), "function existing() {}\n", "utf-8");
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(join(tmpDir, "src", "utils.ts"), "function existing() {}\n", "utf-8");
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      {
        tool_name: "Write",
        tool_input: {
          file_path: "src/utils.ts",
          content: 'import { x } from "./x";\nfunction existing() {}\n',
        },
      },
      ctx,
    );
    expect(decision.allow).toBe(true);
  });
});

describe("evaluateToolCall — Bash commands", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-hook-bash-"));
    isolateBrain(tmpDir);
    setupActiveWorkflow(tmpDir);
  });

  afterEach(() => {
    restoreBrain();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("advises on git push in execute phase", () => {
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      { tool_name: "Bash", tool_input: { command: "git push origin main" } },
      ctx,
    );
    expect(decision.allow).toBe(true);
    if (decision.allow) {
      expect(decision.advisories).toBeDefined();
      const joined = (decision.advisories ?? []).join(" | ");
      expect(joined).toContain("git push");
    }
  });

  it("advises on gh pr create before phase done", () => {
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      { tool_name: "Bash", tool_input: { command: "gh pr create --title x" } },
      ctx,
    );
    expect(decision.allow).toBe(true);
    if (decision.allow) {
      expect(decision.advisories).toBeDefined();
      const joined = (decision.advisories ?? []).join(" | ");
      expect(joined).toContain("PR creation");
    }
  });

  it("blocks rm -rf / always", () => {
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      { tool_name: "Bash", tool_input: { command: "rm -rf /" } },
      ctx,
    );
    expect(decision.allow).toBe(false);
  });

  it("blocks git reset --hard always", () => {
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      { tool_name: "Bash", tool_input: { command: "git reset --hard HEAD~1" } },
      ctx,
    );
    expect(decision.allow).toBe(false);
  });

  it("blocks git push --force always", () => {
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      { tool_name: "Bash", tool_input: { command: "git push --force origin main" } },
      ctx,
    );
    expect(decision.allow).toBe(false);
  });

  it("permits safe Bash commands", () => {
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      { tool_name: "Bash", tool_input: { command: "pnpm test" } },
      ctx,
    );
    expect(decision.allow).toBe(true);
  });

  it("permits git status, log, diff", () => {
    const ctx = buildContext(tmpDir);
    for (const cmd of ["git status", "git log --oneline", "git diff HEAD"]) {
      const decision = evaluateToolCall({ tool_name: "Bash", tool_input: { command: cmd } }, ctx);
      expect(decision.allow, `Should permit: ${cmd}`).toBe(true);
    }
  });
});
