import { describe, it, expect } from "vitest";
import {
  buildSkillMd,
  buildSkillMetadataOnly,
  generateSkillFiles,
  buildSkillCatalog,
} from "#src/adapters/skill-generator.js";
import {
  PROJECT_NAME_DISPLAY,
  PROJECT_DIR,
  MANIFEST_FILENAME,
} from "#src/constants.js";
import type { NormalizedSkill } from "#src/types/config.js";

const baseSkill: NormalizedSkill = {
  name: "deploy",
  description: "Deployment skill",
  content: "Run deploy commands here.",
};

describe("buildSkillMd", () => {
  it("includes frontmatter with name and description", () => {
    const result = buildSkillMd(baseSkill);
    expect(result).toContain("name: deploy");
    expect(result).toContain("description: Deployment skill");
    expect(result).toContain("Run deploy commands here.");
  });

  it("includes disableModelInvocation when set", () => {
    const result = buildSkillMd({ ...baseSkill, disableModelInvocation: true });
    expect(result).toContain("disable-model-invocation: true");
  });

  it("includes argumentHint when set", () => {
    const result = buildSkillMd({ ...baseSkill, argumentHint: "service name" });
    expect(result).toContain('argument-hint: "service name"');
  });

  it("includes allowedTools when set", () => {
    const result = buildSkillMd({
      ...baseSkill,
      allowedTools: ["Read", "Bash"],
    });
    expect(result).toContain("allowed-tools: Read, Bash");
  });

  it("includes license when set", () => {
    const result = buildSkillMd({ ...baseSkill, license: "MIT" });
    expect(result).toContain("license: MIT");
  });

  it(`does not emit metadata entries (${PROJECT_NAME_DISPLAY}-internal, stripped from output)`, () => {
    const result = buildSkillMd({
      ...baseSkill,
      metadata: { author: "test", version: "1.0" },
    });
    expect(result).not.toContain("metadata-author");
    expect(result).not.toContain("metadata-version");
  });

  it("includes new official frontmatter fields when set", () => {
    const result = buildSkillMd({
      ...baseSkill,
      model: "sonnet",
      effort: "high",
      context: "fork",
      agent: "Explore",
      userInvocable: false,
      paths: ["src/api/**"],
      shell: "bash",
    });
    expect(result).toContain("model: sonnet");
    expect(result).toContain("effort: high");
    expect(result).toContain("context: fork");
    expect(result).toContain("agent: Explore");
    expect(result).toContain("user-invocable: false");
    expect(result).toContain("paths: src/api/**");
    expect(result).toContain("shell: bash");
  });

  it("omits optional fields when not set", () => {
    const result = buildSkillMd(baseSkill);
    expect(result).not.toContain("disable-model-invocation");
    expect(result).not.toContain("argument-hint");
    expect(result).not.toContain("allowed-tools");
    expect(result).not.toContain("license");
    expect(result).not.toContain("metadata-");
  });
});

describe("buildSkillMetadataOnly", () => {
  it("includes only name and description", () => {
    const result = buildSkillMetadataOnly(baseSkill);
    expect(result).toContain("name: deploy");
    expect(result).toContain("description: Deployment skill");
    expect(result).not.toContain("Run deploy commands");
  });

  it("includes reference to full skill file", () => {
    const result = buildSkillMetadataOnly(baseSkill);
    expect(result).toContain(`${PROJECT_DIR}/skills/deploy/SKILL.md`);
  });
});

describe("generateSkillFiles", () => {
  const skills: NormalizedSkill[] = [
    { name: "deploy", description: "Deploy", content: "deploy content" },
    { name: "review", description: "Review", content: "review content" },
  ];

  it("generates SKILL.md + skeleton per skill", async () => {
    const files = await generateSkillFiles(skills, ".claude/skills");
    // Each skill: 1 SKILL.md + 3 .gitkeep (scripts, references, assets)
    expect(files).toHaveLength(8);
    const skillMds = files.filter((f) => f.path.endsWith("SKILL.md"));
    expect(skillMds).toHaveLength(2);
    expect(skillMds[0]!.path).toBe(".claude/skills/deploy/SKILL.md");
    expect(skillMds[1]!.path).toBe(".claude/skills/review/SKILL.md");
  });

  it("creates skeleton .gitkeep files", async () => {
    const files = await generateSkillFiles(skills, ".claude/skills");
    const gitkeeps = files.filter((f) => f.path.endsWith(".gitkeep"));
    expect(gitkeeps).toHaveLength(6); // 3 per skill
    expect(gitkeeps.some((f) => f.path.includes("scripts/.gitkeep"))).toBe(
      true,
    );
    expect(gitkeeps.some((f) => f.path.includes("references/.gitkeep"))).toBe(
      true,
    );
    expect(gitkeeps.some((f) => f.path.includes("assets/.gitkeep"))).toBe(true);
  });

  it("uses full content when progressive loading is off", async () => {
    const files = await generateSkillFiles(skills, ".test/skills", "off");
    const skillMd = files.find((f) => f.path.endsWith("SKILL.md"));
    expect(skillMd!.content).toContain("deploy content");
  });

  it("uses metadata only when progressive loading is metadata", async () => {
    const files = await generateSkillFiles(skills, ".test/skills", "metadata");
    const skillMd = files.find((f) => f.path.endsWith("SKILL.md"));
    expect(skillMd!.content).not.toContain("deploy content");
    expect(skillMd!.content).toContain("Full skill content available");
  });

  it("returns empty array for no skills", async () => {
    const files = await generateSkillFiles([], ".claude/skills");
    expect(files).toHaveLength(0);
  });

  it("each file has hash and sources", async () => {
    const files = await generateSkillFiles(skills, ".claude/skills");
    for (const file of files) {
      expect(file.hash).toBeDefined();
      expect(file.sources).toContain(MANIFEST_FILENAME);
    }
  });
});

describe("buildSkillCatalog", () => {
  it("returns null when no skills", () => {
    expect(buildSkillCatalog([])).toBeNull();
  });

  it("builds markdown table with skills", () => {
    const skills: NormalizedSkill[] = [
      { name: "deploy", description: "Deploy to production", content: "c" },
      {
        name: "review",
        description: "Code review\nExtra detail",
        content: "c",
      },
    ];
    const result = buildSkillCatalog(skills)!;
    expect(result).toContain("## Available Skills");
    expect(result).toContain("| deploy | Deploy to production |");
    expect(result).toContain("| review | Code review |");
    expect(result).toContain(`${PROJECT_DIR}/skills/<name>/SKILL.md`);
  });
});
