import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { evaluateToolCall, buildContext, type ToolCall } from "../lib/hook-logic.js";
import { runWorkflow, proposeTransition, approveTransition } from "../lib/cli-handlers.js";
import { EventLog } from "../lib/event-log.js";
import { createEvent } from "../lib/event-factory.js";
import type { Author } from "../lib/types.js";

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

function addToScope(dir: string, files: string[]): void {
  const log = EventLog.fromCwd(dir);
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
}

describe("evaluateToolCall — pass-through cases", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "devloop-hook-test-"));
  });

  afterEach(() => {
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
    tmpDir = mkdtempSync(join(tmpdir(), "devloop-hook-edit-"));
    setupActiveWorkflow(tmpDir);
  });

  afterEach(() => {
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

  it("blocks edits to test files (always scope-expansion)", () => {
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      {
        tool_name: "Edit",
        tool_input: { file_path: "src/foo.test.ts" },
      },
      ctx,
    );
    expect(decision.allow).toBe(false);
    if (!decision.allow) {
      expect(decision.reason).toContain("not in the plan");
      expect(decision.suggested_action).toContain("propose-expansion");
    }
  });

  it("suggests elevation for migration files", () => {
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
    expect(decision.allow).toBe(false);
    if (!decision.allow) {
      expect(decision.suggested_action).toContain("elevation");
      expect(decision.suggested_action).toContain("migration");
    }
  });

  it("blocks edits in pre-execute phases (intent, plan, decompose)", () => {
    // Fresh workflow stays in intent
    const fresh = mkdtempSync(join(tmpdir(), "devloop-fresh-"));
    try {
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
      expect(decision.allow).toBe(false);
      if (!decision.allow) {
        expect(decision.reason).toContain("phase intent");
        expect(decision.suggested_action).toContain("transition --to execute");
      }
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it("permits writes to .devloop/project.json in any phase (workflow-state artifact)", () => {
    // Fresh workflow stays in intent — this would normally block file edits
    const fresh = mkdtempSync(join(tmpdir(), "devloop-state-"));
    try {
      bootstrapKb(fresh);
      runWorkflow({ workflowType: "project", task: "bootstrap acme", author: human, cwd: fresh });
      const ctx = buildContext(fresh);
      const decision = evaluateToolCall(
        {
          tool_name: "Write",
          tool_input: {
            file_path: ".devloop/project.json",
            content: '{"project_name":"acme","sheet_id":"X","sheet_template_version":1}',
          },
        },
        ctx,
      );
      expect(decision.allow).toBe(true);
      if (decision.allow) {
        expect(decision.reason ?? "").toContain("devloop-state");
      }
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it("permits writes to .devloop/draft/discover.json (nested) in any phase", () => {
    const fresh = mkdtempSync(join(tmpdir(), "devloop-draft-"));
    try {
      bootstrapKb(fresh);
      runWorkflow({ workflowType: "project", task: "x", author: human, cwd: fresh });
      const ctx = buildContext(fresh);
      const decision = evaluateToolCall(
        {
          tool_name: "Write",
          tool_input: {
            file_path: ".devloop/draft/discover.json",
            content: '{"BusinessGoal":[]}',
          },
        },
        ctx,
      );
      expect(decision.allow).toBe(true);
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it("permits writes to .gitignore in any phase", () => {
    const fresh = mkdtempSync(join(tmpdir(), "devloop-gi-"));
    try {
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
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it("permits writes to .devloop/sheets-queue.jsonl in any phase", () => {
    const fresh = mkdtempSync(join(tmpdir(), "devloop-queue-"));
    try {
      bootstrapKb(fresh);
      runWorkflow({ workflowType: "feature", task: "x", author: human, cwd: fresh });
      const ctx = buildContext(fresh);
      const decision = evaluateToolCall(
        {
          tool_name: "Write",
          tool_input: {
            file_path: ".devloop/sheets-queue.jsonl",
            content: '{"queue_id":"q1"}\n',
          },
        },
        ctx,
      );
      expect(decision.allow).toBe(true);
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
    tmpDir = mkdtempSync(join(tmpdir(), "devloop-hook-bash-"));
    setupActiveWorkflow(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("blocks git push in execute phase", () => {
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      { tool_name: "Bash", tool_input: { command: "git push origin main" } },
      ctx,
    );
    expect(decision.allow).toBe(false);
    if (!decision.allow) {
      expect(decision.reason).toContain("git push");
    }
  });

  it("blocks gh pr create before phase done", () => {
    const ctx = buildContext(tmpDir);
    const decision = evaluateToolCall(
      { tool_name: "Bash", tool_input: { command: "gh pr create --title x" } },
      ctx,
    );
    expect(decision.allow).toBe(false);
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
