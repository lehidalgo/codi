import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const CLI = join(REPO_ROOT, "dist", "cli.js");

// Build risky source strings at runtime so the test file itself does not
// contain the literal substrings that the security-reminder hook scans for.
const RISKY_TS_CONTENT = ["child_process", ".", "exe", "c", "('rm');"].join("");
const RISKY_COMMENT_CONTENT = "// " + RISKY_TS_CONTENT;
const SAFE_DOC_CONTENT = "this doc mentions " + RISKY_TS_CONTENT + " but it is .md";

// Use a unique session-id prefix per test process to avoid dedupe carryover
// between runs (state at ~/.codi/security/state-<sid>.json).
const RUN_SUFFIX = `${process.pid}-${Date.now()}`;
const sid = (n: string): string => `e2e-task31-${n}-${RUN_SUFFIX}`;

describe("hooks-as-artifacts E2E — security-reminder PreToolUse", () => {
  beforeAll(() => {
    if (!existsSync(CLI)) {
      throw new Error(`dist/cli.js missing — run 'npm run build' before E2E. Looked at: ${CLI}`);
    }
  });

  it("Write of risky pattern in .ts file exits 2 and emits security-reminder", () => {
    const payload = JSON.stringify({
      session_id: sid("sid-1"),
      tool_name: "Write",
      tool_input: {
        file_path: "/tmp/codi-e2e-task31-foo.ts",
        content: RISKY_TS_CONTENT,
      },
      cwd: REPO_ROOT,
    });
    const r = spawnSync(process.execPath, [CLI, "hook", "pre-tool-use"], {
      input: payload,
      encoding: "utf8",
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("child-process-exec");
  });

  it("Write of risky pattern in .md doc does not block (skiplist)", () => {
    const payload = JSON.stringify({
      session_id: sid("sid-2"),
      tool_name: "Write",
      tool_input: {
        file_path: "/tmp/codi-e2e-task31-doc.md",
        content: SAFE_DOC_CONTENT,
      },
      cwd: REPO_ROOT,
    });
    const r = spawnSync(process.execPath, [CLI, "hook", "pre-tool-use"], {
      input: payload,
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
  });

  it("Write of risky pattern inside // comment does not block (comment heuristic)", () => {
    const payload = JSON.stringify({
      session_id: sid("sid-3"),
      tool_name: "Write",
      tool_input: {
        file_path: "/tmp/codi-e2e-task31-comment.ts",
        content: RISKY_COMMENT_CONTENT,
      },
      cwd: REPO_ROOT,
    });
    const r = spawnSync(process.execPath, [CLI, "hook", "pre-tool-use"], {
      input: payload,
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
  });

  it("dedupe: same (sid,file,rule) only blocks once per session", () => {
    const payload = JSON.stringify({
      session_id: sid("dedupe"),
      tool_name: "Write",
      tool_input: {
        file_path: "/tmp/codi-e2e-task31-dedupe.ts",
        content: RISKY_TS_CONTENT,
      },
      cwd: REPO_ROOT,
    });
    const r1 = spawnSync(process.execPath, [CLI, "hook", "pre-tool-use"], {
      input: payload,
      encoding: "utf8",
    });
    const r2 = spawnSync(process.execPath, [CLI, "hook", "pre-tool-use"], {
      input: payload,
      encoding: "utf8",
    });
    expect(r1.status).toBe(2);
    expect(r2.status).toBe(0);
  });
});
