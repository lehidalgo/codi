import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  parseManifest,
  parseFlags,
  scanRules,
} from "../../../src/core/config/parser.js";

const FIXTURES = path.resolve(__dirname, "../../fixtures/inheritance");
const BASIC = path.join(FIXTURES, "basic-merge/input/.codi");

describe("parseManifest", () => {
  it("parses a valid codi.yaml", async () => {
    const result = await parseManifest(BASIC);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("test-project");
    expect(result.data.version).toBe("1");
    expect(result.data.agents).toEqual(["claude-code", "cursor"]);
  });

  it("returns error for missing codi.yaml", async () => {
    const result = await parseManifest("/nonexistent/path");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe("E_CONFIG_NOT_FOUND");
  });
});

describe("parseFlags", () => {
  it("parses valid flags.yaml", async () => {
    const result = await parseFlags(BASIC);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data["max_file_lines"]).toBeDefined();
    expect(result.data["max_file_lines"]!.mode).toBe("enabled");
    expect(result.data["max_file_lines"]!.value).toBe(700);
    expect(result.data["security_scan"]!.value).toBe(true);
  });

  it("returns empty record when flags.yaml is missing", async () => {
    const result = await parseFlags("/nonexistent/path");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({});
  });
});

describe("scanRules", () => {
  it("scans rules from rules directory", async () => {
    const rulesDir = path.join(BASIC, "rules");
    const result = await scanRules(rulesDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.name).toBe("security");
    expect(result.data[0]!.priority).toBe("high");
    expect(result.data[0]!.managedBy).toBe("codi");
    expect(result.data[0]!.content).toBe("Follow security best practices.");
  });

  it("returns empty array when rules dir is missing", async () => {
    const result = await scanRules("/nonexistent/rules");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });
});
