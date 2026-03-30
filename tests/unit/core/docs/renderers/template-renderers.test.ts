import { describe, it, expect } from "vitest";
import {
  renderRuleTemplateList,
  renderSkillTemplatesByCategory,
  extractSkillCategory,
  renderAgentTemplateList,
  renderCommandTemplateList,
} from "#src/core/docs/renderers/template-renderers.js";
import { AVAILABLE_TEMPLATES } from "#src/core/scaffolder/template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "#src/core/scaffolder/skill-template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "#src/core/scaffolder/agent-template-loader.js";
import { AVAILABLE_COMMAND_TEMPLATES } from "#src/core/scaffolder/command-template-loader.js";

describe("renderRuleTemplateList", () => {
  it("includes all rule template names", () => {
    const result = renderRuleTemplateList(AVAILABLE_TEMPLATES);
    for (const name of AVAILABLE_TEMPLATES) {
      expect(result).toContain(`\`${name}\``);
    }
  });

  it("sorts names alphabetically", () => {
    const result = renderRuleTemplateList(["z-rule", "a-rule", "m-rule"]);
    const idx = (s: string) => result.indexOf(s);
    expect(idx("`a-rule`")).toBeLessThan(idx("`m-rule`"));
    expect(idx("`m-rule`")).toBeLessThan(idx("`z-rule`"));
  });
});

describe("renderAgentTemplateList", () => {
  it("includes all agent template names", () => {
    const result = renderAgentTemplateList(AVAILABLE_AGENT_TEMPLATES);
    for (const name of AVAILABLE_AGENT_TEMPLATES) {
      expect(result).toContain(`\`${name}\``);
    }
  });
});

describe("renderCommandTemplateList", () => {
  it("includes all command template names", () => {
    const result = renderCommandTemplateList(AVAILABLE_COMMAND_TEMPLATES);
    for (const name of AVAILABLE_COMMAND_TEMPLATES) {
      expect(result).toContain(`\`${name}\``);
    }
  });
});

describe("extractSkillCategory", () => {
  it("extracts category from frontmatter", () => {
    const content = "---\nname: test\ncategory: Code Quality\n---\nBody";
    expect(extractSkillCategory(content)).toBe("Code Quality");
  });

  it("returns Uncategorized when no category", () => {
    const content = "---\nname: test\n---\nBody";
    expect(extractSkillCategory(content)).toBe("Uncategorized");
  });
});

describe("renderSkillTemplatesByCategory", () => {
  it("produces a table grouped by category", () => {
    const map = {
      "Code Quality": ["code-review", "testing"],
      Tools: ["mcp"],
    };
    const result = renderSkillTemplatesByCategory(map);

    expect(result).toContain("| Category |");
    expect(result).toContain("**Code Quality**");
    expect(result).toContain("**Tools**");
    expect(result).toContain("code-review");
  });

  it("sorts categories alphabetically", () => {
    const map = { Z: ["z"], A: ["a"] };
    const result = renderSkillTemplatesByCategory(map);
    expect(result.indexOf("**A**")).toBeLessThan(result.indexOf("**Z**"));
  });
});

describe("template counts match source arrays", () => {
  it("rule templates count", () => {
    expect(AVAILABLE_TEMPLATES.length).toBeGreaterThan(0);
    const result = renderRuleTemplateList(AVAILABLE_TEMPLATES);
    const backtickPairs = (result.match(/`[^`]+`/g) ?? []).length;
    expect(backtickPairs).toBe(AVAILABLE_TEMPLATES.length);
  });

  it("skill templates count", () => {
    expect(AVAILABLE_SKILL_TEMPLATES.length).toBeGreaterThan(0);
  });

  it("agent templates count", () => {
    expect(AVAILABLE_AGENT_TEMPLATES.length).toBeGreaterThan(0);
    const result = renderAgentTemplateList(AVAILABLE_AGENT_TEMPLATES);
    const backtickPairs = (result.match(/`[^`]+`/g) ?? []).length;
    expect(backtickPairs).toBe(AVAILABLE_AGENT_TEMPLATES.length);
  });

  it("command templates count", () => {
    expect(AVAILABLE_COMMAND_TEMPLATES.length).toBeGreaterThan(0);
    const result = renderCommandTemplateList(AVAILABLE_COMMAND_TEMPLATES);
    const backtickPairs = (result.match(/`[^`]+`/g) ?? []).length;
    expect(backtickPairs).toBe(AVAILABLE_COMMAND_TEMPLATES.length);
  });
});
