import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  readEvals,
  writeEvals,
  updateEvalResult,
  getEvalsSummary,
} from "../../../../src/core/skill/evals-manager.js";
import type { EvalsData } from "../../../../src/schemas/evals.js";

let tmpDir: string;

function makeEvalsData(overrides: Partial<EvalsData> = {}): EvalsData {
  return {
    skillName: "commit",
    cases: [
      { id: "c1", description: "Conventional format" },
      { id: "c2", description: "Has scope", passed: true },
    ],
    ...overrides,
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-evals-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("readEvals", () => {
  it("returns empty cases when evals file does not exist", async () => {
    const skillDir = path.join(tmpDir, "my-skill");
    await fs.mkdir(skillDir, { recursive: true });

    const result = await readEvals(skillDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.skillName).toBe("my-skill");
      expect(result.data.cases).toEqual([]);
    }
  });

  it("reads valid evals file", async () => {
    const skillDir = path.join(tmpDir, "commit");
    const evalsDir = path.join(skillDir, "evals");
    await fs.mkdir(evalsDir, { recursive: true });
    await fs.writeFile(
      path.join(evalsDir, "evals.json"),
      JSON.stringify(makeEvalsData()),
      "utf-8",
    );

    const result = await readEvals(skillDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.skillName).toBe("commit");
      expect(result.data.cases).toHaveLength(2);
    }
  });

  it("returns error for invalid evals format", async () => {
    const skillDir = path.join(tmpDir, "bad");
    const evalsDir = path.join(skillDir, "evals");
    await fs.mkdir(evalsDir, { recursive: true });
    await fs.writeFile(
      path.join(evalsDir, "evals.json"),
      JSON.stringify({ cases: [{ id: "no-desc" }] }),
      "utf-8",
    );

    const result = await readEvals(skillDir);
    expect(result.ok).toBe(false);
  });
});

describe("writeEvals", () => {
  it("writes evals data and creates directory", async () => {
    const skillDir = path.join(tmpDir, "new-skill");
    const data = makeEvalsData({ skillName: "new-skill" });

    const result = await writeEvals(skillDir, data);
    expect(result.ok).toBe(true);

    const filePath = path.join(skillDir, "evals", "evals.json");
    const content = JSON.parse(await fs.readFile(filePath, "utf-8"));
    expect(content.skillName).toBe("new-skill");
    expect(content.cases).toHaveLength(2);
    expect(content.lastUpdated).toBeDefined();
  });

  it("overwrites existing evals file", async () => {
    const skillDir = path.join(tmpDir, "overwrite");
    const data1 = makeEvalsData({ skillName: "overwrite" });
    await writeEvals(skillDir, data1);

    const data2 = makeEvalsData({
      skillName: "overwrite",
      cases: [{ id: "c3", description: "New case" }],
    });
    await writeEvals(skillDir, data2);

    const filePath = path.join(skillDir, "evals", "evals.json");
    const content = JSON.parse(await fs.readFile(filePath, "utf-8"));
    expect(content.cases).toHaveLength(1);
    expect(content.cases[0].id).toBe("c3");
  });
});

describe("updateEvalResult", () => {
  it("updates an existing eval case", async () => {
    const skillDir = path.join(tmpDir, "update");
    await writeEvals(skillDir, makeEvalsData({ skillName: "update" }));

    const result = await updateEvalResult(skillDir, "c1", true);
    expect(result.ok).toBe(true);

    const readResult = await readEvals(skillDir);
    if (readResult.ok) {
      const c1 = readResult.data.cases.find((c) => c.id === "c1");
      expect(c1?.passed).toBe(true);
      expect(c1?.lastRunAt).toBeDefined();
    }
  });

  it("returns error for non-existent eval case", async () => {
    const skillDir = path.join(tmpDir, "missing");
    await writeEvals(skillDir, makeEvalsData({ skillName: "missing" }));

    const result = await updateEvalResult(skillDir, "nonexistent", false);
    expect(result.ok).toBe(false);
  });
});

describe("getEvalsSummary", () => {
  it("returns correct counts", async () => {
    const skillDir = path.join(tmpDir, "summary");
    await writeEvals(skillDir, {
      skillName: "summary",
      cases: [
        { id: "c1", description: "Pass", passed: true },
        { id: "c2", description: "Fail", passed: false },
        { id: "c3", description: "Not run" },
      ],
    });

    const result = await getEvalsSummary(skillDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(3);
      expect(result.data.passed).toBe(1);
      expect(result.data.failed).toBe(1);
    }
  });

  it("returns zeros when no evals exist", async () => {
    const skillDir = path.join(tmpDir, "empty");
    await fs.mkdir(skillDir, { recursive: true });

    const result = await getEvalsSummary(skillDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(0);
      expect(result.data.passed).toBe(0);
      expect(result.data.failed).toBe(0);
    }
  });
});
