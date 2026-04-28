import { describe, it, expect } from "vitest";
import { FLAG_CATALOG, buildFlagSchema, getDefaultFlags } from "#src/core/flags/flag-catalog.js";
import type { FlagSpec } from "#src/types/flags.js";

/** Synthetic catalog with a number flag for testing number-type schema validation. */
const testCatalog: Record<string, FlagSpec> = {
  ...FLAG_CATALOG,
  test_num: {
    type: "number" as const,
    default: 100,
    min: 1,
    hook: null,
    description: "Test number flag",
  },
};

describe("FLAG_CATALOG", () => {
  it("has exactly 21 entries", () => {
    expect(Object.keys(FLAG_CATALOG)).toHaveLength(21);
  });

  it("contains all expected flag names", () => {
    const expected = [
      "auto_commit",
      "test_before_commit",
      "security_scan",
      "type_checking",
      "require_tests",
      "allow_shell_commands",
      "allow_file_deletion",
      "lint_on_save",
      "allow_force_push",
      "require_pr_review",
      "mcp_allowed_servers",
      "require_documentation",
      "doc_protected_branches",
      "allowed_languages",
      "progressive_loading",
      "drift_detection",
      "auto_generate_on_change",
      "python_type_checker",
      "js_format_lint",
      "commit_type_check",
      "commit_test_run",
    ];
    expect(Object.keys(FLAG_CATALOG).sort()).toEqual(expected.sort());
  });

  it("every spec has required fields", () => {
    for (const [_name, spec] of Object.entries(FLAG_CATALOG)) {
      expect(spec).toHaveProperty("type");
      expect(spec).toHaveProperty("default");
      expect(spec).toHaveProperty("description");
      expect(["boolean", "number", "enum", "string[]"]).toContain(spec.type);
    }
  });

  it("enum specs have values array", () => {
    for (const [_name, spec] of Object.entries(FLAG_CATALOG)) {
      if (spec.type === "enum") {
        expect(spec.values).toBeDefined();
        expect(spec.values!.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("buildFlagSchema", () => {
  const schema = buildFlagSchema(FLAG_CATALOG);

  it("rejects unknown flag names", () => {
    const result = schema.safeParse({ unknown_flag: true });
    expect(result.success).toBe(false);
  });

  it("accepts valid boolean flag", () => {
    const result = schema.safeParse({ auto_commit: true });
    expect(result.success).toBe(true);
  });

  it("rejects non-boolean for boolean flag", () => {
    const result = schema.safeParse({ auto_commit: "yes" });
    expect(result.success).toBe(false);
  });

  it("accepts valid number flag (synthetic test_num)", () => {
    const testSchema = buildFlagSchema(testCatalog);
    const result = testSchema.safeParse({ test_num: 200 });
    expect(result.success).toBe(true);
  });

  it("rejects negative number for number flag (synthetic test_num)", () => {
    const testSchema = buildFlagSchema(testCatalog);
    const result = testSchema.safeParse({ test_num: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts valid enum value", () => {
    const result = schema.safeParse({ type_checking: "strict" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid enum value", () => {
    const result = schema.safeParse({ type_checking: "invalid" });
    expect(result.success).toBe(false);
  });

  it("accepts empty object (all optional)", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("skips enum flag with empty values array", () => {
    const catalog: Record<string, FlagSpec> = {
      empty_enum: {
        type: "enum" as const,
        default: "none",
        values: [],
        hook: null,
        description: "Enum with no values",
      },
      keep_bool: {
        type: "boolean" as const,
        default: true,
        hook: null,
        description: "Boolean flag to keep",
      },
    };
    const s = buildFlagSchema(catalog);
    // empty_enum should be silently skipped — not present in schema
    expect(s.safeParse({ keep_bool: true }).success).toBe(true);
    expect(s.safeParse({ empty_enum: "anything" }).success).toBe(false);
  });
});

describe("getDefaultFlags", () => {
  const defaults = getDefaultFlags();

  it("returns all 21 flags", () => {
    expect(Object.keys(defaults)).toHaveLength(21);
  });

  it("auto_commit defaults to false", () => {
    expect(defaults["auto_commit"]!.value).toBe(false);
  });

  it("test_before_commit defaults to true", () => {
    expect(defaults["test_before_commit"]!.value).toBe(true);
  });

  it("type_checking defaults to strict", () => {
    expect(defaults["type_checking"]!.value).toBe("strict");
  });

  it("lint_on_save defaults to true", () => {
    expect(defaults["lint_on_save"]!.value).toBe(true);
  });

  it("allow_force_push defaults to false", () => {
    expect(defaults["allow_force_push"]!.value).toBe(false);
  });

  it("require_pr_review defaults to true", () => {
    expect(defaults["require_pr_review"]!.value).toBe(true);
  });

  it("mcp_allowed_servers defaults to empty array", () => {
    expect(defaults["mcp_allowed_servers"]!.value).toEqual([]);
  });

  it("allowed_languages defaults to wildcard", () => {
    expect(defaults["allowed_languages"]!.value).toEqual(["*"]);
  });

  it("progressive_loading defaults to metadata", () => {
    expect(defaults["progressive_loading"]!.value).toBe("metadata");
  });

  it("drift_detection defaults to warn", () => {
    expect(defaults["drift_detection"]!.value).toBe("warn");
  });

  it("auto_generate_on_change defaults to false", () => {
    expect(defaults["auto_generate_on_change"]!.value).toBe(false);
  });

  it('all defaults have source "default"', () => {
    for (const flag of Object.values(defaults)) {
      expect(flag.source).toBe("default");
    }
  });

  it("no defaults are locked", () => {
    for (const flag of Object.values(defaults)) {
      expect(flag.locked).toBe(false);
    }
  });

  it.each([
    "python_type_checker",
    "js_format_lint",
    "commit_type_check",
    "commit_test_run",
  ] as const)("%s is registered with default 'auto'", (key) => {
    const spec = FLAG_CATALOG[key];
    expect(spec).toBeDefined();
    expect(spec!.default).toBe("auto");
    expect(spec!.type).toBe("enum");
    expect(spec!.values).toContain("auto");
  });

  it("python_type_checker enumerates mypy, basedpyright, pyright, off", () => {
    expect(FLAG_CATALOG["python_type_checker"]!.values).toEqual([
      "auto",
      "mypy",
      "basedpyright",
      "pyright",
      "off",
    ]);
  });

  it("js_format_lint enumerates eslint-prettier, biome, off", () => {
    expect(FLAG_CATALOG["js_format_lint"]!.values).toEqual([
      "auto",
      "eslint-prettier",
      "biome",
      "off",
    ]);
  });
});
