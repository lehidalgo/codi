import { describe, it, expect } from "vitest";
import {
  formatHuman,
  formatJson,
  createCommandResult,
} from "#src/core/output/formatter.js";
import type { CommandResult } from "#src/core/output/types.js";

describe("createCommandResult", () => {
  it("creates a success result with defaults", () => {
    const result = createCommandResult({
      success: true,
      command: "test",
      data: { foo: "bar" },
      exitCode: 0,
    });

    expect(result.success).toBe(true);
    expect(result.command).toBe("test");
    expect(result.data).toEqual({ foo: "bar" });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.version).toBeDefined();
  });

  it("includes errors when provided", () => {
    const result = createCommandResult({
      success: false,
      command: "fail",
      data: null,
      errors: [
        {
          code: "E",
          message: "bad",
          hint: "fix it",
          severity: "error",
          context: {},
        },
      ],
      exitCode: 1,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toBe("bad");
  });

  it("includes warnings when provided", () => {
    const result = createCommandResult({
      success: true,
      command: "warn",
      data: null,
      warnings: [
        {
          code: "W",
          message: "watch out",
          hint: "",
          severity: "warn",
          context: {},
        },
      ],
      exitCode: 0,
    });

    expect(result.warnings).toHaveLength(1);
  });
});

describe("formatHuman", () => {
  it("formats success result", () => {
    const result = createCommandResult({
      success: true,
      command: "generate",
      data: { count: 3 },
      exitCode: 0,
    });

    const output = formatHuman(result);
    expect(output).toContain("[OK] generate");
    expect(output).toContain('"count": 3');
  });

  it("formats failure with errors and hints", () => {
    const result = createCommandResult({
      success: false,
      command: "validate",
      data: null,
      errors: [
        {
          code: "E",
          message: "invalid config",
          hint: "check syntax",
          severity: "error",
          context: {},
        },
      ],
      exitCode: 1,
    });

    const output = formatHuman(result);
    expect(output).toContain("[FAIL] validate");
    expect(output).toContain("[ERR] invalid config");
    expect(output).toContain("[HINT] check syntax");
  });

  it("skips hint when same as message", () => {
    const result = createCommandResult({
      success: false,
      command: "test",
      data: null,
      errors: [
        {
          code: "E",
          message: "same text",
          hint: "same text",
          severity: "error",
          context: {},
        },
      ],
      exitCode: 1,
    });

    const output = formatHuman(result);
    expect(output).toContain("[ERR] same text");
    expect(output).not.toContain("[HINT]");
  });

  it("formats warnings", () => {
    const result = createCommandResult({
      success: true,
      command: "test",
      data: null,
      warnings: [
        {
          code: "W",
          message: "deprecation",
          hint: "",
          severity: "warn",
          context: {},
        },
      ],
      exitCode: 0,
    });

    const output = formatHuman(result);
    expect(output).toContain("[WARN] deprecation");
  });

  it("handles string data", () => {
    const result = createCommandResult({
      success: true,
      command: "test",
      data: "plain text output",
      exitCode: 0,
    });

    const output = formatHuman(result);
    expect(output).toContain("plain text output");
  });

  it("handles null data", () => {
    const result = createCommandResult({
      success: true,
      command: "test",
      data: null,
      exitCode: 0,
    });

    const output = formatHuman(result as CommandResult<unknown>);
    expect(output).toContain("[OK] test");
  });
});

describe("formatJson", () => {
  it("returns valid JSON string", () => {
    const result = createCommandResult({
      success: true,
      command: "test",
      data: { key: "value" },
      exitCode: 0,
    });

    const json = formatJson(result);
    const parsed = JSON.parse(json);
    expect(parsed.success).toBe(true);
    expect(parsed.data.key).toBe("value");
  });
});
