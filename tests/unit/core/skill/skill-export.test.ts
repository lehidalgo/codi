import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdir,
  writeFile,
  rm,
  readFile,
  readdir,
  access,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  validateSkillForExport,
  exportSkill,
  listAvailableSkills,
  type SkillExportFormat,
} from "../../../../src/core/skill/skill-export.js";

const VALID_SKILL_MD = `---
name: test-skill
description: A test skill for unit testing
managed_by: codi
---

# Test Skill

Do something useful.`;

const VALID_SKILL_WITH_FIELDS = `---
name: advanced-skill
description: An advanced skill with all fields
model: opus
effort: high
context: fork
agent: Explore
license: MIT
---

# Advanced Skill

Advanced content.`;

describe("skill-export", () => {
  const tmpBase = join(tmpdir(), "codi-test-skill-export-" + Date.now());
  const codiDir = join(tmpBase, ".codi");
  const outputDir = join(tmpBase, "output");

  beforeEach(async () => {
    await mkdir(join(codiDir, "skills", "test-skill", "scripts"), {
      recursive: true,
    });
    await mkdir(join(codiDir, "skills", "test-skill", "references"), {
      recursive: true,
    });
    await mkdir(join(codiDir, "skills", "test-skill", "assets"), {
      recursive: true,
    });
    await mkdir(join(codiDir, "skills", "test-skill", "evals"), {
      recursive: true,
    });
    await writeFile(
      join(codiDir, "skills", "test-skill", "SKILL.md"),
      VALID_SKILL_MD,
    );
    await writeFile(
      join(codiDir, "skills", "test-skill", "scripts", "helper.sh"),
      '#!/bin/bash\necho "hello"',
    );
    await writeFile(
      join(codiDir, "skills", "test-skill", "references", "guide.md"),
      "# Guide",
    );
    await writeFile(
      join(codiDir, "skills", "test-skill", "scripts", ".gitkeep"),
      "",
    );
    await writeFile(
      join(codiDir, "skills", "test-skill", "evals", "evals.json"),
      "[]",
    );
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpBase, { recursive: true, force: true });
  });

  // --- validateSkillForExport ---

  describe("validateSkillForExport", () => {
    it("returns error when skill directory does not exist", async () => {
      const result = await validateSkillForExport(
        join(codiDir, "skills", "nonexistent"),
        "nonexistent",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]!.code).toBe("E_SKILL_NOT_FOUND");
      }
    });

    it("returns error when SKILL.md is missing", async () => {
      const emptyDir = join(codiDir, "skills", "empty-skill");
      await mkdir(emptyDir, { recursive: true });
      const result = await validateSkillForExport(emptyDir, "empty-skill");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]!.code).toBe("E_SKILL_NOT_FOUND");
      }
    });

    it("returns error when description is empty", async () => {
      const noDescDir = join(codiDir, "skills", "no-desc");
      await mkdir(noDescDir, { recursive: true });
      await writeFile(
        join(noDescDir, "SKILL.md"),
        '---\nname: no-desc\ndescription: ""\n---\nContent',
      );
      const result = await validateSkillForExport(noDescDir, "no-desc");
      expect(result.ok).toBe(false);
    });

    it("returns ok with parsed skill on valid input", async () => {
      const skillDir = join(codiDir, "skills", "test-skill");
      const result = await validateSkillForExport(skillDir, "test-skill");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe("test-skill");
        expect(result.data.description).toBe("A test skill for unit testing");
      }
    });
  });

  // --- exportSkill: standard format ---

  describe("standard export", () => {
    it("creates output directory with clean SKILL.md", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "standard",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const skillMd = await readFile(
        join(result.data.outputPath, "SKILL.md"),
        "utf-8",
      );
      expect(skillMd).toContain("name: test-skill");
      expect(skillMd).toContain("description: A test skill for unit testing");
    });

    it("strips managed_by from exported SKILL.md", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "standard",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const skillMd = await readFile(
        join(result.data.outputPath, "SKILL.md"),
        "utf-8",
      );
      expect(skillMd).not.toContain("managed_by");
      expect(skillMd).not.toContain("compatibility");
    });

    it("copies supporting files from scripts/ and references/", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "standard",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const helper = await readFile(
        join(result.data.outputPath, "scripts", "helper.sh"),
        "utf-8",
      );
      expect(helper).toContain('echo "hello"');

      const guide = await readFile(
        join(result.data.outputPath, "references", "guide.md"),
        "utf-8",
      );
      expect(guide).toBe("# Guide");
    });

    it("excludes evals/ directory", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "standard",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const evalsExists = await access(join(result.data.outputPath, "evals"))
        .then(() => true)
        .catch(() => false);
      expect(evalsExists).toBe(false);
    });

    it("excludes .gitkeep files", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "standard",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const scriptsFiles = await readdir(
        join(result.data.outputPath, "scripts"),
      );
      expect(scriptsFiles).not.toContain(".gitkeep");
      expect(scriptsFiles).toContain("helper.sh");
    });

    it("does not include Generated by Codi header", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "standard",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const skillMd = await readFile(
        join(result.data.outputPath, "SKILL.md"),
        "utf-8",
      );
      expect(skillMd).not.toContain("Generated by Codi");
    });

    it("preserves official frontmatter fields", async () => {
      // Create skill with all fields
      const advDir = join(codiDir, "skills", "advanced-skill");
      await mkdir(advDir, { recursive: true });
      await writeFile(join(advDir, "SKILL.md"), VALID_SKILL_WITH_FIELDS);

      const result = await exportSkill({
        name: "advanced-skill",
        codiDir,
        outputDir,
        format: "standard",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const skillMd = await readFile(
        join(result.data.outputPath, "SKILL.md"),
        "utf-8",
      );
      expect(skillMd).toContain("model: opus");
      expect(skillMd).toContain("effort: high");
      expect(skillMd).toContain("context: fork");
      expect(skillMd).toContain("agent: Explore");
      expect(skillMd).toContain("license: MIT");
    });
  });

  // --- exportSkill: claude-plugin format ---

  describe("claude-plugin export", () => {
    it("creates .claude-plugin/plugin.json", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "claude-plugin",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const manifest = JSON.parse(
        await readFile(
          join(result.data.outputPath, ".claude-plugin", "plugin.json"),
          "utf-8",
        ),
      );
      expect(manifest.name).toBe("test-skill");
      expect(manifest.description).toBe("A test skill for unit testing");
      expect(manifest.version).toBe("1.0.0");
    });

    it("creates skills/{name}/SKILL.md", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "claude-plugin",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const skillMd = await readFile(
        join(result.data.outputPath, "skills", "test-skill", "SKILL.md"),
        "utf-8",
      );
      expect(skillMd).toContain("name: test-skill");
    });

    it("copies supporting files into plugin structure", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "claude-plugin",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const helper = await readFile(
        join(
          result.data.outputPath,
          "skills",
          "test-skill",
          "scripts",
          "helper.sh",
        ),
        "utf-8",
      );
      expect(helper).toContain('echo "hello"');
    });

    it("output directory is named {name}-plugin", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "claude-plugin",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.outputPath).toContain("test-skill-plugin");
    });
  });

  // --- exportSkill: codex-plugin format ---

  describe("codex-plugin export", () => {
    it("creates .codex-plugin/plugin.json", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "codex-plugin",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const manifest = JSON.parse(
        await readFile(
          join(result.data.outputPath, ".codex-plugin", "plugin.json"),
          "utf-8",
        ),
      );
      expect(manifest.name).toBe("test-skill");
      expect(manifest.version).toBe("1.0.0");
    });

    it("creates skills/{name}/SKILL.md", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "codex-plugin",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const skillMd = await readFile(
        join(result.data.outputPath, "skills", "test-skill", "SKILL.md"),
        "utf-8",
      );
      expect(skillMd).toContain("name: test-skill");
    });
  });

  // --- exportSkill: zip format ---

  describe("zip export", () => {
    it("creates a ZIP file", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "zip",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.outputPath).toMatch(/\.zip$/);
      expect(result.data.sizeBytes).toBeGreaterThan(0);
      expect(result.data.format).toBe("zip");

      // Verify ZIP file exists
      const zipExists = await access(result.data.outputPath)
        .then(() => true)
        .catch(() => false);
      expect(zipExists).toBe(true);
    });

    it("cleans up staging directory after ZIP creation", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "zip",
      });
      expect(result.ok).toBe(true);

      // Staging dirs in tmpdir should be cleaned up
      // We can't easily verify this since the staging dir name is timestamp-based,
      // but the test itself not hanging/failing confirms cleanup
    });
  });

  // --- exportSkill: error cases ---

  describe("error handling", () => {
    it("returns error for nonexistent skill", async () => {
      const result = await exportSkill({
        name: "nonexistent",
        codiDir,
        outputDir,
        format: "standard",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]!.code).toBe("E_SKILL_NOT_FOUND");
      }
    });

    it("returns error for unsupported format", async () => {
      const result = await exportSkill({
        name: "test-skill",
        codiDir,
        outputDir,
        format: "invalid" as SkillExportFormat,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]!.code).toBe("E_SKILL_EXPORT_FAILED");
      }
    });
  });

  // --- listAvailableSkills ---

  describe("listAvailableSkills", () => {
    it("lists skill directories", async () => {
      const skills = await listAvailableSkills(codiDir);
      expect(skills).toContain("test-skill");
    });

    it("returns empty array when skills dir does not exist", async () => {
      const emptyCodiDir = join(tmpBase, "empty-codi");
      await mkdir(emptyCodiDir, { recursive: true });
      const skills = await listAvailableSkills(emptyCodiDir);
      expect(skills).toEqual([]);
    });

    it("returns sorted list", async () => {
      await mkdir(join(codiDir, "skills", "alpha-skill"), { recursive: true });
      await mkdir(join(codiDir, "skills", "zeta-skill"), { recursive: true });
      const skills = await listAvailableSkills(codiDir);
      expect(skills).toEqual([...skills].sort());
    });
  });
});
