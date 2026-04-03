import fs from "node:fs/promises";
import path from "node:path";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { createError } from "../output/errors.js";
import { loadSkillTemplate, getSkillTemplateVersion } from "./skill-template-loader.js";
import { generateMitLicense } from "./license-generator.js";
import { MAX_NAME_LENGTH, NAME_PATTERN_STRICT } from "#src/constants.js";
import type { SkillTemplateDescriptor } from "../../templates/skills/types.js";
import { injectFrontmatterVersion } from "../version/artifact-version.js";

const DEFAULT_CONTENT = `---
name: {{name}}
description: Describe when this skill should activate
managed_by: user
version: 1
---

# {{name}}

## When to Activate

- Describe specific scenarios when this skill should be used

## Steps

1. First step...`;

export interface CreateSkillOptions {
  name: string;
  configDir: string;
  template?: string;
  copyrightHolder?: string;
  force?: boolean;
}

export async function createSkill(options: CreateSkillOptions): Promise<Result<string>> {
  const { name, configDir, template, force } = options;

  if (!NAME_PATTERN_STRICT.test(name) || name.length > MAX_NAME_LENGTH) {
    return err([
      createError("E_CONFIG_INVALID", {
        message: `Invalid skill name "${name}". Use lowercase letters, digits, and hyphens only (max ${MAX_NAME_LENGTH} chars).`,
      }),
    ]);
  }

  let content: string;
  let descriptor: SkillTemplateDescriptor | undefined;

  if (template) {
    const templateResult = loadSkillTemplate(template);
    if (!templateResult.ok) return templateResult;
    descriptor = templateResult.data;
    const version = getSkillTemplateVersion(template);
    content =
      version !== undefined
        ? injectFrontmatterVersion(descriptor.template, version)
        : descriptor.template;
  } else {
    content = DEFAULT_CONTENT;
  }

  content = content.replace(/\{\{name\}\}/g, name);

  const skillDir = path.join(configDir, "skills", name);
  const filePath = path.join(skillDir, "SKILL.md");

  try {
    await fs.mkdir(skillDir, { recursive: true });
  } catch (cause) {
    return err([
      createError(
        "E_PERMISSION_DENIED",
        {
          path: skillDir,
        },
        cause as Error,
      ),
    ]);
  }

  if (!force) {
    try {
      await fs.access(filePath);
      return err([
        createError("E_CONFIG_INVALID", {
          message: `Skill file already exists: ${filePath}`,
        }),
      ]);
    } catch {
      // File does not exist, good to proceed
    }
  }

  try {
    await fs.writeFile(filePath, content + "\n", "utf-8");
  } catch (cause) {
    return err([
      createError(
        "E_PERMISSION_DENIED",
        {
          path: filePath,
        },
        cause as Error,
      ),
    ]);
  }

  const holder = options.copyrightHolder ?? "Contributors";
  const scaffoldResult = await scaffoldSkillSubdirs(skillDir, name, holder);
  if (!scaffoldResult.ok) return scaffoldResult;

  if (descriptor?.staticDir) {
    const copyResult = await copyStaticFiles(descriptor.staticDir, skillDir);
    if (!copyResult.ok) return copyResult;
  }

  return ok(filePath);
}

async function scaffoldSkillSubdirs(
  skillDir: string,
  name: string,
  copyrightHolder: string,
): Promise<Result<string>> {
  const evalsDir = path.join(skillDir, "evals");
  const subDirs = [
    evalsDir,
    path.join(skillDir, "scripts"),
    path.join(skillDir, "references"),
    path.join(skillDir, "assets"),
    path.join(skillDir, "agents"),
  ];

  for (const dir of subDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (cause) {
      return err([
        createError(
          "E_PERMISSION_DENIED",
          {
            path: dir,
          },
          cause as Error,
        ),
      ]);
    }
  }

  const evalsJson = JSON.stringify({ skill_name: name, evals: [] }, null, 2);
  try {
    await fs.writeFile(path.join(evalsDir, "evals.json"), evalsJson + "\n", "utf-8");
  } catch (cause) {
    return err([
      createError(
        "E_PERMISSION_DENIED",
        {
          path: path.join(evalsDir, "evals.json"),
        },
        cause as Error,
      ),
    ]);
  }

  const gitkeepDirs = ["scripts", "references", "assets", "agents"];
  for (const sub of gitkeepDirs) {
    const gitkeepPath = path.join(skillDir, sub, ".gitkeep");
    try {
      await fs.writeFile(gitkeepPath, "", "utf-8");
    } catch (cause) {
      return err([
        createError(
          "E_PERMISSION_DENIED",
          {
            path: gitkeepPath,
          },
          cause as Error,
        ),
      ]);
    }
  }

  const licensePath = path.join(skillDir, "LICENSE.txt");
  try {
    await fs.writeFile(licensePath, generateMitLicense(copyrightHolder), "utf-8");
  } catch (cause) {
    return err([createError("E_PERMISSION_DENIED", { path: licensePath }, cause as Error)]);
  }

  return ok(skillDir);
}

const STATIC_SUBDIRS = ["assets", "references", "scripts", "agents"] as const;

/**
 * Copy static files from the template's staticDir into the scaffolded skill directory.
 * Removes .gitkeep from any subdir that receives real files.
 */
async function copyStaticFiles(staticDir: string, skillDir: string): Promise<Result<string>> {
  for (const sub of STATIC_SUBDIRS) {
    const srcDir = path.join(staticDir, sub);

    let entries: string[];
    try {
      entries = await fs.readdir(srcDir);
    } catch {
      continue; // Source subdir doesn't exist — skip
    }

    const realFiles = entries.filter((f) => !f.startsWith("."));
    if (realFiles.length === 0) continue;

    const destDir = path.join(skillDir, sub);

    for (const file of realFiles) {
      const srcPath = path.join(srcDir, file);
      const destPath = path.join(destDir, file);

      try {
        const stat = await fs.stat(srcPath);
        if (stat.isDirectory()) {
          await copyDir(srcPath, destPath);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      } catch (cause) {
        return err([createError("E_PERMISSION_DENIED", { path: destPath }, cause as Error)]);
      }
    }

    // Remove .gitkeep since real files were copied
    const gitkeepPath = path.join(destDir, ".gitkeep");
    try {
      await fs.unlink(gitkeepPath);
    } catch {
      // .gitkeep may not exist — ignore
    }
  }

  return ok(skillDir);
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src);
  for (const entry of entries) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = await fs.stat(srcPath);
    if (stat.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
