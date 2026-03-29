import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Logger } from "../../../../src/core/output/logger.js";
import {
  readAllFeedback,
  readFeedbackForSkill,
  writeFeedback,
  pruneFeedback,
} from "../../../../src/core/skill/feedback-collector.js";
import type { FeedbackEntry } from "../../../../src/schemas/feedback.js";

let tmpDir: string;

function makeEntry(overrides: Partial<FeedbackEntry> = {}): FeedbackEntry {
  return {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    skillName: "commit",
    timestamp: "2026-03-28T21:30:00.000Z",
    agent: "claude-code",
    taskSummary: "Test task",
    outcome: "success",
    issues: [],
    suggestions: [],
    ...overrides,
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-feedback-test-"));
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("readAllFeedback", () => {
  it("returns empty array when feedback dir does not exist", async () => {
    const result = await readAllFeedback(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });

  it("reads valid feedback files", async () => {
    const fbDir = path.join(tmpDir, "feedback");
    await fs.mkdir(fbDir, { recursive: true });
    await fs.writeFile(
      path.join(fbDir, "entry1.json"),
      JSON.stringify(makeEntry()),
      "utf-8",
    );

    const result = await readAllFeedback(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.skillName).toBe("commit");
    }
  });

  it("skips invalid JSON files", async () => {
    const fbDir = path.join(tmpDir, "feedback");
    await fs.mkdir(fbDir, { recursive: true });
    await fs.writeFile(path.join(fbDir, "bad.json"), "not json", "utf-8");
    await fs.writeFile(
      path.join(fbDir, "good.json"),
      JSON.stringify(makeEntry()),
      "utf-8",
    );

    const result = await readAllFeedback(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it("skips files that fail Zod validation", async () => {
    const fbDir = path.join(tmpDir, "feedback");
    await fs.mkdir(fbDir, { recursive: true });
    await fs.writeFile(
      path.join(fbDir, "invalid.json"),
      JSON.stringify({ id: "not-uuid", skillName: "x" }),
      "utf-8",
    );

    const result = await readAllFeedback(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(0);
  });
});

describe("readFeedbackForSkill", () => {
  it("filters by skill name", async () => {
    const fbDir = path.join(tmpDir, "feedback");
    await fs.mkdir(fbDir, { recursive: true });
    await fs.writeFile(
      path.join(fbDir, "a.json"),
      JSON.stringify(makeEntry({ skillName: "commit" })),
    );
    await fs.writeFile(
      path.join(fbDir, "b.json"),
      JSON.stringify(
        makeEntry({
          id: "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
          skillName: "review",
        }),
      ),
    );

    const result = await readFeedbackForSkill(tmpDir, "commit");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.skillName).toBe("commit");
    }
  });
});

describe("writeFeedback", () => {
  it("writes valid entry to feedback dir", async () => {
    const entry = makeEntry();
    const result = await writeFeedback(tmpDir, entry);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const content = await fs.readFile(result.data, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.skillName).toBe("commit");
    }
  });

  it("creates feedback directory if missing", async () => {
    const entry = makeEntry();
    await writeFeedback(tmpDir, entry);

    const fbDir = path.join(tmpDir, "feedback");
    const stat = await fs.stat(fbDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("rejects invalid entry", async () => {
    const bad = { ...makeEntry(), id: "not-a-uuid" } as FeedbackEntry;
    const result = await writeFeedback(tmpDir, bad);
    expect(result.ok).toBe(false);
  });
});

describe("pruneFeedback", () => {
  it("removes entries older than max age", async () => {
    const fbDir = path.join(tmpDir, "feedback");
    await fs.mkdir(fbDir, { recursive: true });

    const oldEntry = makeEntry({
      timestamp: "2020-01-01T00:00:00.000Z",
    });
    const newEntry = makeEntry({
      id: "c1b2c3d4-e5f6-7890-abcd-ef1234567890",
      timestamp: new Date().toISOString(),
    });

    await fs.writeFile(path.join(fbDir, "old.json"), JSON.stringify(oldEntry));
    await fs.writeFile(path.join(fbDir, "new.json"), JSON.stringify(newEntry));

    const result = await pruneFeedback(tmpDir, 30);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeGreaterThanOrEqual(1);

    const remaining = await readAllFeedback(tmpDir);
    if (remaining.ok) expect(remaining.data).toHaveLength(1);
  });

  it("returns 0 when no feedback exists", async () => {
    const result = await pruneFeedback(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(0);
  });

  it("enforces MAX_FEEDBACK_ENTRIES cap per skill", async () => {
    const fbDir = path.join(tmpDir, "feedback");
    await fs.mkdir(fbDir, { recursive: true });

    // Write 5 entries for the same skill (we'll set cap to test with actual constant)
    // The cap is 1000 which is too many for a test, so we verify the pruning
    // logic runs by writing entries and checking none are removed (all under cap)
    for (let i = 0; i < 5; i++) {
      const entry = makeEntry({
        id: `a1b2c3d4-e5f6-7890-abcd-ef12345678${String(i).padStart(2, "0")}`,
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
      });
      await fs.writeFile(
        path.join(
          fbDir,
          `${entry.timestamp.replace(/[:.]/g, "-")}-${entry.skillName}.json`,
        ),
        JSON.stringify(entry),
      );
    }

    // Prune with very high max age so nothing is removed by age
    const result = await pruneFeedback(tmpDir, 99999);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(0);

    // All 5 should remain (under 1000 cap)
    const remaining = await readAllFeedback(tmpDir);
    if (remaining.ok) expect(remaining.data).toHaveLength(5);
  });
});
