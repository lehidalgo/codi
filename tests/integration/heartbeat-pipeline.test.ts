/**
 * Integration tests for the heartbeat hook pipeline.
 *
 * These tests run the skill-observer script as a child process to verify
 * the full CODI-OBSERVATION marker → feedback JSON file pipeline.
 *
 * The skill-tracker script is exercised at the unit level in
 * tests/unit/hooks/heartbeat-hooks.test.ts and does not need an
 * integration test since it only appends to a JSON file.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildSkillObserverScript } from "#src/core/hooks/heartbeat-hooks.js";
import { PROJECT_NAME } from "#src/constants.js";

/** Build a minimal JSONL transcript line with a single assistant text block. */
function makeTranscriptLine(text: string): string {
  return JSON.stringify({
    type: "assistant",
    message: {
      content: [{ type: "text", text }],
    },
  });
}

/** Write the session file so the observer doesn't exit early. */
async function writeSessionFile(
  tmpDir: string,
  sessionId: string,
  skills: string[],
): Promise<void> {
  const sessionDir = join(tmpDir, `.${PROJECT_NAME}`, ".session");
  await mkdir(sessionDir, { recursive: true });
  const state = {
    session_id: sessionId,
    skills: skills.map((name) => ({ name, loaded_at: new Date().toISOString() })),
  };
  await writeFile(join(sessionDir, "active-skills.json"), JSON.stringify(state), "utf-8");
}

/** Run the observer script synchronously with the given payload and return stdout. */
function runObserver(scriptPath: string, cwd: string, payload: object): string {
  const result = spawnSync("node", [scriptPath], {
    input: JSON.stringify(payload),
    cwd,
    timeout: 8_000,
    encoding: "utf-8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Observer exited with code ${result.status}: ${result.stderr}`);
  }
  return result.stdout;
}

describe("heartbeat pipeline — skill-observer script", () => {
  let tmpDir: string;
  let scriptPath: string;

  beforeEach(async () => {
    tmpDir = join(
      tmpdir(),
      `${PROJECT_NAME}-heartbeat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tmpDir, { recursive: true });

    // Write the observer script to .codi/hooks/ (mirrors real deployment layout)
    // so __dirname-based project root resolution works correctly.
    const hooksDir = join(tmpDir, `.${PROJECT_NAME}`, "hooks");
    await mkdir(hooksDir, { recursive: true });
    scriptPath = join(hooksDir, "skill-observer.cjs");
    await writeFile(scriptPath, buildSkillObserverScript(), { mode: 0o755 });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ── no session file → exits immediately with {} ───────────────────────

  it("outputs {} and exits cleanly when no session file exists (non-codi session)", async () => {
    const stdout = runObserver(scriptPath, tmpDir, {});
    expect(stdout.trim()).toBe("{}");
  });

  it("outputs {} and exits cleanly when session has no loaded skills", async () => {
    await writeSessionFile(tmpDir, "sess-1", []);
    const stdout = runObserver(scriptPath, tmpDir, {});
    expect(stdout.trim()).toBe("{}");
  });

  // ── transcript without markers → outputs {} ──────────────────────────

  it("outputs {} when the transcript contains no CODI-OBSERVATION markers", async () => {
    await writeSessionFile(tmpDir, "sess-2", ["codi-commit"]);
    const transcriptPath = join(tmpDir, "transcript.jsonl");
    await writeFile(
      transcriptPath,
      makeTranscriptLine("This is a normal response with no markers.\n"),
    );
    const stdout = runObserver(scriptPath, tmpDir, { transcript_path: transcriptPath });
    expect(stdout.trim()).toBe("{}");
  });

  // ── transcript with one marker → writes one feedback file ────────────

  it("writes one feedback JSON file for a single CODI-OBSERVATION marker", async () => {
    await writeSessionFile(tmpDir, "sess-3", ["codi-commit"]);
    const transcriptPath = join(tmpDir, "transcript.jsonl");
    await writeFile(
      transcriptPath,
      makeTranscriptLine(
        "Looks good. [CODI-OBSERVATION: codi-commit | missing-step | no check for empty staged files]\n",
      ),
    );

    const stdout = runObserver(scriptPath, tmpDir, { transcript_path: transcriptPath });
    expect(stdout.trim()).toBe("{}");

    const feedbackDir = join(tmpDir, `.${PROJECT_NAME}`, "feedback");
    const files = await readdir(feedbackDir);
    expect(files.filter((f) => f.endsWith(".json"))).toHaveLength(1);

    const content = JSON.parse(await readFile(join(feedbackDir, files[0]!), "utf-8"));
    expect(content.skillName).toBe("codi-commit");
    expect(content.category).toBe("missing-step");
    expect(content.observation).toBe("no check for empty staged files");
    expect(content.severity).toBe("low");
    expect(content.source).toBe("hook-transcript-scan");
    expect(content.resolved).toBe(false);
    expect(typeof content.id).toBe("string");
    expect(typeof content.timestamp).toBe("string");
  });

  // ── user-correction category → high severity ─────────────────────────

  it("assigns high severity to user-correction category", async () => {
    await writeSessionFile(tmpDir, "sess-4", ["codi-testing"]);
    const transcriptPath = join(tmpDir, "transcript.jsonl");
    await writeFile(
      transcriptPath,
      makeTranscriptLine(
        "[CODI-OBSERVATION: codi-testing | user-correction | user said do not mock the database]\n",
      ),
    );

    runObserver(scriptPath, tmpDir, { transcript_path: transcriptPath });

    const feedbackDir = join(tmpDir, `.${PROJECT_NAME}`, "feedback");
    const files = await readdir(feedbackDir);
    const content = JSON.parse(await readFile(join(feedbackDir, files[0]!), "utf-8"));
    expect(content.severity).toBe("high");
    expect(content.category).toBe("user-correction");
  });

  // ── multiple markers in one response → multiple feedback files ────────

  it("writes multiple feedback files when the transcript contains multiple markers", async () => {
    await writeSessionFile(tmpDir, "sess-5", ["codi-commit", "codi-review"]);
    const transcriptPath = join(tmpDir, "transcript.jsonl");
    const text = [
      "[CODI-OBSERVATION: codi-commit | missing-step | no check for staged files]",
      "[CODI-OBSERVATION: codi-review | outdated-rule | rule references ESLint but project uses Biome]",
    ].join("\n");
    await writeFile(transcriptPath, makeTranscriptLine(text));

    runObserver(scriptPath, tmpDir, { transcript_path: transcriptPath });

    const feedbackDir = join(tmpDir, `.${PROJECT_NAME}`, "feedback");
    const files = await readdir(feedbackDir);
    expect(files.filter((f) => f.endsWith(".json"))).toHaveLength(2);
  });

  // ── threshold hint ───────────────────────────────────────────────────

  it("emits additionalContext JSON when feedback count reaches threshold", async () => {
    // Pre-populate the feedback dir with (threshold - 1) existing files.
    const feedbackDir = join(tmpDir, `.${PROJECT_NAME}`, "feedback");
    await mkdir(feedbackDir, { recursive: true });
    const threshold = 5;
    for (let i = 0; i < threshold - 1; i++) {
      await writeFile(
        join(feedbackDir, `existing-${i}.json`),
        JSON.stringify({ placeholder: true }),
      );
    }

    await writeSessionFile(tmpDir, "sess-6", ["codi-commit"]);
    const transcriptPath = join(tmpDir, "transcript.jsonl");
    await writeFile(
      transcriptPath,
      makeTranscriptLine(
        "[CODI-OBSERVATION: codi-commit | trigger-miss | skill did not activate]\n",
      ),
    );

    const stdout = runObserver(scriptPath, tmpDir, { transcript_path: transcriptPath });
    const result = JSON.parse(stdout);
    expect(result.additionalContext).toBeDefined();
    expect(result.additionalContext).toContain("refine-rules");
    expect(result.additionalContext).toContain("feedback");
  });

  // ── session cleanup ──────────────────────────────────────────────────

  it("removes the session file after processing", async () => {
    await writeSessionFile(tmpDir, "sess-7", ["codi-commit"]);
    const transcriptPath = join(tmpDir, "transcript.jsonl");
    await writeFile(transcriptPath, makeTranscriptLine("No markers here."));

    runObserver(scriptPath, tmpDir, { transcript_path: transcriptPath });

    const sessionFile = join(tmpDir, `.${PROJECT_NAME}`, ".session", "active-skills.json");
    await expect(readFile(sessionFile)).rejects.toThrow();
  });

  // ── missing transcript file → outputs {} gracefully ──────────────────

  it("outputs {} gracefully when transcript_path does not exist", async () => {
    await writeSessionFile(tmpDir, "sess-8", ["codi-commit"]);
    const stdout = runObserver(scriptPath, tmpDir, {
      transcript_path: join(tmpDir, "nonexistent.jsonl"),
    });
    expect(stdout.trim()).toBe("{}");
  });

  // ── malformed JSONL transcript → outputs {} gracefully ───────────────

  it("outputs {} gracefully when transcript contains only invalid JSONL", async () => {
    await writeSessionFile(tmpDir, "sess-9", ["codi-commit"]);
    const transcriptPath = join(tmpDir, "bad.jsonl");
    await writeFile(transcriptPath, "not json at all\n{broken\n");

    const stdout = runObserver(scriptPath, tmpDir, { transcript_path: transcriptPath });
    expect(stdout.trim()).toBe("{}");
  });
});
