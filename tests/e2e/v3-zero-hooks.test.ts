/**
 * v3 zero closure end-to-end hook-script suite.
 *
 * Spawns the bundled `codi hook <name>` CLI handler with a realistic
 * Claude Code stdin payload. Validates exit codes, stderr feedback, and
 * brain side-effects. Heavier than the in-process orchestrator suite
 * because every test starts a node subprocess; isolated here so the
 * lighter runtime suite stays under the 800-line file budget.
 *
 * Updated by ISSUE-007: the legacy `scripts/runtime/hook-*.ts` entry
 * points were deleted because production already invokes `codi hook
 * <name>` (bundled into dist/cli.js). These tests now exercise the
 * same path production uses.
 *
 * Plan reference: docs/20260509_172807_[TESTING]_codi-v3-zero-e2e-plan.md
 * (scenario S10).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { openBrain, type BrainHandle } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
// retry: 2 absorbs occasional cross-load FS/spawn hiccups under heavy
// vitest parallelism without masking real defects.
const SUITE_RETRY = 2;

let dir: string;
let savedBrain: string | undefined;

function bootstrapKb(d: string): void {
  mkdirSync(join(d, "docs"), { recursive: true });
  writeFileSync(join(d, "docs", "CONTEXT.md"), "# C\n", "utf-8");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codi-e2e-hooks-"));
  bootstrapKb(dir);
  savedBrain = process.env["CODI_BRAIN_DB"];
  process.env["CODI_BRAIN_DB"] = join(dir, "brain.db");
});

afterEach(() => {
  if (savedBrain === undefined) delete process.env["CODI_BRAIN_DB"];
  else process.env["CODI_BRAIN_DB"] = savedBrain;
  rmSync(dir, { recursive: true, force: true });
});

function withHandle<T>(cb: (h: BrainHandle) => T): T {
  const handle = openBrain();
  try {
    applyMigrations(handle.raw);
    return cb(handle);
  } finally {
    handle.close();
  }
}

function distCli(): string {
  return join(process.cwd(), "dist", "cli.js");
}

interface HookResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

// Map the legacy `hook-<name>.ts` argument to the modern `codi hook <name>`
// subcommand so existing assertions keep their declarative call style.
function legacyToSubcommand(scriptName: string): string {
  return scriptName.replace(/^hook-/, "").replace(/\.ts$/, "");
}

function runHook(scriptName: string, payload: unknown): HookResult {
  const cli = distCli();
  if (!existsSync(cli)) {
    throw new Error(
      `dist/cli.js missing — run \`pnpm build\` before this test suite (invoked path: ${cli}).`,
    );
  }
  const sub = legacyToSubcommand(scriptName);
  try {
    const stdout = execFileSync("node", [cli, "hook", sub, "--agent", "claude-code"], {
      input: JSON.stringify(payload),
      encoding: "utf-8",
      env: { ...process.env, CODI_BRAIN_DB: process.env["CODI_BRAIN_DB"] ?? "" },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as {
      status?: number;
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };
    return {
      code: e.status ?? -1,
      stdout: typeof e.stdout === "string" ? e.stdout : (e.stdout?.toString() ?? ""),
      stderr: typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString() ?? ""),
    };
  }
}

// ─── S10 — Hook script entrypoints under tsx ────────────────────────────────

describe("S10 — hook scripts run under tsx with realistic stdin", { retry: SUITE_RETRY }, () => {
  it("hook-user-prompt-submit writes a prompt+turn AND emits state block to stdout", () => {
    const result = runHook("hook-user-prompt-submit.ts", {
      session_id: "sess-up",
      prompt: "Hello world",
      cwd: dir,
    });
    expect(result.code).toBe(0);
    // Capture-protocol block always emitted.
    expect(result.stdout).toContain("<capture-protocol>");

    // Brain side-effect: prompts row exists.
    withHandle((h) => {
      const row = h.raw.prepare(`SELECT text FROM prompts WHERE session_id = 'sess-up'`).get() as
        | { text: string }
        | undefined;
      expect(row?.text).toBe("Hello world");
    });
  });

  it("hook-post-tool-use records a tool_calls row tagged 'ok'", () => {
    // Seed a session+turn via the prompt hook so the post-tool hook can attach.
    runHook("hook-user-prompt-submit.ts", {
      session_id: "sess-pt",
      prompt: "do edit",
      cwd: dir,
    });

    const result = runHook("hook-post-tool-use.ts", {
      session_id: "sess-pt",
      cwd: dir,
      tool_name: "Edit",
      tool_input: { file_path: "/tmp/x.ts", old_string: "a", new_string: "b" },
      tool_response: { success: true },
    });
    expect(result.code).toBe(0);

    withHandle((h) => {
      const row = h.raw
        .prepare(
          `SELECT tool_name, status FROM tool_calls WHERE session_id = 'sess-pt' ORDER BY call_id DESC LIMIT 1`,
        )
        .get() as { tool_name: string; status: string } | undefined;
      expect(row?.tool_name).toBe("Edit");
      expect(row?.status).toBe("ok");
    });
  });

  it("hook-stop persists captures from a transcript JSONL", () => {
    runHook("hook-user-prompt-submit.ts", {
      session_id: "sess-stop",
      prompt: "audit it",
      cwd: dir,
    });

    const transcriptPath = join(dir, "transcript.jsonl");
    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({ role: "user", content: "audit it" }),
        JSON.stringify({
          role: "assistant",
          content: 'Done.\n|RULE: "always pin deps"|\n|INSIGHT: "auth has 3 dead branches"|',
        }),
      ].join("\n"),
      "utf-8",
    );

    const result = runHook("hook-stop.ts", {
      session_id: "sess-stop",
      cwd: dir,
      transcript_path: transcriptPath,
    });
    expect(result.code).toBe(0);

    withHandle((h) => {
      const captures = h.raw
        .prepare(
          `SELECT type, content FROM captures WHERE session_id = 'sess-stop' ORDER BY capture_id`,
        )
        .all() as { type: string; content: string }[];
      expect(captures).toHaveLength(2);
      expect(captures.map((c) => c.type).sort()).toEqual(["INSIGHT", "RULE"]);
    });
  });

  it("hook-pre-tool-use blocks unauthorized git mutations with exit 2", () => {
    runHook("hook-user-prompt-submit.ts", {
      session_id: "sess-block",
      prompt: "fix the auth bug and rerun the tests",
      cwd: dir,
    });
    const result = runHook("hook-pre-tool-use.ts", {
      session_id: "sess-block",
      cwd: dir,
      tool_name: "Bash",
      tool_input: { command: "git push origin main" },
    });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Iron Law 7");
  });

  it("DEFECT-002 (FIXED) — decideGitCommand rejects negated approval mentions", () => {
    // The old substring matcher passed "dont commit yet" as approval. The
    // upgraded clause-level word-boundary parser correctly reads it as a
    // refusal because the leading negation cancels the approval token.
    runHook("hook-user-prompt-submit.ts", {
      session_id: "sess-neg",
      prompt: "fix the bug, dont commit yet",
      cwd: dir,
    });
    const result = runHook("hook-pre-tool-use.ts", {
      session_id: "sess-neg",
      cwd: dir,
      tool_name: "Bash",
      tool_input: { command: "git push origin main" },
    });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Iron Law 7");
  });

  it("DEFECT-002 (FIXED) — clause split keeps 'fix bug, then ok' approved", () => {
    runHook("hook-user-prompt-submit.ts", {
      session_id: "sess-clause",
      prompt: "fix the auth bug, then ok",
      cwd: dir,
    });
    const result = runHook("hook-pre-tool-use.ts", {
      session_id: "sess-clause",
      cwd: dir,
      tool_name: "Bash",
      tool_input: { command: "git commit -m 'fix auth'" },
    });
    expect(result.code).toBe(0);
  });

  it("DEFECT-002 (FIXED) — word boundary rejects 'commitment' as approval", () => {
    runHook("hook-user-prompt-submit.ts", {
      session_id: "sess-wb",
      prompt: "rewrite the commitment statement in README",
      cwd: dir,
    });
    const result = runHook("hook-pre-tool-use.ts", {
      session_id: "sess-wb",
      cwd: dir,
      tool_name: "Bash",
      tool_input: { command: "git push origin main" },
    });
    expect(result.code).toBe(2);
  });

  it("hook-pre-tool-use allows git when 'ok' is in recent prompts", () => {
    runHook("hook-user-prompt-submit.ts", {
      session_id: "sess-allow",
      prompt: "ok",
      cwd: dir,
    });
    const result = runHook("hook-pre-tool-use.ts", {
      session_id: "sess-allow",
      cwd: dir,
      tool_name: "Bash",
      tool_input: { command: "git commit -m 'x'" },
    });
    expect(result.code).toBe(0);
  });
});
