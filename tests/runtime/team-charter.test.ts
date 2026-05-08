import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const HOOK_PATH = join(__dirname, "..", "hooks", "session-start.sh");
const PLUGIN_ROOT = join(__dirname, "..");

function runHook(cwd: string): { additionalContext: string } {
  const out = execFileSync("bash", [HOOK_PATH], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
  const parsed = JSON.parse(out);
  return { additionalContext: parsed.hookSpecificOutput.additionalContext };
}

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "devloop-charter-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("team-charter / SessionStart hook injection", () => {
  it("injects the proactivity preamble + all 8 Iron Laws", () => {
    const { additionalContext } = runHook(cwd);
    // Proactivity preamble (the v0.8.0+ rule that fixes the "ask before doing" defect):
    expect(additionalContext).toContain("DEFAULT MODE: ACT");
    expect(additionalContext).toMatch(/User directives.*ARE authorization/);
    // 8 laws:
    for (const law of [
      "RECOMMEND AND EXECUTE",
      "ONE QUESTION PER TURN",
      "SHEET IS THE CANVAS",
      "HARD GATES NEED 'ok'",
      "exactly two chars",
      "PULL BEFORE PATCH",
      "ATOMIC + ROLLBACK",
      "NEVER COMMIT WITHOUT APPROVAL",
      "HONOR OUTPUT MODE",
    ]) {
      expect(additionalContext).toContain(law);
    }
  });

  it("enumerates all six available workflows", () => {
    const { additionalContext } = runHook(cwd);
    for (const workflow of [
      "project",
      "feature",
      "bug-fix",
      "refactor",
      "migration",
      "quality-gates",
    ]) {
      expect(additionalContext).toContain(workflow);
    }
  });

  it("reports project=none when no .devloop/project.json exists", () => {
    const { additionalContext } = runHook(cwd);
    expect(additionalContext).toMatch(/project:\s+none/);
    expect(additionalContext).toMatch(/workflow:\s+none active/);
  });

  it("reads project name + sheet ID from .devloop/project.json", () => {
    mkdirSync(join(cwd, ".devloop"), { recursive: true });
    writeFileSync(
      join(cwd, ".devloop", "project.json"),
      JSON.stringify({
        project_name: "acme-charter-test",
        sheet_id: "SHEET_XYZ_789",
        sheet_template_version: 1,
        auth_mode: "oauth_user",
        created_at: "2026-05-02T00:00:00.000Z",
        created_by: "tester@local",
      }),
    );
    const { additionalContext } = runHook(cwd);
    expect(additionalContext).toContain("acme-charter-test");
    expect(additionalContext).toContain("SHEET_XYZ_789");
    expect(additionalContext).toContain("oauth_user");
  });

  it("reads workflow id from .workflow/active/workflow-id.txt", () => {
    mkdirSync(join(cwd, ".workflow", "active"), { recursive: true });
    writeFileSync(join(cwd, ".workflow", "active", "workflow-id.txt"), "feat-build-thing-20260502");
    const { additionalContext } = runHook(cwd);
    expect(additionalContext).toContain("feat-build-thing-20260502");
  });

  it("reads output_mode from .devloop/preferences.json (defaults to caveman)", () => {
    mkdirSync(join(cwd, ".devloop"), { recursive: true });
    writeFileSync(
      join(cwd, ".devloop", "preferences.json"),
      JSON.stringify({ output_mode: "normal" }),
    );
    const { additionalContext } = runHook(cwd);
    expect(additionalContext).toMatch(/output:\s+normal/);
  });

  it("instructs first-turn behavior: act on directives, only menu on exploratory prompts", () => {
    const { additionalContext } = runHook(cwd);
    expect(additionalContext).toMatch(/First.?turn/i);
    expect(additionalContext).toMatch(/EXPLORATORY/);
    expect(additionalContext).toMatch(/DIRECTIVE/);
    expect(additionalContext).toMatch(/SKIP the menu/);
    expect(additionalContext).toMatch(/Do NOT ask 'should I start\?'/);
  });
});

describe("team-charter / skill files exist", () => {
  it("skills/team-charter has SKILL.md, contract.json, references/iron-laws.md, evals/evals.json, CHANGELOG.md", () => {
    const root = join(__dirname, "..", "skills", "team-charter");
    for (const f of [
      "SKILL.md",
      "contract.json",
      "CHANGELOG.md",
      "references/iron-laws.md",
      "evals/evals.json",
    ]) {
      expect(existsSync(join(root, f)), `${f} should exist`).toBe(true);
    }
  });

  it("contract.json declares the 8 Iron Laws by id", () => {
    const root = join(__dirname, "..", "skills", "team-charter");
    const contract = JSON.parse(readFileSync(join(root, "contract.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(contract["skill_name"]).toBe("team-charter");
    const laws = contract["iron_laws"] as string[];
    expect(laws).toHaveLength(8);
    expect(laws).toContain("always-recommend-never-blank");
    expect(laws).toContain("pull-before-patch-preview-before-apply");
    expect(laws).toContain("atomic-writes-rollback-ready");
  });
});
