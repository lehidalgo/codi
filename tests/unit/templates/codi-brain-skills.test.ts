import { describe, it, expect } from "vitest";
import { template as decide } from "#src/templates/skills/brain-decide/index.js";
import { template as recall } from "#src/templates/skills/brain-recall/index.js";
import { template as hotSet } from "#src/templates/skills/brain-hot-set/index.js";
import { template as hotGet } from "#src/templates/skills/brain-hot-get/index.js";
import { template as review } from "#src/templates/skills/brain-review/index.js";
import { template as undoSession } from "#src/templates/skills/brain-undo-session/index.js";

interface SkillCheck {
  name: string;
  template: string;
  mustContain: string[];
}

const skills: SkillCheck[] = [
  {
    name: "codi-brain-decide",
    template: decide,
    mustContain: ["<CODI-DECISION@v1>", "codi brain decide"],
  },
  {
    name: "codi-brain-recall",
    template: recall,
    mustContain: ["codi brain search"],
  },
  {
    name: "codi-brain-hot-set",
    template: hotSet,
    mustContain: ["codi brain hot --set", "<CODI-HOT@v1>"],
  },
  {
    name: "codi-brain-hot-get",
    template: hotGet,
    mustContain: ["codi brain hot"],
  },
  {
    name: "codi-brain-review",
    template: review,
    mustContain: ["pending-notes", "codi brain decide"],
  },
  {
    name: "codi-brain-undo-session",
    template: undoSession,
    mustContain: ["codi brain undo-session", "auto-extract-"],
  },
];

describe("codi-brain skill templates", () => {
  it.each(skills)("$name has required frontmatter", ({ template }) => {
    expect(template).toMatch(/^---\n/);
    expect(template).toContain("name: {{name}}");
    expect(template).toContain("description:");
    expect(template).toContain("user-invocable: true");
    expect(template).toContain("managed_by:");
    expect(template).toMatch(/version:\s+\d+/);
  });

  it.each(skills)("$name contains required CLI/marker refs", ({ template, mustContain }) => {
    for (const needle of mustContain) {
      expect(template).toContain(needle);
    }
  });

  it.each(skills)("$name has a body after frontmatter", ({ template }) => {
    const parts = template.split("\n---\n");
    expect(parts.length).toBeGreaterThanOrEqual(2);
    const body = parts.slice(1).join("\n---\n");
    expect(body.trim().length).toBeGreaterThan(50);
  });
});

describe("codi-brain-capture rule", () => {
  it("template has required sections", async () => {
    const mod = await import("#src/templates/rules/brain-capture.js");
    const content = mod.template as string;
    expect(content).toContain("name: {{name}}");
    expect(content).toContain("alwaysApply: true");
    expect(content).toContain("<CODI-DECISION@v1>");
    expect(content).toContain("<CODI-HOT@v1>");
    expect(content).toContain("<CODI-NOTE@v1>");
    expect(content).toMatch(/##\s+When to emit/);
    expect(content).toMatch(/##\s+When NOT to emit/);
  });
});
