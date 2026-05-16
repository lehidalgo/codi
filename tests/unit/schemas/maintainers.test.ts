/**
 * ISSUE-056 — `maintainers:` frontmatter validation across the 3 artifact
 * schemas. Covers the canonical GitHub identifier shapes and the rejection
 * cases the CODEOWNERS spec demands.
 */

import { describe, it, expect } from "vitest";
import { RuleFrontmatterSchema } from "#src/schemas/rule.js";
import { SkillFrontmatterSchema } from "#src/schemas/skill.js";
import { AgentFrontmatterSchema } from "#src/schemas/agent.js";
import { MAINTAINER_PATTERN, DEFAULT_MAINTAINER } from "#src/constants.js";

const BASE_RULE = {
  name: "codi-test",
  description: "A test rule.",
};

const BASE_SKILL = {
  name: "codi-test",
  description: "A test skill description that is long enough to satisfy the schema.",
  category: "Developer Workflow",
  compatibility: ["claude-code"],
};

const BASE_AGENT = {
  name: "codi-test",
  description: "A test agent.",
};

describe("MAINTAINER_PATTERN", () => {
  it.each([
    "@lehidalgo",
    "@codi-org/skill-maintainers",
    "user@example.com",
    "alice.bob+tag@example.co.uk",
  ])("accepts canonical identifier %s", (id) => {
    expect(MAINTAINER_PATTERN.test(id)).toBe(true);
  });

  it.each([
    "lehidalgo", // missing @
    "@", // empty handle
    "@-bad", // leading hyphen
    "@team with spaces",
    "@org/team.with.dot", // team slugs cannot contain '.'
    "!@negation",
    "not-an-email-or-handle",
  ])("rejects malformed identifier %s", (id) => {
    expect(MAINTAINER_PATTERN.test(id)).toBe(false);
  });
});

describe("Rule schema accepts maintainers", () => {
  it("accepts a valid maintainers array", () => {
    const result = RuleFrontmatterSchema.safeParse({
      ...BASE_RULE,
      maintainers: [DEFAULT_MAINTAINER, "@codi-org/maintainers"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty maintainers array", () => {
    const result = RuleFrontmatterSchema.safeParse({
      ...BASE_RULE,
      maintainers: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed maintainer", () => {
    const result = RuleFrontmatterSchema.safeParse({
      ...BASE_RULE,
      maintainers: ["not-a-handle"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts omitted maintainers (optional field)", () => {
    const result = RuleFrontmatterSchema.safeParse(BASE_RULE);
    expect(result.success).toBe(true);
  });
});

describe("Skill schema accepts maintainers", () => {
  it("accepts a valid maintainers array", () => {
    const result = SkillFrontmatterSchema.safeParse({
      ...BASE_SKILL,
      maintainers: [DEFAULT_MAINTAINER],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed maintainer", () => {
    const result = SkillFrontmatterSchema.safeParse({
      ...BASE_SKILL,
      maintainers: ["@bad with spaces"],
    });
    expect(result.success).toBe(false);
  });
});

describe("Agent schema accepts maintainers", () => {
  it("accepts a valid maintainers array", () => {
    const result = AgentFrontmatterSchema.safeParse({
      ...BASE_AGENT,
      maintainers: [DEFAULT_MAINTAINER],
    });
    expect(result.success).toBe(true);
  });

  it("rejects @org/team.with.dot (CODEOWNERS spec rejects dots in team slugs)", () => {
    const result = AgentFrontmatterSchema.safeParse({
      ...BASE_AGENT,
      maintainers: ["@codi/skill.maintainers"],
    });
    expect(result.success).toBe(false);
  });
});
