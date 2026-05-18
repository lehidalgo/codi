import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NormalizedConfig } from "../types/config.js";
import { PROJECT_DIR } from "../constants.js";
import {
  HOOKS_SUBDIR,
  LAUNCHER_FILENAME,
  SKILL_TRACKER_FILENAME,
  SKILL_OBSERVER_FILENAME,
} from "../core/hooks/heartbeat-hooks.js";
import { launcherCommand } from "./heartbeat-emission.js";
import { isHeartbeatEnabled } from "./heartbeat-state.js";

interface ClaudeHookCommand {
  type: "command";
  command: string;
  timeout: number;
  async?: true;
}

interface ClaudeHookEntry {
  matcher: string;
  hooks: ClaudeHookCommand[];
}

export interface ClaudeSettings {
  permissions?: { deny?: string[]; allow?: string[]; [k: string]: unknown };
  hooks?: Record<string, ClaudeHookEntry[]>;
  // Index signature lets us preserve unknown top-level keys (statusLine,
  // model, env, etc.) added by the user to .claude/settings.json without
  // dropping them on regeneration.
  [k: string]: unknown;
}

/**
 * Read the user's existing `.claude/settings.json` so we can merge into it
 * instead of clobbering. Returns null on missing file or unparseable JSON
 * (the latter mimics greenfield so we never crash a generate run on a
 * malformed user file — the user-facing diff in conflict resolution will
 * highlight the problem).
 */
export function readExistingClaudeSettings(projectRoot: string | undefined): ClaudeSettings | null {
  if (!projectRoot) return null;
  const path = join(projectRoot, ".claude", "settings.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ClaudeSettings;
  } catch {
    return null;
  }
}

/**
 * Substrings that uniquely identify a codi-managed hook command. Anything
 * else inside an existing hook entry is treated as user-authored and
 * preserved verbatim across regenerations. Keep this list narrow — if a
 * user happens to invoke `codi hook` directly from a custom wrapper, that
 * is intentional; their wrapper survives because codi's own command line
 * has the `codi hook <name> --agent claude-code` shape, not just
 * `codi hook`.
 */
function isCodiManagedCommand(cmd: string): boolean {
  return (
    cmd.includes("codi hook ") ||
    cmd.includes(`${HOOKS_SUBDIR}/${LAUNCHER_FILENAME}`) ||
    cmd.includes(`${HOOKS_SUBDIR}/${SKILL_TRACKER_FILENAME}`) ||
    cmd.includes(`${HOOKS_SUBDIR}/${SKILL_OBSERVER_FILENAME}`)
  );
}

/**
 * Deep-merge codi-generated settings into the user's existing settings.json.
 *
 * Why this exists: `codi init` and `codi generate` previously emitted a
 * fresh greenfield settings.json which forced the generic line-based
 * conflict resolver to handle the JSON. The resolver inserts `<<<<<<<`
 * markers, breaking JSON parsing — so codi's runtime hooks (Stop /
 * UserPromptSubmit / PreToolUse) never reached disk for any user with a
 * pre-existing settings.json (a common case for users coming from a
 * FastAPI / template starter). The brain `captures` table stayed empty
 * forever.
 *
 * Merge semantics:
 *   - permissions.deny: set-union (codi's denies + user's denies, dedup)
 *   - hooks: per event key, group existing entries by `matcher`. For each
 *     matcher we preserve user-authored commands and refresh codi-managed
 *     commands from the new generated payload. Event keys present only in
 *     the user's file (e.g. PreCompact) survive untouched.
 *   - other top-level keys: passthrough from existing (statusLine, model,
 *     env, …).
 *
 * Greenfield (existing === null) returns the generated payload unchanged
 * so first-time installs behave exactly as before.
 */
export function mergeSettings(generated: ClaudeSettings, existing: ClaudeSettings | null): ClaudeSettings {
  if (!existing) return generated;

  const merged: ClaudeSettings = { ...existing };

  const denyUnion = new Set<string>([
    ...(existing.permissions?.deny ?? []),
    ...(generated.permissions?.deny ?? []),
  ]);
  if (denyUnion.size > 0) {
    merged.permissions = {
      ...(existing.permissions ?? {}),
      deny: [...denyUnion],
    };
  }

  const mergedHooks: Record<string, ClaudeHookEntry[]> = { ...(existing.hooks ?? {}) };
  for (const [event, generatedEntries] of Object.entries(generated.hooks ?? {})) {
    const existingEntries = existing.hooks?.[event] ?? [];
    const byMatcher = new Map<string, ClaudeHookEntry>();

    for (const entry of existingEntries) {
      const userHooks = entry.hooks.filter((h) => !isCodiManagedCommand(h.command));
      if (userHooks.length > 0) {
        byMatcher.set(entry.matcher, { matcher: entry.matcher, hooks: userHooks });
      }
    }

    for (const entry of generatedEntries) {
      const slot = byMatcher.get(entry.matcher);
      if (slot) {
        slot.hooks.push(...entry.hooks);
      } else {
        byMatcher.set(entry.matcher, { matcher: entry.matcher, hooks: [...entry.hooks] });
      }
    }

    mergedHooks[event] = [...byMatcher.values()];
  }

  if (Object.keys(mergedHooks).length > 0) {
    merged.hooks = mergedHooks;
  }

  return merged;
}

export function buildSettingsJson(
  config: NormalizedConfig,
  enabledRuntime: string[] | null,
): ClaudeSettings {
  const settings: ClaudeSettings = {};

  // Map flags to permissions.deny (native enforcement — hard blocks tool calls)
  const deny: string[] = [];
  const flagValue = (key: string): unknown => config.flags[key]?.value;

  if (flagValue("allow_force_push") === false) {
    deny.push("Bash(git push --force *)", "Bash(git push -f *)");
  }
  if (flagValue("allow_shell_commands") === false) {
    deny.push("Bash");
  }
  if (flagValue("allow_file_deletion") === false) {
    deny.push("Bash(rm -rf *)", "Bash(rm -r *)");
  }

  // Preset-declared permissions (ADR-013 Paso 8). Set-union with flag-derived
  // denies; the merge step at the end de-dupes. Allow patterns also flow
  // through preset declaration since flags do not currently express them.
  const presetDeny = config.permissions?.deny ?? [];
  const presetAllow = config.permissions?.allow ?? [];
  const mergedDeny = Array.from(new Set([...deny, ...presetDeny]));
  const mergedAllow = Array.from(new Set([...presetAllow]));

  if (mergedDeny.length > 0 || mergedAllow.length > 0) {
    settings.permissions = {};
    if (mergedDeny.length > 0) settings.permissions.deny = mergedDeny;
    if (mergedAllow.length > 0) settings.permissions.allow = mergedAllow;
  }

  // Two layers of hooks coexist:
  //
  // 1. Legacy heartbeat (InstructionsLoaded skill-tracker + Stop skill-observer)
  //    — narrow purpose: skill-load tracking + the legacy
  //    `[CODI-OBSERVATION:...]` filesystem feedback channel. Kept intact so
  //    in-flight users do not regress.
  //
  // 2. F6/F7 brain pipeline (UserPromptSubmit + PreToolUse + PostToolUse +
  //    Stop) — the canonical observability + capture + Iron Law channel.
  //    Each event invokes `codi hook <name>` which the codi binary
  //    dispatches to the matching processX orchestrator. The PROJECT_CLI
  //    binary is on the user's PATH because consumers `npm install -g codi`
  //    (or run via npx); no plugin pattern needed.
  //
  // Multiple hook entries per event are allowed by Claude Code; the
  // legacy and F6/F7 Stop hooks coexist on the same event.
  //
  // Users who need personal hooks must use .claude/settings.local.json
  // (auto-merged by Claude Code).
  //
  // Commands resolve the script via $CLAUDE_PROJECT_DIR (officially guaranteed for every
  // hook event, per https://code.claude.com/docs/en/hooks) so they survive session CWD drift
  // into subdirectories. The ${VAR:-.} fallback preserves today's relative-path behavior if
  // the env var is somehow unset, so there is no regression in edge environments.
  const hooksDir = `${PROJECT_DIR}/${HOOKS_SUBDIR}`;
  const projectRootRef = '"${CLAUDE_PROJECT_DIR:-.}"';
  const launcherRef = `${projectRootRef}/${hooksDir}/${LAUNCHER_FILENAME}`;
  const trackerRef = `${projectRootRef}/${hooksDir}/${SKILL_TRACKER_FILENAME}`;
  const observerRef = `${projectRootRef}/${hooksDir}/${SKILL_OBSERVER_FILENAME}`;

  // F6/F7 hook command builder — `cd` into project root so the brain
  // resolver (DEFECT-008) walks up from the project's `.codi/` and we
  // do not accidentally hit the home brain. Stdin is forwarded
  // unchanged so the codi subcommand sees the Claude Code payload.
  const codiHook = (name: string): string =>
    `cd ${projectRootRef} && codi hook ${name} --agent claude-code`;

  const trackerEnabled = isHeartbeatEnabled(enabledRuntime, "skill-tracker");
  const observerEnabled = isHeartbeatEnabled(enabledRuntime, "skill-observer");

  settings.hooks = {
    ...(trackerEnabled
      ? {
          InstructionsLoaded: [
            {
              matcher: "",
              hooks: [
                {
                  type: "command" as const,
                  command: launcherCommand(launcherRef, trackerRef),
                  timeout: 5,
                  async: true as const,
                },
              ],
            },
          ],
        }
      : {}),
    UserPromptSubmit: [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: codiHook("user-prompt-submit"),
            timeout: 10,
          },
        ],
      },
    ],
    PreToolUse: [
      {
        matcher: "Edit|Write|NotebookEdit|Bash",
        hooks: [
          {
            type: "command",
            command: codiHook("pre-tool-use"),
            timeout: 30,
          },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: "Edit|Write|NotebookEdit|Bash|Read",
        hooks: [
          {
            type: "command",
            command: codiHook("post-tool-use"),
            timeout: 15,
          },
        ],
      },
    ],
    Stop: [
      {
        matcher: "",
        hooks: [
          ...(observerEnabled
            ? [
                {
                  type: "command" as const,
                  command: launcherCommand(launcherRef, observerRef),
                  timeout: 15,
                },
              ]
            : []),
          {
            type: "command" as const,
            command: codiHook("stop"),
            timeout: 15,
          },
        ],
      },
    ],
  };

  return settings;
}
