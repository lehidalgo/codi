import { describe, it, expect } from "vitest";
import {
  ProjectManifestSchema,
  AgentFrontmatterSchema,
  RuleFrontmatterSchema,
  SkillFrontmatterSchema,
  FlagModeSchema,
  FlagConditionsSchema,
  FlagDefinitionSchema,
  McpConfigSchema,
  HookDefinitionSchema,
  HooksConfigSchema,
} from "../../src/schemas/index.js";
import {
  PROJECT_NAME,
  ALL_SKILL_CATEGORIES,
  SKILL_CATEGORIES,
  SKILL_CATEGORY,
  isKnownSkillCategory,
} from "#src/constants.js";
import {
  AVAILABLE_SKILL_TEMPLATES,
  loadSkillTemplateContent,
} from "../../src/core/scaffolder/skill-template-loader.js";

describe("ProjectManifestSchema", () => {
  it("accepts valid manifest", () => {
    const result = ProjectManifestSchema.safeParse({
      name: "my-project",
      version: "1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts manifest with all fields", () => {
    const result = ProjectManifestSchema.safeParse({
      name: "my-project",
      version: "1",
      description: "A test project",
      agents: ["claude", "cursor"],
      layers: { rules: true, skills: false },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid name with uppercase", () => {
    const result = ProjectManifestSchema.safeParse({
      name: "MyProject",
      version: "1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid version", () => {
    const result = ProjectManifestSchema.safeParse({
      name: "ok",
      version: "2",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 64 chars", () => {
    const result = ProjectManifestSchema.safeParse({
      name: "a".repeat(65),
      version: "1",
    });
    expect(result.success).toBe(false);
  });
});

describe("RuleFrontmatterSchema", () => {
  it("accepts valid rule with defaults", () => {
    const result = RuleFrontmatterSchema.safeParse({
      name: "no-console",
      description: "Avoid console.log",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("rule");
      expect(result.data.priority).toBe("medium");
      expect(result.data.alwaysApply).toBe(true);
      expect(result.data.managed_by).toBe("user");
    }
  });

  it("rejects missing description", () => {
    const result = RuleFrontmatterSchema.safeParse({
      name: "test-rule",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority", () => {
    const result = RuleFrontmatterSchema.safeParse({
      name: "test",
      description: "test",
      priority: "urgent",
    });
    expect(result.success).toBe(false);
  });
});

describe("SkillFrontmatterSchema", () => {
  it("accepts valid skill", () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: "code-review",
      description: "Review code for issues",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("skill");
    }
  });

  it("accepts skill with optional fields", () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: "test-skill",
      description: "A skill",
      compatibility: ["claude-code", "cursor"],
      tools: ["read", "write"],
      model: "gpt-4",
    });
    expect(result.success).toBe(true);
  });
});

describe("FlagModeSchema", () => {
  it("accepts all valid modes", () => {
    const modes = [
      "enforced",
      "enabled",
      "disabled",
      "inherited",
      "delegated_to_agent_default",
      "conditional",
    ];
    for (const mode of modes) {
      expect(FlagModeSchema.safeParse(mode).success).toBe(true);
    }
  });

  it("rejects invalid mode", () => {
    expect(FlagModeSchema.safeParse("auto").success).toBe(false);
  });
});

describe("FlagConditionsSchema", () => {
  it("accepts conditions with at least one field", () => {
    const result = FlagConditionsSchema.safeParse({ lang: ["typescript"] });
    expect(result.success).toBe(true);
  });

  it("rejects empty conditions", () => {
    const result = FlagConditionsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("FlagDefinitionSchema", () => {
  it("accepts basic enforced flag", () => {
    const result = FlagDefinitionSchema.safeParse({
      mode: "enforced",
      value: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects conditional without conditions", () => {
    const result = FlagDefinitionSchema.safeParse({
      mode: "conditional",
      value: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects enforced with conditions", () => {
    const result = FlagDefinitionSchema.safeParse({
      mode: "enforced",
      value: true,
      conditions: { lang: ["ts"] },
    });
    expect(result.success).toBe(false);
  });

  it("accepts conditional with conditions", () => {
    const result = FlagDefinitionSchema.safeParse({
      mode: "conditional",
      value: true,
      conditions: { agent: ["claude"] },
    });
    expect(result.success).toBe(true);
  });
});

describe("McpConfigSchema", () => {
  it("accepts empty servers with default", () => {
    const result = McpConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servers).toEqual({});
    }
  });

  it("accepts valid server config", () => {
    const result = McpConfigSchema.safeParse({
      servers: {
        "my-server": {
          command: "node",
          args: ["server.js"],
          env: { PORT: "3000" },
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("HookDefinitionSchema", () => {
  it("accepts valid hook", () => {
    const result = HookDefinitionSchema.safeParse({
      name: "lint-check",
      command: "pnpm lint",
      condition: "always",
    });
    expect(result.success).toBe(true);
  });

  it("rejects hook with invalid name", () => {
    const result = HookDefinitionSchema.safeParse({
      name: "Lint Check",
      command: "pnpm lint",
      condition: "always",
    });
    expect(result.success).toBe(false);
  });
});

describe("HooksConfigSchema", () => {
  it("accepts valid hooks config", () => {
    const result = HooksConfigSchema.safeParse({
      version: "1",
      runner: PROJECT_NAME,
      install_method: "git-hooks",
      hooks: {
        "pre-commit": {
          lint: [
            {
              name: "eslint",
              command: "pnpm lint",
              condition: "always",
            },
          ],
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("skill template categories", () => {
  it("ALL_SKILL_CATEGORIES has no duplicate values", () => {
    const unique = new Set(ALL_SKILL_CATEGORIES);
    expect(unique.size).toBe(ALL_SKILL_CATEGORIES.length);
  });

  it("isKnownSkillCategory returns true for all built-in categories", () => {
    for (const cat of ALL_SKILL_CATEGORIES) {
      expect(isKnownSkillCategory(cat)).toBe(true);
    }
  });

  it("isKnownSkillCategory returns false for unknown values", () => {
    expect(isKnownSkillCategory("")).toBe(false);
    expect(isKnownSkillCategory("Random Category")).toBe(false);
  });

  it("every built-in skill template has a known category", () => {
    const CATEGORY_PATTERN = /^category:\s*(.+)$/m;
    const HAS_PLACEHOLDER = /\$\{[^}]+\}/;
    const unknown: string[] = [];

    for (const name of AVAILABLE_SKILL_TEMPLATES) {
      const loaded = loadSkillTemplateContent(name);
      if (!loaded.ok || !loaded.data) continue;
      const m = loaded.data.match(CATEGORY_PATTERN);
      if (!m) continue;
      const raw = m[1]!.trim();
      // Template interpolation tokens resolve to the platform category at runtime.
      if (HAS_PLACEHOLDER.test(raw)) continue;
      if (!isKnownSkillCategory(raw)) {
        unknown.push(`${name}: "${raw}"`);
      }
    }

    expect(unknown).toEqual([]);
  });
});

describe("category field — SkillFrontmatterSchema", () => {
  it("accepts a valid category", () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: "my-skill",
      description: "A skill",
      category: "Code Quality",
    });
    expect(result.success).toBe(true);
  });

  it("accepts omitted category (optional)", () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: "my-skill",
      description: "A skill",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.category).toBeUndefined();
  });

  it("accepts all known categories", () => {
    const validCategories = [
      "Brand Identity",
      "Code Quality",
      "Content Creation",
      "Content Refinement",
      "Creative and Design",
      "Developer Tools",
      "Developer Workflow",
      "Document Generation",
      "File Format Tools",
      "Planning",
      "Productivity",
      "Testing",
      "Workflow",
    ];
    for (const category of validCategories) {
      const result = SkillFrontmatterSchema.safeParse({
        name: "my-skill",
        description: "A skill",
        category,
      });
      expect(result.success, `Expected category "${category}" to be valid`).toBe(true);
    }
  });

  it("rejects unknown category string", () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: "my-skill",
      description: "A skill",
      category: "Invalid Category XYZ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty string category", () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: "my-skill",
      description: "A skill",
      category: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("SKILL_CATEGORY constant", () => {
  it("covers every value in SKILL_CATEGORIES", () => {
    const values = Object.values(SKILL_CATEGORY);
    for (const cat of SKILL_CATEGORIES) {
      expect(values).toContain(cat);
    }
  });

  it("has no extra values outside SKILL_CATEGORIES", () => {
    for (const val of Object.values(SKILL_CATEGORY) as string[]) {
      expect(isKnownSkillCategory(val)).toBe(true);
    }
  });
});

describe("version field — SkillFrontmatterSchema", () => {
  it("accepts version: 1", () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: "my-skill",
      description: "A skill",
      version: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.version).toBe(1);
  });

  it("defaults version to 1 when omitted", () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: "my-skill",
      description: "A skill",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.version).toBe(1);
  });

  it("rejects version: 0", () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: "my-skill",
      description: "A skill",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects version: -1", () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: "my-skill",
      description: "A skill",
      version: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects version: '1' (string)", () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: "my-skill",
      description: "A skill",
      version: "1",
    });
    expect(result.success).toBe(false);
  });
});

describe("version field — AgentFrontmatterSchema", () => {
  it("accepts version: 1", () => {
    const result = AgentFrontmatterSchema.safeParse({
      name: "my-agent",
      description: "An agent",
      version: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.version).toBe(1);
  });

  it("defaults version to 1 when omitted", () => {
    const result = AgentFrontmatterSchema.safeParse({
      name: "my-agent",
      description: "An agent",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.version).toBe(1);
  });

  it("rejects version: 0", () => {
    const result = AgentFrontmatterSchema.safeParse({
      name: "my-agent",
      description: "An agent",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects version: -1", () => {
    const result = AgentFrontmatterSchema.safeParse({
      name: "my-agent",
      description: "An agent",
      version: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects version: '1' (string)", () => {
    const result = AgentFrontmatterSchema.safeParse({
      name: "my-agent",
      description: "An agent",
      version: "1",
    });
    expect(result.success).toBe(false);
  });
});

describe("version field — RuleFrontmatterSchema", () => {
  it("accepts version: 1", () => {
    const result = RuleFrontmatterSchema.safeParse({
      name: "my-rule",
      description: "A rule",
      version: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.version).toBe(1);
  });

  it("defaults version to 1 when omitted", () => {
    const result = RuleFrontmatterSchema.safeParse({
      name: "my-rule",
      description: "A rule",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.version).toBe(1);
  });

  it("rejects version: 0", () => {
    const result = RuleFrontmatterSchema.safeParse({
      name: "my-rule",
      description: "A rule",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects version: -1", () => {
    const result = RuleFrontmatterSchema.safeParse({
      name: "my-rule",
      description: "A rule",
      version: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects version: '1' (string)", () => {
    const result = RuleFrontmatterSchema.safeParse({
      name: "my-rule",
      description: "A rule",
      version: "1",
    });
    expect(result.success).toBe(false);
  });
});
