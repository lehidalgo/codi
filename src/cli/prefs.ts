/**
 * `codi prefs` — manage per-project preferences at `.codi/preferences.yaml`.
 *
 * Subcommands:
 *   - init      interactive scaffolder (5 questions, @clack-driven)
 *   - get [key] print a single field or the whole document
 *   - set <key> <value>  update one field
 *   - show      pretty-print current effective prefs (incl. defaults)
 *   - migrate   convert legacy `.codi/preferences.json` → YAML
 *
 * The schema lives in `src/runtime/preferences.ts`. This module is a thin
 * CLI shell that delegates to the read/write/migrate helpers.
 */

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import {
  DEFAULT_PREFERENCES,
  migratePreferencesToYaml,
  readPreferencesWithSource,
  writePreferences,
  type CodiPreferences,
  type IssueTracker,
  type OutputMode,
} from "../runtime/preferences.js";
import type { GlobalOptions } from "./shared.js";
import { initFromOptions, handleOutput } from "./shared.js";
import type { CommandResult } from "../core/output/types.js";

const SCALAR_KEYS = [
  "output_mode",
  "test_command",
  "validate_command",
  "docs_dir",
  "auto_review",
  "issue_tracker",
] as const;
type ScalarKey = (typeof SCALAR_KEYS)[number];

function ok<T>(command: string, data: T): CommandResult<T> {
  return createCommandResult({
    success: true,
    command,
    data,
    exitCode: EXIT_CODES.SUCCESS,
  });
}

function fail(command: string, message: string): CommandResult<{ message: string }> {
  return createCommandResult({
    success: false,
    command,
    data: { message },
    errors: [
      {
        code: "PREFS_FAILED",
        message,
        hint: "See message above; check the key name and value format.",
        severity: "error",
        context: {},
      },
    ],
    exitCode: EXIT_CODES.GENERAL_ERROR,
  });
}

function parseValue(key: ScalarKey, raw: string): Partial<CodiPreferences> | Error {
  switch (key) {
    case "output_mode":
      if (raw !== "caveman" && raw !== "normal") {
        return new Error(`output_mode must be caveman|normal (got '${raw}')`);
      }
      return { output_mode: raw };
    case "auto_review":
      if (raw !== "true" && raw !== "false") {
        return new Error(`auto_review must be true|false (got '${raw}')`);
      }
      return { auto_review: raw === "true" };
    case "issue_tracker":
      if (!["linear", "jira", "github", "none"].includes(raw)) {
        return new Error(`issue_tracker must be linear|jira|github|none (got '${raw}')`);
      }
      return { issue_tracker: raw as IssueTracker };
    case "test_command":
      return { test_command: raw };
    case "validate_command":
      return { validate_command: raw };
    case "docs_dir":
      return { docs_dir: raw };
  }
}

export async function runPrefsInit(cwd: string): Promise<CodiPreferences | null> {
  p.intro("codi prefs — interactive setup (~30s)");

  const outputModeRaw = await p.select({
    message: "Output mode? (terse responses vs full)",
    options: [
      { value: "caveman" as OutputMode, label: "caveman — bullets, ≤3-col tables (recommended)" },
      { value: "normal" as OutputMode, label: "normal — prose responses" },
    ],
    initialValue: "caveman" as OutputMode,
  });
  if (p.isCancel(outputModeRaw)) return null;

  const testCommandRaw = await p.text({
    message: "Test command? (leave empty for auto-detect)",
    placeholder: "e.g. pnpm vitest run",
    defaultValue: "",
  });
  if (p.isCancel(testCommandRaw)) return null;

  const validateCommandRaw = await p.text({
    message: "Validate command? (leave empty for auto-detect)",
    placeholder: "e.g. pnpm lint && pnpm test",
    defaultValue: "",
  });
  if (p.isCancel(validateCommandRaw)) return null;

  const docsDirRaw = await p.text({
    message: "Docs directory?",
    initialValue: "docs/",
  });
  if (p.isCancel(docsDirRaw)) return null;

  const autoReviewRaw = await p.confirm({
    message: "Auto-invoke code-review at verify phase?",
    initialValue: false,
  });
  if (p.isCancel(autoReviewRaw)) return null;

  const issueTrackerRaw = await p.select({
    message: "Issue tracker?",
    options: [
      { value: "github" as IssueTracker, label: "github" },
      { value: "linear" as IssueTracker, label: "linear" },
      { value: "jira" as IssueTracker, label: "jira" },
      { value: "none" as IssueTracker, label: "none" },
    ],
    initialValue: "github" as IssueTracker,
  });
  if (p.isCancel(issueTrackerRaw)) return null;

  const prefs: CodiPreferences = {
    output_mode: outputModeRaw,
    test_command: typeof testCommandRaw === "string" ? testCommandRaw : "",
    validate_command: typeof validateCommandRaw === "string" ? validateCommandRaw : "",
    docs_dir: typeof docsDirRaw === "string" ? docsDirRaw : "docs/",
    auto_review: autoReviewRaw,
    issue_tracker: issueTrackerRaw,
  };

  writePreferences(cwd, prefs);
  p.outro(`Wrote .codi/preferences.yaml`);
  return prefs;
}

export function registerPrefsCommand(program: Command): void {
  const prefs = program.command("prefs").description("Manage .codi/preferences.yaml");

  prefs
    .command("init")
    .description("Interactive scaffolder — asks 6 questions, writes .codi/preferences.yaml")
    .action(async () => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      try {
        const written = await runPrefsInit(process.cwd());
        const result = ok("prefs init", written ?? { cancelled: true });
        handleOutput(result, globalOpts);
        process.exit(result.exitCode);
      } catch (e) {
        const result = fail("prefs init", e instanceof Error ? e.message : String(e));
        handleOutput(result, globalOpts);
        process.exit(result.exitCode);
      }
    });

  prefs
    .command("get [key]")
    .description("Print a single preference (or all when omitted)")
    .action((key?: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const { prefs: values } = readPreferencesWithSource(process.cwd());
      if (key === undefined) {
        const result = ok("prefs get", values);
        handleOutput(result, globalOpts);
        process.exit(result.exitCode);
      }
      if (!(SCALAR_KEYS as readonly string[]).includes(key)) {
        const result = fail("prefs get", `unknown key '${key}'. Valid: ${SCALAR_KEYS.join(", ")}`);
        handleOutput(result, globalOpts);
        process.exit(result.exitCode);
      }
      const result = ok("prefs get", { [key]: values[key as ScalarKey] });
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  prefs
    .command("set <key> <value>")
    .description(`Update one preference (keys: ${SCALAR_KEYS.join("|")})`)
    .action((key: string, value: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      if (!(SCALAR_KEYS as readonly string[]).includes(key)) {
        const result = fail("prefs set", `unknown key '${key}'. Valid: ${SCALAR_KEYS.join(", ")}`);
        handleOutput(result, globalOpts);
        process.exit(result.exitCode);
      }
      const parsed = parseValue(key as ScalarKey, value);
      if (parsed instanceof Error) {
        const result = fail("prefs set", parsed.message);
        handleOutput(result, globalOpts);
        process.exit(result.exitCode);
      }
      writePreferences(process.cwd(), parsed);
      const result = ok("prefs set", { key, value });
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  prefs
    .command("show")
    .description("Pretty-print effective preferences (defaults shown when unset)")
    .action(() => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const { prefs: values, source } = readPreferencesWithSource(process.cwd());
      const defaults = DEFAULT_PREFERENCES;
      const result = ok("prefs show", { source, values, defaults });
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  prefs
    .command("migrate")
    .description("Migrate legacy .codi/preferences.json → .codi/preferences.yaml")
    .action(() => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const written = migratePreferencesToYaml(process.cwd());
      if (written === null) {
        const result = ok("prefs migrate", {
          migrated: false,
          reason: "no .codi/preferences.json found or YAML already exists",
        });
        handleOutput(result, globalOpts);
        process.exit(result.exitCode);
      }
      const result = ok("prefs migrate", { migrated: true, path: written });
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  // Ensure runPrefsInit is reachable even when tree-shaken doesn't see CLI use.
  void runPrefsInit;
}
