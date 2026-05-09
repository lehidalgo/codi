/**
 * Project-level config persistence at .codi/project.json.
 *
 * Created by project-workflow.intent. Read by every other workflow + sheets-sync
 * to discover the Sheet ID. Missing/malformed config raises a structured error
 * (config_missing) so callers can ELICIT from the user — never invent.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { ProjectConfig } from "./types.js";
import { SheetsError } from "./types.js";

export const PROJECT_CONFIG_RELATIVE_PATH = ".codi/project.json";

export function projectConfigPath(cwd: string): string {
  return resolve(cwd, PROJECT_CONFIG_RELATIVE_PATH);
}

export function readProjectConfig(cwd: string): ProjectConfig {
  const path = projectConfigPath(cwd);
  if (!existsSync(path)) {
    throw new SheetsError(
      "config_missing",
      `${PROJECT_CONFIG_RELATIVE_PATH} not found — run project-workflow to bootstrap`,
      { path },
    );
  }
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new SheetsError(
      "config_missing",
      `${PROJECT_CONFIG_RELATIVE_PATH} unreadable: ${(e as Error).message}`,
      { path },
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new SheetsError(
      "config_missing",
      `${PROJECT_CONFIG_RELATIVE_PATH} is not valid JSON: ${(e as Error).message}`,
      { path },
    );
  }
  return assertProjectConfig(parsed, path);
}

export function writeProjectConfig(cwd: string, config: ProjectConfig): void {
  const path = projectConfigPath(cwd);
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const serialized = JSON.stringify(config, null, 2) + "\n";
  writeFileSync(path, serialized, "utf8");
}

/** Convenience — read; if config_missing, return null. Other errors propagate. */
export function tryReadProjectConfig(cwd: string): ProjectConfig | null {
  try {
    return readProjectConfig(cwd);
  } catch (e) {
    if (e instanceof SheetsError && e.code === "config_missing") return null;
    throw e;
  }
}

function assertProjectConfig(value: unknown, path: string): ProjectConfig {
  if (typeof value !== "object" || value === null) {
    throw new SheetsError("config_missing", `${path} is not an object`, { path });
  }
  const v = value as Record<string, unknown>;
  const requiredStrings: ReadonlyArray<keyof ProjectConfig> = [
    "project_name",
    "sheet_id",
    "created_at",
    "created_by",
  ];
  for (const key of requiredStrings) {
    if (typeof v[key] !== "string" || (v[key] as string).length === 0) {
      throw new SheetsError(
        "config_missing",
        `${path}: missing or non-string field '${String(key)}'`,
        { path, field: String(key) },
      );
    }
  }
  if (typeof v["sheet_template_version"] !== "number") {
    throw new SheetsError(
      "config_missing",
      `${path}: missing or non-numeric field 'sheet_template_version'`,
      { path, field: "sheet_template_version" },
    );
  }
  const driveFolder = v["drive_folder_id"];
  if (driveFolder !== undefined && typeof driveFolder !== "string") {
    throw new SheetsError("config_missing", `${path}: 'drive_folder_id' must be string or absent`, {
      path,
    });
  }
  const authMode = v["auth_mode"];
  if (
    authMode !== undefined &&
    authMode !== "service_account" &&
    authMode !== "oauth_user" &&
    authMode !== "local_xlsx"
  ) {
    throw new SheetsError(
      "config_missing",
      `${path}: 'auth_mode' must be 'service_account', 'oauth_user', or 'local_xlsx' (got ${String(authMode)})`,
      { path },
    );
  }
  const localPath = v["local_path"];
  if (localPath !== undefined && typeof localPath !== "string") {
    throw new SheetsError("config_missing", `${path}: 'local_path' must be string or absent`, {
      path,
    });
  }
  if (authMode === "local_xlsx" && (typeof localPath !== "string" || localPath.length === 0)) {
    throw new SheetsError(
      "config_missing",
      `${path}: 'local_path' is required when auth_mode='local_xlsx'`,
      { path, field: "local_path" },
    );
  }
  const out: ProjectConfig = {
    project_name: v["project_name"] as string,
    sheet_id: v["sheet_id"] as string,
    sheet_template_version: v["sheet_template_version"] as number,
    created_at: v["created_at"] as string,
    created_by: v["created_by"] as string,
  };
  if (driveFolder !== undefined) out.drive_folder_id = driveFolder as string;
  if (localPath !== undefined) out.local_path = localPath;
  if (authMode !== undefined) out.auth_mode = authMode;
  return out;
}

/** Helper used by sheets-sync.cli — surfaces the elicitation prompt content. */
export function elicitationPromptForMissingConfig(cwd: string): string {
  const path = join(cwd, PROJECT_CONFIG_RELATIVE_PATH);
  return [
    `Project Sheet config is missing at ${path}.`,
    `Existing Sheet ID, or create new? (recommended: create new via project-workflow)`,
    ``,
    `If you also have not set up Google credentials yet, start with`,
    `sheets-sync/references/google-sheets-setup.md (or ask Claude Code to walk you through it).`,
  ].join("\n");
}
