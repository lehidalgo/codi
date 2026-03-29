import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { scanSkills, scanCodiDir } from "../../../src/core/config/parser.js";

describe("scanSkills", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-parser-skills-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when skills dir does not exist", async () => {
    const result = await scanSkills(path.join(tmpDir, "nonexistent"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it("parses a valid SKILL.md file in a skill directory", async () => {
    const skillsDir = path.join(tmpDir, "skills");
    const skillDir = path.join(skillsDir, "review");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: review
description: Code review skill
type: skill
compatibility: [claude-code]
tools: [read, grep]
---

Review code for bugs and security issues.
`,
    );

    const result = await scanSkills(skillsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.name).toBe("review");
    expect(result.data[0]!.description).toBe("Code review skill");
    expect(result.data[0]!.content).toBe(
      "Review code for bugs and security issues.",
    );
    expect(result.data[0]!.compatibility).toEqual(["claude-code"]);
    expect(result.data[0]!.tools).toEqual(["read", "grep"]);
  });

  it("parses multiple skill directories", async () => {
    const skillsDir = path.join(tmpDir, "skills");

    for (const name of ["alpha", "beta"]) {
      const skillDir = path.join(skillsDir, name);
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: ${name}
description: ${name} skill
type: skill
---

Content for ${name}.
`,
      );
    }

    const result = await scanSkills(skillsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
  });

  it("returns error for invalid frontmatter", async () => {
    const skillsDir = path.join(tmpDir, "skills");
    const skillDir = path.join(skillsDir, "bad");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: 123
---

Content.
`,
    );

    const result = await scanSkills(skillsDir);
    expect(result.ok).toBe(false);
  });

  it("ignores non-SKILL.md markdown files in skill directories", async () => {
    const skillsDir = path.join(tmpDir, "skills");
    const skillDir = path.join(skillsDir, "my-skill");
    const refsDir = path.join(skillDir, "references");
    const agentsDir = path.join(skillDir, "agents");
    await fs.mkdir(refsDir, { recursive: true });
    await fs.mkdir(agentsDir, { recursive: true });

    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: my-skill
description: A skill with supplementary files
---

Main skill content.
`,
    );

    // These supplementary files should NOT be detected as skills
    await fs.writeFile(
      path.join(refsDir, "guide.md"),
      "# Reference Guide\n\nSome reference content.",
    );
    await fs.writeFile(
      path.join(agentsDir, "grader.md"),
      "# Grader Agent\n\nGrading instructions.",
    );

    const result = await scanSkills(skillsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.name).toBe("my-skill");
  });
});

describe("scanCodiDir with skills", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-scan-skills-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("includes skills in parsed result", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    const skillDir = path.join(codiDir, "skills", "my-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.mkdir(path.join(codiDir, "rules"), { recursive: true });

    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      `name: test-project\nversion: "1"\n`,
    );

    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: my-skill
description: A test skill
type: skill
---

Skill content here.
`,
    );

    const result = await scanCodiDir(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skills).toHaveLength(1);
    expect(result.data.skills[0]!.name).toBe("my-skill");
  });
});
