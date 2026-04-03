import { describe, it, expect } from "vitest";
import { loadTemplate, AVAILABLE_TEMPLATES } from "#src/core/scaffolder/template-loader.js";
import {
  loadAgentTemplate,
  AVAILABLE_AGENT_TEMPLATES,
} from "#src/core/scaffolder/agent-template-loader.js";
import { prefixedName } from "#src/constants.js";

describe("template-loader (rules)", () => {
  it("has available templates", () => {
    expect(AVAILABLE_TEMPLATES.length).toBeGreaterThan(0);
    expect(AVAILABLE_TEMPLATES).toContain(prefixedName("security"));
    expect(AVAILABLE_TEMPLATES).toContain(prefixedName("testing"));
  });

  it("loads a known template", () => {
    const result = loadTemplate(prefixedName("security"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("returns error for unknown template", () => {
    const result = loadTemplate("nonexistent");
    expect(result.ok).toBe(false);
  });
});

describe("agent-template-loader", () => {
  it("has available templates", () => {
    expect(AVAILABLE_AGENT_TEMPLATES.length).toBeGreaterThan(0);
    expect(AVAILABLE_AGENT_TEMPLATES).toContain(prefixedName("code-reviewer"));
    expect(AVAILABLE_AGENT_TEMPLATES).toContain(prefixedName("test-generator"));
  });

  it("loads a known template", () => {
    const result = loadAgentTemplate(prefixedName("code-reviewer"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("returns error for unknown template", () => {
    const result = loadAgentTemplate("nonexistent");
    expect(result.ok).toBe(false);
  });
});
