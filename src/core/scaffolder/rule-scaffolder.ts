import fs from "node:fs/promises";
import path from "node:path";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { createError } from "../output/errors.js";
import { loadTemplate, getTemplateVersion } from "./template-loader.js";
import { injectFrontmatterVersion } from "../version/artifact-version.js";
import { MAX_NAME_LENGTH, NAME_PATTERN_STRICT } from "#src/constants.js";

const DEFAULT_CONTENT = `---
name: {{name}}
description: Custom rule
priority: medium
alwaysApply: false
managed_by: user
version: 1
---

# {{name}}

Add your rule content here.`;

export interface CreateRuleOptions {
  name: string;
  configDir: string;
  template?: string;
  force?: boolean;
}

export async function createRule(options: CreateRuleOptions): Promise<Result<string>> {
  const { name, configDir, template, force } = options;

  if (!NAME_PATTERN_STRICT.test(name) || name.length > MAX_NAME_LENGTH) {
    return err([
      createError("E_CONFIG_INVALID", {
        message: `Invalid rule name "${name}". Use lowercase letters, digits, and hyphens only (max ${MAX_NAME_LENGTH} chars).`,
      }),
    ]);
  }

  let content: string;
  if (template) {
    const templateResult = loadTemplate(template);
    if (!templateResult.ok) return templateResult;
    const version = getTemplateVersion(template);
    content =
      version !== undefined
        ? injectFrontmatterVersion(templateResult.data, version)
        : templateResult.data;
    // Guard: ensure loaded template has valid YAML frontmatter
    if (!content.trimStart().startsWith("---")) {
      content = DEFAULT_CONTENT;
    }
  } else {
    content = DEFAULT_CONTENT;
  }

  content = content.replace(/\{\{name\}\}/g, name);

  const filePath = path.join(configDir, "rules", `${name}.md`);
  const dir = path.dirname(filePath);

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

  if (!force) {
    try {
      await fs.access(filePath);
      return err([
        createError("E_CONFIG_INVALID", {
          message: `Rule file already exists: ${filePath}`,
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

  return ok(filePath);
}
