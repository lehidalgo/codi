import fs from "node:fs/promises";
import path from "node:path";
import { ok, err } from "#src/types/result.js";
import type { Result } from "#src/types/result.js";
import { createError } from "../output/errors.js";
import { loadAgentTemplate } from "./agent-template-loader.js";
import { MAX_NAME_LENGTH, NAME_PATTERN_STRICT } from "#src/constants.js";

const DEFAULT_CONTENT = `---
name: {{name}}
description: Custom agent
tools: [Read, Grep, Glob, Bash]
model: inherit
managed_by: user
version: 1
---

# {{name}}

Add your agent system prompt here.`;

/** Options for {@link createAgent}. */
export interface CreateAgentOptions {
  /** Agent name in kebab-case (validated against {@link NAME_PATTERN_STRICT}). */
  name: string;
  /** Absolute path to the `.codi/` configuration directory. */
  configDir: string;
  /** Optional built-in agent template name to scaffold from instead of the default stub. */
  template?: string;
  /** When `true`, overwrite an existing agent file without error. */
  force?: boolean;
}

/**
 * Scaffold a new agent Markdown file inside `<configDir>/agents/`.
 *
 * The name is validated, a template is loaded (or the default stub is used),
 * and `{{name}}` placeholders are replaced with the provided name.
 *
 * @param options - Scaffolding options.
 * @returns `ok(filePath)` with the absolute path of the created file, or
 *   `err(errors)` if validation fails, the directory is not writable, or the
 *   file already exists (when `force` is `false`).
 */
export async function createAgent(options: CreateAgentOptions): Promise<Result<string>> {
  const { name, configDir, template, force } = options;

  if (!NAME_PATTERN_STRICT.test(name) || name.length > MAX_NAME_LENGTH) {
    return err([
      createError("E_CONFIG_INVALID", {
        message: `Invalid agent name "${name}". Use lowercase letters, digits, and hyphens only (max ${MAX_NAME_LENGTH} chars).`,
      }),
    ]);
  }

  let content: string;
  if (template) {
    const templateResult = loadAgentTemplate(template);
    if (!templateResult.ok) return templateResult;
    content = templateResult.data;
  } else {
    content = DEFAULT_CONTENT;
  }

  content = content.replace(/\{\{name\}\}/g, name);

  const filePath = path.join(configDir, "agents", `${name}.md`);
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
          message: `Agent file already exists: ${filePath}`,
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
