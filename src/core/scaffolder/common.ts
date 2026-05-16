/**
 * Shared scaffolder primitives.
 *
 * The rule / skill / agent / mcp-server scaffolders all share the same
 * pre-flight boilerplate (name validation, mkdir, conflict-check, atomic
 * write). This module factors that out into five pure helpers so each
 * scaffolder's body only contains its kind-specific logic (frontmatter
 * shape, template defaults, post-write hooks).
 *
 * No class hierarchy, no god-config object — every helper is a plain
 * function returning `Result<T>`, callable directly from any scaffolder.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { ok, err } from "#src/types/result.js";
import type { Result } from "#src/types/result.js";
import { createError } from "../output/errors.js";
import { MAX_NAME_LENGTH, NAME_PATTERN_STRICT } from "#src/constants.js";

/**
 * Validate that `name` is kebab-case (lowercase letters, digits, hyphens) and
 * fits within `MAX_NAME_LENGTH`. `label` flavours the error message so the
 * caller does not need to wrap.
 */
export function validateArtifactName(name: string, label: string): Result<void> {
  if (!NAME_PATTERN_STRICT.test(name) || name.length > MAX_NAME_LENGTH) {
    return err([
      createError("E_CONFIG_INVALID", {
        message: `Invalid ${label} name "${name}". Use lowercase letters, digits, and hyphens only (max ${MAX_NAME_LENGTH} chars).`,
      }),
    ]);
  }
  return ok(undefined);
}

/**
 * `mkdir -p`-style directory creation. On EACCES / EPERM the error is wrapped
 * as `E_PERMISSION_DENIED` carrying the failed path.
 */
export async function ensureDir(dir: string): Promise<Result<void>> {
  try {
    await fs.mkdir(dir, { recursive: true });
    return ok(undefined);
  } catch (cause) {
    return err([createError("E_PERMISSION_DENIED", { path: dir }, cause as Error)]);
  }
}

/**
 * Pre-write guard: returns `err(E_CONFIG_INVALID)` if `filePath` already
 * exists and `force` is `false`. `label` flavours the error message
 * ("Rule file already exists: …", "Agent file already exists: …").
 */
export async function assertNotExists(
  filePath: string,
  label: string,
  force: boolean,
): Promise<Result<void>> {
  if (force) return ok(undefined);
  try {
    await fs.access(filePath);
    return err([
      createError("E_CONFIG_INVALID", {
        message: `${label} file already exists: ${filePath}`,
      }),
    ]);
  } catch {
    return ok(undefined);
  }
}

/**
 * Write `content` to `filePath`, returning the path on success. Wraps any
 * write error as `E_PERMISSION_DENIED` carrying the failed path. The caller
 * is responsible for `ensureDir` of the parent directory and for
 * `assertNotExists` when `force` is `false`.
 */
export async function writeFileSafe(filePath: string, content: string): Promise<Result<string>> {
  try {
    await fs.writeFile(filePath, content, "utf-8");
    return ok(filePath);
  } catch (cause) {
    return err([createError("E_PERMISSION_DENIED", { path: filePath }, cause as Error)]);
  }
}

/**
 * Replace every `{{name}}` token in `template` with `name`. Used by the
 * Markdown-flavoured scaffolders (rule, agent, skill). MCP-server scaffolder
 * does not call this — it constructs its YAML object directly.
 */
export function replaceNamePlaceholder(template: string, name: string): string {
  return template.replace(/\{\{name\}\}/g, name);
}

/**
 * High-level convenience: orchestrate the standard markdown-artifact write
 * (name validation → mkdir parent → conflict-check → write) in one call.
 * Use directly from rule / agent scaffolders. Skill / mcp keep their own
 * orchestrators because their post-write logic diverges.
 */
export interface WriteArtifactFileOptions {
  readonly configDir: string;
  readonly subdir: string;
  readonly name: string;
  readonly ext: string;
  readonly content: string;
  readonly label: string;
  readonly force: boolean;
}

export async function writeArtifactFile(opts: WriteArtifactFileOptions): Promise<Result<string>> {
  const nameResult = validateArtifactName(opts.name, opts.label.toLowerCase());
  if (!nameResult.ok) return nameResult;

  const filePath = path.join(opts.configDir, opts.subdir, `${opts.name}.${opts.ext}`);
  const dir = path.dirname(filePath);

  const dirResult = await ensureDir(dir);
  if (!dirResult.ok) return dirResult;

  const existsResult = await assertNotExists(filePath, opts.label, opts.force);
  if (!existsResult.ok) return existsResult;

  return writeFileSafe(filePath, opts.content);
}
