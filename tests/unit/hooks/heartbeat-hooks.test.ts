import { beforeAll, describe, it, expect } from "vitest";
import {
  buildSkillTrackerScript,
  buildSkillObserverScript,
  SKILL_TRACKER_FILENAME,
  SKILL_OBSERVER_FILENAME,
  HOOKS_SUBDIR,
  SESSION_SUBDIR,
  ACTIVE_SKILLS_FILENAME,
  OBSERVATION_HINT_THRESHOLD,
} from "#src/core/hooks/heartbeat-hooks.js";

// ── constants ─────────────────────────────────────────────────────────────

describe("exported constants", () => {
  it("SKILL_TRACKER_FILENAME ends with .cjs and includes project name", () => {
    expect(SKILL_TRACKER_FILENAME).toMatch(/\.cjs$/);
    expect(SKILL_TRACKER_FILENAME).toContain("codi");
    expect(SKILL_TRACKER_FILENAME).toContain("skill-tracker");
  });

  it("SKILL_OBSERVER_FILENAME ends with .cjs and includes project name", () => {
    expect(SKILL_OBSERVER_FILENAME).toMatch(/\.cjs$/);
    expect(SKILL_OBSERVER_FILENAME).toContain("codi");
    expect(SKILL_OBSERVER_FILENAME).toContain("skill-observer");
  });

  it("HOOKS_SUBDIR is hooks", () => {
    expect(HOOKS_SUBDIR).toBe("hooks");
  });

  it("SESSION_SUBDIR starts with a dot", () => {
    expect(SESSION_SUBDIR).toMatch(/^\./);
  });

  it("ACTIVE_SKILLS_FILENAME ends with .json", () => {
    expect(ACTIVE_SKILLS_FILENAME).toMatch(/\.json$/);
  });

  it("OBSERVATION_HINT_THRESHOLD is a positive integer", () => {
    expect(OBSERVATION_HINT_THRESHOLD).toBeGreaterThan(0);
    expect(Number.isInteger(OBSERVATION_HINT_THRESHOLD)).toBe(true);
  });
});

// ── buildSkillTrackerScript() ─────────────────────────────────────────────

describe("buildSkillTrackerScript()", () => {
  let script: string;

  beforeAll(() => {
    script = buildSkillTrackerScript();
  });

  it("returns a non-empty string", () => {
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(0);
  });

  it("starts with a Node.js shebang", () => {
    expect(script.trimStart()).toMatch(/^#!.*node/);
  });

  it("uses require() for Node.js built-in modules", () => {
    expect(script).toContain("require('fs')");
    expect(script).toContain("require('path')");
    expect(script).toContain("require('readline')");
  });

  it("reads from stdin via readline", () => {
    expect(script).toContain("readline.createInterface");
    expect(script).toContain("process.stdin");
  });

  it("only tracks codi skill SKILL.md files", () => {
    expect(script).toContain("/.claude/skills/");
    expect(script).toContain("/SKILL.md");
    expect(script).toContain("process.exit(0)");
  });

  it("extracts the skill name from the file path", () => {
    expect(script).toContain("skills");
    expect(script).toContain("lastIndexOf");
  });

  it("writes to the active-skills session file", () => {
    expect(script).toContain(ACTIVE_SKILLS_FILENAME);
    expect(script).toContain(SESSION_SUBDIR);
    expect(script).toContain("mkdirSync");
    expect(script).toContain("writeFileSync");
  });

  it("does not write duplicates (checks existing skill names)", () => {
    expect(script).toContain("some");
    expect(script).toContain("skillName");
  });

  it("handles errors gracefully in main().catch", () => {
    expect(script).toContain("main().catch");
  });

  it("uses matchAll-style iteration, not regex exec loop", () => {
    // Verify the tracker uses safe string/array operations, not a regex exec loop
    // that could trigger security hooks in generated output.
    expect(script).not.toMatch(/\.\s*exec\s*\(/);
  });
});

// ── buildSkillObserverScript() ────────────────────────────────────────────

describe("buildSkillObserverScript()", () => {
  let script: string;

  beforeAll(() => {
    script = buildSkillObserverScript();
  });

  it("returns a non-empty string", () => {
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(0);
  });

  it("starts with a Node.js shebang", () => {
    expect(script.trimStart()).toMatch(/^#!.*node/);
  });

  it("uses require() for Node.js built-in modules including crypto", () => {
    expect(script).toContain("require('fs')");
    expect(script).toContain("require('path')");
    expect(script).toContain("require('readline')");
    expect(script).toContain("require('crypto')");
  });

  it("contains the CODI-OBSERVATION marker pattern", () => {
    expect(script).toContain("CODI-OBSERVATION");
  });

  it("uses matchAll() for marker extraction", () => {
    expect(script).toContain("matchAll");
  });

  it("does not use a regex exec loop (avoids security hook false positive)", () => {
    expect(script).not.toMatch(/\.\s*exec\s*\(/);
  });

  it("reads transcript_path from input payload", () => {
    expect(script).toContain("transcript_path");
  });

  it("exits early if session file does not exist (non-codi session)", () => {
    expect(script).toContain("existsSync");
    expect(script).toContain("session");
  });

  it("writes feedback JSON files with all required fields", () => {
    expect(script).toContain("skillName");
    expect(script).toContain("timestamp");
    expect(script).toContain("session_id");
    expect(script).toContain("category");
    expect(script).toContain("observation");
    expect(script).toContain("severity");
    expect(script).toContain("source");
    expect(script).toContain("resolved");
  });

  it("uses randomUUID for unique feedback file names", () => {
    expect(script).toContain("randomUUID");
  });

  it("removes session file after processing (cleanup)", () => {
    expect(script).toContain("unlinkSync");
  });

  it("emits additionalContext hint when threshold is reached", () => {
    expect(script).toContain("additionalContext");
    expect(script).toContain("refine-rules");
    expect(script).toContain(String(OBSERVATION_HINT_THRESHOLD));
  });

  it("always outputs valid JSON to stdout", () => {
    expect(script).toContain("console.log('{}')");
    expect(script).toContain("console.log(JSON.stringify");
  });

  it("handles errors gracefully in main().catch", () => {
    expect(script).toContain("main().catch");
  });

  it("assigns severity based on category — user-correction maps to high", () => {
    expect(script).toContain("SEVERITY_MAP");
    expect(script).toContain("user-correction");
    expect(script).toContain("high");
  });

  it("script size stays within reasonable bounds (< 10 KB)", () => {
    expect(Buffer.byteLength(script, "utf-8")).toBeLessThan(10 * 1024);
  });
});

// ── builder functions return consistent output ────────────────────────────

describe("builder determinism", () => {
  it("buildSkillTrackerScript() returns the same string on repeated calls", () => {
    expect(buildSkillTrackerScript()).toBe(buildSkillTrackerScript());
  });

  it("buildSkillObserverScript() returns the same string on repeated calls", () => {
    expect(buildSkillObserverScript()).toBe(buildSkillObserverScript());
  });

  it("tracker and observer scripts are different from each other", () => {
    expect(buildSkillTrackerScript()).not.toBe(buildSkillObserverScript());
  });
});
