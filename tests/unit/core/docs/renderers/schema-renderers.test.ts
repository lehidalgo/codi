import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  extractZodFieldInfo,
  renderZodSchemaTable,
  renderRuleFields,
  renderSkillFields,
  renderAgentFields,
  renderCommandFields,
  renderBrandFields,
  renderManifestFields,
} from "../../../../../src/core/docs/renderers/schema-renderers.js";

// ---------------------------------------------------------------------------
// extractZodFieldInfo
// ---------------------------------------------------------------------------

describe("extractZodFieldInfo", () => {
  it("detects plain string", () => {
    const info = extractZodFieldInfo(z.string());
    expect(info.typeName).toBe("string");
    expect(info.isOptional).toBe(false);
    expect(info.defaultValue).toBeUndefined();
  });

  it("detects optional string", () => {
    const info = extractZodFieldInfo(z.string().optional());
    expect(info.typeName).toBe("string");
    expect(info.isOptional).toBe(true);
  });

  it("detects default boolean", () => {
    const info = extractZodFieldInfo(z.boolean().default(true));
    expect(info.typeName).toBe("boolean");
    expect(info.defaultValue).toBe(true);
  });

  it("detects enum values", () => {
    const info = extractZodFieldInfo(z.enum(["a", "b", "c"]));
    expect(info.typeName).toContain("a");
    expect(info.typeName).toContain("b");
    expect(info.typeName).toContain("c");
  });

  it("detects array of strings", () => {
    const info = extractZodFieldInfo(z.array(z.string()));
    expect(info.typeName).toBe("string[]");
  });

  it("detects literal", () => {
    const info = extractZodFieldInfo(z.literal("rule"));
    expect(info.typeName).toContain("rule");
  });

  it("detects record", () => {
    const info = extractZodFieldInfo(z.record(z.string(), z.string()));
    expect(info.typeName).toBe("Record<string, string>");
  });

  it("detects nested object", () => {
    const info = extractZodFieldInfo(z.object({ a: z.string() }));
    expect(info.typeName).toBe("object");
  });

  it("unwraps optional + default", () => {
    const info = extractZodFieldInfo(z.string().default("hi").optional());
    expect(info.typeName).toBe("string");
    expect(info.isOptional).toBe(true);
    expect(info.defaultValue).toBe("hi");
  });
});

// ---------------------------------------------------------------------------
// renderZodSchemaTable
// ---------------------------------------------------------------------------

describe("renderZodSchemaTable", () => {
  it("produces valid Markdown table", () => {
    const schema = z.object({
      name: z.string(),
      active: z.boolean().default(true),
      tags: z.array(z.string()).optional(),
    });
    const descriptions = {
      name: "The name",
      active: "Is active",
      tags: "Tags list",
    };
    const result = renderZodSchemaTable(schema, descriptions);
    const lines = result.split("\n");

    expect(lines[0]).toContain("| Field |");
    expect(lines[1]).toMatch(/^\|[-|]+\|$/);
    expect(lines).toHaveLength(5); // header + sep + 3 rows
  });

  it("renders missing descriptions as empty", () => {
    const schema = z.object({ foo: z.string() });
    const result = renderZodSchemaTable(schema, {});

    expect(result).toContain("`foo`");
    // No crash — row ends with empty description cell
    expect(result).toMatch(/\| `foo` \|.*\|$/m);
  });
});

// ---------------------------------------------------------------------------
// Per-schema wrappers — verify row counts match actual schemas
// ---------------------------------------------------------------------------

describe("per-schema wrappers", () => {
  it("renderRuleFields matches RuleFrontmatterSchema field count", () => {
    const result = renderRuleFields();
    const dataRows = result.split("\n").slice(2); // skip header + separator
    expect(dataRows.length).toBe(8);
  });

  it("renderSkillFields matches SkillFrontmatterSchema field count", () => {
    const result = renderSkillFields();
    const dataRows = result.split("\n").slice(2);
    expect(dataRows.length).toBe(19);
  });

  it("renderAgentFields matches AgentFrontmatterSchema field count", () => {
    const result = renderAgentFields();
    const dataRows = result.split("\n").slice(2);
    expect(dataRows.length).toBe(5);
  });

  it("renderCommandFields matches CommandFrontmatterSchema field count", () => {
    const result = renderCommandFields();
    const dataRows = result.split("\n").slice(2);
    expect(dataRows.length).toBe(3);
  });

  it("renderBrandFields matches BrandFrontmatterSchema field count", () => {
    const result = renderBrandFields();
    const dataRows = result.split("\n").slice(2);
    expect(dataRows.length).toBe(3);
  });

  it("renderManifestFields includes nested fields with dot notation", () => {
    const result = renderManifestFields();

    expect(result).toContain("`layers`");
    expect(result).toContain("`layers.rules`");
    expect(result).toContain("`source.repo`");
    expect(result).toContain("`marketplace.registry`");
  });
});
