import { describe, it, expect } from "vitest";
import {
  RULE_CATEGORIES,
  AGENT_CATEGORIES,
  MCP_SERVER_CATEGORIES,
  buildSkillCategoryMap,
  buildGroupedOptions,
  buildGroupedBasicOptions,
  buildGroupedUpgradeOptions,
  buildGroupedInventoryOptions,
  formatLabel,
  extractTemplateHint,
  formatStatusBadge,
  formatInventoryStatusBadge,
} from "#src/cli/artifact-categories.js";
import { AVAILABLE_TEMPLATES } from "#src/core/scaffolder/template-loader.js";
import {
  AVAILABLE_SKILL_TEMPLATES,
  loadSkillTemplateContent,
} from "#src/core/scaffolder/skill-template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "#src/core/scaffolder/agent-template-loader.js";
import { AVAILABLE_MCP_SERVER_TEMPLATES } from "#src/core/scaffolder/mcp-template-loader.js";

// --- formatLabel ---

describe("formatLabel", () => {
  it("capitalizes a single word", () => {
    expect(formatLabel("typescript")).toBe("Typescript");
  });

  it("capitalizes hyphenated words", () => {
    expect(formatLabel("frontend-design")).toBe("Frontend Design");
  });

  it("handles a prefix pattern", () => {
    expect(formatLabel("codi-code-style")).toBe("Codi Code Style");
  });
});

// --- extractTemplateHint ---

describe("extractTemplateHint", () => {
  it("extracts single-line description", () => {
    const content = "name: foo\ndescription: A short description\nother: value";
    expect(extractTemplateHint(content)).toBe("A short description");
  });

  it("extracts multi-line block description (first line)", () => {
    const content = "description: |\n  First line of description\n  Second line";
    expect(extractTemplateHint(content)).toBe("First line of description");
  });

  it("returns empty string when no description field", () => {
    expect(extractTemplateHint("name: foo\nother: bar")).toBe("");
  });
});

// --- formatStatusBadge ---

describe("formatStatusBadge", () => {
  it('returns " [update]" for outdated', () => {
    expect(formatStatusBadge("outdated")).toBe(" [update]");
  });

  it('returns " [new]" for new', () => {
    expect(formatStatusBadge("new")).toBe(" [new]");
  });

  it('returns " [deprecated]" for removed', () => {
    expect(formatStatusBadge("removed")).toBe(" [deprecated]");
  });

  it('returns " [user]" for user-managed', () => {
    expect(formatStatusBadge("user-managed")).toBe(" [user]");
  });

  it("returns empty string for up-to-date", () => {
    expect(formatStatusBadge("up-to-date")).toBe("");
  });
});

describe("formatInventoryStatusBadge", () => {
  it('returns " [installed]" for builtin-original', () => {
    expect(formatInventoryStatusBadge("builtin-original")).toBe(" [installed]");
  });

  it('returns " [modified]" for builtin-modified', () => {
    expect(formatInventoryStatusBadge("builtin-modified")).toBe(" [modified]");
  });

  it('returns " [deprecated]" for builtin-removed', () => {
    expect(formatInventoryStatusBadge("builtin-removed")).toBe(" [deprecated]");
  });
});

// --- RULE_CATEGORIES coverage ---

describe("RULE_CATEGORIES", () => {
  it("covers all AVAILABLE_TEMPLATES", () => {
    const allCategorized = new Set(Object.values(RULE_CATEGORIES).flat());
    for (const name of AVAILABLE_TEMPLATES) {
      expect(allCategorized.has(name)).toBe(true);
    }
  });

  it("has no duplicate template names across groups", () => {
    const seen = new Set<string>();
    for (const names of Object.values(RULE_CATEGORIES)) {
      for (const name of names) {
        expect(seen.has(name)).toBe(false);
        seen.add(name);
      }
    }
  });
});

// --- AGENT_CATEGORIES coverage ---

describe("AGENT_CATEGORIES", () => {
  it("covers all AVAILABLE_AGENT_TEMPLATES", () => {
    const allCategorized = new Set(Object.values(AGENT_CATEGORIES).flat());
    for (const name of AVAILABLE_AGENT_TEMPLATES) {
      expect(allCategorized.has(name)).toBe(true);
    }
  });

  it("has no duplicate template names", () => {
    const seen = new Set<string>();
    for (const names of Object.values(AGENT_CATEGORIES)) {
      for (const name of names) {
        expect(seen.has(name)).toBe(false);
        seen.add(name);
      }
    }
  });
});

// --- MCP_SERVER_CATEGORIES coverage ---

describe("MCP_SERVER_CATEGORIES", () => {
  it("covers all AVAILABLE_MCP_SERVER_TEMPLATES", () => {
    const allCategorized = new Set(Object.values(MCP_SERVER_CATEGORIES).flat());
    for (const name of AVAILABLE_MCP_SERVER_TEMPLATES) {
      expect(allCategorized.has(name)).toBe(true);
    }
  });
});

// --- buildSkillCategoryMap ---

describe("buildSkillCategoryMap", () => {
  it("groups skill templates by their category frontmatter", () => {
    const loadFn = (name: string) => ({
      ok: true,
      data: `category: Code Quality\nname: ${name}`,
    });
    const map = buildSkillCategoryMap(["skill-a", "skill-b"], loadFn);
    expect(map["Code Quality"]).toEqual(["skill-a", "skill-b"]);
  });

  it("resolves platform placeholder to Codi Platform", () => {
    const loadFn = () => ({ ok: true, data: "category: ${PROJECT_NAME_DISPLAY} Platform" });
    const map = buildSkillCategoryMap(["ops-skill"], loadFn);
    expect(map["Codi Platform"]).toEqual(["ops-skill"]);
  });

  it("passes through unknown category values as-is", () => {
    const loadFn = () => ({ ok: true, data: "category: brand" });
    const map = buildSkillCategoryMap(["brand-skill"], loadFn);
    expect(map["brand"]).toEqual(["brand-skill"]);
  });

  it("places skill without category in Other group", () => {
    const loadFn = () => ({ ok: true, data: "name: no-category" });
    const map = buildSkillCategoryMap(["orphan"], loadFn);
    expect(map["Other"]).toEqual(["orphan"]);
  });

  it("covers all AVAILABLE_SKILL_TEMPLATES without orphans", () => {
    const map = buildSkillCategoryMap(AVAILABLE_SKILL_TEMPLATES, (n) =>
      loadSkillTemplateContent(n),
    );
    const allGrouped = new Set(Object.values(map).flat());
    for (const name of AVAILABLE_SKILL_TEMPLATES) {
      expect(allGrouped.has(name)).toBe(true);
    }
  });
});

// --- buildGroupedOptions ---

describe("buildGroupedOptions", () => {
  const categoryMap = { GroupA: ["alpha", "beta"], GroupB: ["gamma"] };

  it("builds grouped structure with correct options", () => {
    const result = buildGroupedOptions(categoryMap, ["alpha", "beta", "gamma"], (n) => ({
      label: n,
      value: n,
      hint: "",
    }));
    expect(Object.keys(result)).toEqual(["GroupA", "GroupB"]);
    expect(result["GroupA"]?.map((o) => o.value)).toEqual(["alpha", "beta"]);
    expect(result["GroupB"]?.map((o) => o.value)).toEqual(["gamma"]);
  });

  it("places uncategorized template in Other group", () => {
    const result = buildGroupedOptions(categoryMap, ["alpha", "new-template"], (n) => ({
      label: n,
      value: n,
      hint: "",
    }));
    expect(result["Other"]).toBeDefined();
    expect(result["Other"]?.map((o) => o.value)).toContain("new-template");
  });

  it("removes empty groups", () => {
    const result = buildGroupedOptions(
      { GroupA: ["alpha"], EmptyGroup: ["not-present"] },
      ["alpha"],
      (n) => ({ label: n, value: n, hint: "" }),
    );
    expect(result["EmptyGroup"]).toBeUndefined();
    expect(result["GroupA"]).toBeDefined();
  });
});

// --- buildGroupedBasicOptions ---

describe("buildGroupedBasicOptions", () => {
  it("formats label and extracts hint from template content", () => {
    const loadFn = (n: string) => ({ ok: true, data: `description: Hint for ${n}` });
    const result = buildGroupedBasicOptions(
      ["codi-commit"],
      { "Daily Workflow": ["codi-commit"] },
      loadFn,
    );
    const option = result["Daily Workflow"]?.[0];
    expect(option?.label).toBe("Codi Commit");
    expect(option?.hint).toBe("Hint for codi-commit");
    expect(option?.value).toBe("codi-commit");
  });
});

// --- buildGroupedUpgradeOptions ---

describe("buildGroupedUpgradeOptions", () => {
  it("appends status badge to outdated artifact label", () => {
    const upgradeMap = new Map([
      [
        "codi-commit",
        {
          name: "codi-commit",
          type: "skill" as const,
          status: "outdated" as const,
          installedVersion: 1,
          availableVersion: 2,
          installedHash: "old",
          availableHash: "new",
        },
      ],
    ]);
    const loadFn = () => ({ ok: true, data: "description: Commit changes" });
    const result = buildGroupedUpgradeOptions(
      ["codi-commit"],
      { "Daily Workflow": ["codi-commit"] },
      upgradeMap,
      loadFn,
    );
    const option = result["Daily Workflow"]?.[0];
    expect(option?.label).toContain("[update]");
    expect(option?.hint).toBe("Commit changes");
  });

  it("returns plain label for up-to-date artifact", () => {
    const upgradeMap = new Map([
      [
        "codi-commit",
        {
          name: "codi-commit",
          type: "skill" as const,
          status: "up-to-date" as const,
          installedVersion: 2,
          availableVersion: 2,
          installedHash: "same",
          availableHash: "same",
        },
      ],
    ]);
    const loadFn = () => ({ ok: true, data: "description: Commit changes" });
    const result = buildGroupedUpgradeOptions(
      ["codi-commit"],
      { "Daily Workflow": ["codi-commit"] },
      upgradeMap,
      loadFn,
    );
    const option = result["Daily Workflow"]?.[0];
    expect(option?.label).toBe("Codi Commit");
  });
});

describe("buildGroupedInventoryOptions", () => {
  it("keeps builtin entries in declared groups and local-only entries in Installed Custom", () => {
    const result = buildGroupedInventoryOptions(
      [
        {
          name: "codi-code-reviewer",
          type: "agent",
          status: "builtin-original",
          installed: true,
          managedBy: "codi",
          installedArtifactVersion: 1,
          hint: "Code reviewer",
        },
        {
          name: "my-local-agent",
          type: "agent",
          status: "custom-user",
          installed: true,
          managedBy: "user",
          installedArtifactVersion: null,
          hint: "Local agent",
        },
      ],
      AGENT_CATEGORIES,
    );

    expect(result["Code Quality"]?.[0]?.label).toContain("[installed]");
    expect(result["Installed Custom"]?.[0]?.label).toContain("[user]");
    expect(result["Installed Custom"]?.[0]?.hint).toContain("user-managed local artifact");
  });

  it("marks modified builtin entries with a modified hint", () => {
    const result = buildGroupedInventoryOptions(
      [
        {
          name: "codi-code-reviewer",
          type: "agent",
          status: "builtin-modified",
          installed: true,
          managedBy: "codi",
          installedArtifactVersion: 1,
          hint: "Code reviewer",
        },
      ],
      AGENT_CATEGORIES,
    );

    const option = result["Code Quality"]?.[0];
    expect(option?.label).toContain("[modified]");
    expect(option?.hint).toBe("modified locally | Code reviewer");
  });
});
