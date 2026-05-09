import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  ENTITY_NAMES,
  COLUMN_ZONES,
  SheetsError,
  allowedZones,
  zoneOf,
  validatePartialRow,
  validateFullRow,
  isValidId,
  nextId,
  readProjectConfig,
  writeProjectConfig,
  tryReadProjectConfig,
} from "#src/runtime/sync/index.js";
import type { ProjectConfig } from "#src/runtime/sync/index.js";

const fixedConfig: ProjectConfig = {
  project_name: "test-project",
  sheet_id: "TEST_SHEET_ID",
  sheet_template_version: 1,
  created_at: "2026-05-02T00:00:00.000Z",
  created_by: "tester@local",
};

describe("sheets/types — zone discipline", () => {
  it("allowedZones bootstrap covers planning + execution", () => {
    expect(allowedZones("bootstrap")).toEqual(["planning", "execution"]);
  });

  it("allowedZones execution-only excludes planning", () => {
    expect(allowedZones("execution-only")).toEqual(["execution"]);
  });

  it("zoneOf returns planning for as_a / acceptance_criteria on UserStory", () => {
    expect(zoneOf("UserStory", "as_a")).toBe("planning");
    expect(zoneOf("UserStory", "acceptance_criteria")).toBe("planning");
  });

  it("zoneOf returns execution for branch / commit_shas / pr_url on UserStory", () => {
    expect(zoneOf("UserStory", "branch")).toBe("execution");
    expect(zoneOf("UserStory", "commit_shas")).toBe("execution");
    expect(zoneOf("UserStory", "pr_url")).toBe("execution");
  });

  it("zoneOf throws on unknown column", () => {
    expect(() => zoneOf("UserStory", "totally_made_up")).toThrowError(SheetsError);
  });

  it("ENTITY_NAMES exhaustively covers COLUMN_ZONES", () => {
    for (const e of ENTITY_NAMES) {
      expect(COLUMN_ZONES[e]).toBeDefined();
    }
  });
});

describe("sheets/schema — validation", () => {
  it("validatePartialRow accepts a partial UserStory upsert", () => {
    expect(() =>
      validatePartialRow("UserStory", { id: "US-001", status: "in-progress", branch: "feat/x" }),
    ).not.toThrow();
  });

  it("validatePartialRow rejects bad enum value", () => {
    expect(() =>
      validatePartialRow("UserStory", { id: "US-001", status: "made-up-status" }),
    ).toThrowError(SheetsError);
  });

  it("validatePartialRow rejects bad id pattern", () => {
    expect(() => validatePartialRow("UserStory", { id: "US-X" })).toThrowError(SheetsError);
  });

  it("validateFullRow rejects when required fields missing", () => {
    expect(() => validateFullRow("BusinessGoal", { id: "BG-001" })).toThrowError(SheetsError);
  });

  it("validateFullRow accepts a complete BusinessGoal row", () => {
    expect(() =>
      validateFullRow("BusinessGoal", {
        id: "BG-001",
        title: "Increase signup conversion",
        status: "accepted",
      }),
    ).not.toThrow();
  });

  it("isValidId enforces per-entity prefix + digits", () => {
    expect(isValidId("UserStory", "US-001")).toBe(true);
    expect(isValidId("UserStory", "BG-001")).toBe(false);
    expect(isValidId("BusinessGoal", "BG-099")).toBe(true);
    expect(isValidId("Requirement", "REQ-1234")).toBe(true);
  });

  it("nextId picks max+1 with consistent pad width", () => {
    expect(nextId("UserStory", ["US-001", "US-002"])).toBe("US-003");
    expect(nextId("UserStory", [])).toBe("US-001");
    expect(nextId("UserStory", ["US-099"])).toBe("US-100");
    expect(nextId("UserStory", ["US-9999"])).toBe("US-10000");
  });

  it("nextId ignores ids that don't match the entity pattern", () => {
    expect(nextId("UserStory", ["US-005", "REQ-007"])).toBe("US-006");
  });
});

describe("sheets/config", () => {
  let cwd: string;

  it("readProjectConfig throws config_missing when file absent", () => {
    cwd = mkdtempSync(join(tmpdir(), "sheets-config-"));
    try {
      expect(() => readProjectConfig(cwd)).toThrowError(SheetsError);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("tryReadProjectConfig returns null when file absent", () => {
    cwd = mkdtempSync(join(tmpdir(), "sheets-config-"));
    try {
      expect(tryReadProjectConfig(cwd)).toBeNull();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("readProjectConfig parses a valid file", () => {
    cwd = mkdtempSync(join(tmpdir(), "sheets-config-"));
    try {
      mkdirSync(join(cwd, ".codi"));
      writeFileSync(join(cwd, ".codi/project.json"), JSON.stringify(fixedConfig, null, 2));
      const cfg = readProjectConfig(cwd);
      expect(cfg.sheet_id).toBe("TEST_SHEET_ID");
      expect(cfg.sheet_template_version).toBe(1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("writeProjectConfig + readProjectConfig roundtrips", () => {
    cwd = mkdtempSync(join(tmpdir(), "sheets-config-"));
    try {
      writeProjectConfig(cwd, fixedConfig);
      expect(readProjectConfig(cwd)).toEqual(fixedConfig);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("readProjectConfig throws on malformed JSON", () => {
    cwd = mkdtempSync(join(tmpdir(), "sheets-config-"));
    try {
      mkdirSync(join(cwd, ".codi"));
      writeFileSync(join(cwd, ".codi/project.json"), "{not json");
      expect(() => readProjectConfig(cwd)).toThrowError(SheetsError);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("readProjectConfig throws on missing required field", () => {
    cwd = mkdtempSync(join(tmpdir(), "sheets-config-"));
    try {
      mkdirSync(join(cwd, ".codi"));
      writeFileSync(join(cwd, ".codi/project.json"), JSON.stringify({ project_name: "x" }));
      expect(() => readProjectConfig(cwd)).toThrowError(SheetsError);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
