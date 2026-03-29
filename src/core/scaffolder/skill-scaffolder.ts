import fs from "node:fs/promises";
import path from "node:path";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { createError } from "../output/errors.js";
import { loadSkillTemplate } from "./skill-template-loader.js";
import { MAX_NAME_LENGTH, NAME_PATTERN_STRICT } from "../../constants.js";

const DEFAULT_CONTENT = `---
name: {{name}}
description: Describe when this skill should activate
managed_by: user
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
}

export async function createSkill(
  options: CreateSkillOptions,
): Promise<Result<string>> {
  const { name, configDir, template } = options;

  if (!NAME_PATTERN_STRICT.test(name) || name.length > MAX_NAME_LENGTH) {
    return err([
      createError("E_CONFIG_INVALID", {
        message: `Invalid skill name "${name}". Use lowercase letters, digits, and hyphens only (max ${MAX_NAME_LENGTH} chars).`,
      }),
    ]);
  }

  let content: string;
  if (template) {
    const templateResult = loadSkillTemplate(template);
    if (!templateResult.ok) return templateResult;
    content = templateResult.data;
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

  const scaffoldResult = await scaffoldSkillSubdirs(skillDir, name);
  if (!scaffoldResult.ok) return scaffoldResult;

  return ok(filePath);
}

async function scaffoldSkillSubdirs(
  skillDir: string,
  name: string,
): Promise<Result<string>> {
  const evalsDir = path.join(skillDir, "evals");
  const subDirs = [
    evalsDir,
    path.join(skillDir, "scripts"),
    path.join(skillDir, "references"),
    path.join(skillDir, "assets"),
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
    await fs.writeFile(
      path.join(evalsDir, "evals.json"),
      evalsJson + "\n",
      "utf-8",
    );
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

  const gitkeepDirs = ["scripts", "references", "assets"];
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

  return ok(skillDir);
}
