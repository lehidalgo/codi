/**
 * `codi hook <name>` — subcommands that wrap the F6/F7 hook orchestrators
 * so consumers can wire them into `.claude/settings.json` (and the Codex
 * equivalent) without needing tsx + a per-project node_modules layout.
 *
 * Supersedes the per-project shell wrappers in
 * `src/templates/hooks/runtime/*.sh` for the new event types.
 *
 * Each subcommand:
 *   1. Reads a JSON payload from stdin (Claude Code hook contract)
 *   2. Dispatches to the matching `processX` orchestrator (in
 *      `src/runtime/capture/`) or to `evaluateToolCall` + iron-laws
 *   3. Exits 0 to allow / 2 to block (PreToolUse only)
 *
 * The hooks fail OPEN — exceptions / unparseable input never break the
 * agent's tool execution, they just suppress the observability write.
 */

import type { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openBrain, applyMigrations } from "../runtime/brain/index.js";
import { processPromptSubmit } from "../runtime/capture/prompt-hook.js";
import { processPostToolUse } from "../runtime/capture/tool-hook.js";
import { processStopHook } from "../runtime/capture/stop-hook.js";
import {
  buildContext,
  buildPromptStateBlock,
  buildCaptureReminderBlock,
  evaluateToolCall,
  evaluatePostToolCall,
  type PostToolCall,
  type ToolCall,
} from "../runtime/hook-logic.js";
import {
  buildIronLawsBlock,
  buildPullReminder,
  decideGitCommand,
  readGateState,
  readLastPromptTs,
  readRecentPrompts,
  shouldRecommendPull,
} from "../runtime/iron-laws-enforcer.js";
import { recordIncidentalChange } from "../runtime/cli-handlers.js";
import { readFileSafe } from "../runtime/fs-utils.js";
import { readPreferences } from "../runtime/preferences.js";
import { getRuntimeHooks } from "../core/hooks/registry/index.js";
import { runRuntimeHooks, aggregateExitDecision } from "../runtime/hooks/runner.js";
import type { HookContext as RuntimeHookCtx } from "../core/hooks/hook-artifact.js";

interface HookPayload {
  session_id?: string;
  prompt?: string;
  cwd?: string;
  transcript_path?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

function parsePayload(): HookPayload | null {
  const raw = readStdin();
  if (raw.trim().length === 0) return null;
  try {
    return JSON.parse(raw) as HookPayload;
  } catch {
    return null;
  }
}

// ─── user-prompt-submit ────────────────────────────────────────────────────

function runUserPromptSubmit(): void {
  const cwd = process.cwd();
  const payload = parsePayload();

  if (
    payload &&
    typeof payload.session_id === "string" &&
    payload.session_id.length > 0 &&
    typeof payload.prompt === "string"
  ) {
    try {
      const handle = openBrain();
      try {
        applyMigrations(handle.raw);
        processPromptSubmit(handle, {
          sessionId: payload.session_id,
          prompt: payload.prompt,
          cwd: payload.cwd ?? cwd,
          ...(payload.transcript_path !== undefined
            ? { transcriptPath: payload.transcript_path }
            : {}),
        });
      } finally {
        handle.close();
      }
    } catch {
      // Hook is non-blocking; never suppress the state-block output below.
    }
  }

  const ctx = buildContext(cwd);
  const stateBlock = buildPromptStateBlock(ctx);
  const captureBlock = buildCaptureReminderBlock();
  let ironLawsBlock = "";
  try {
    const handle = openBrain();
    try {
      applyMigrations(handle.raw);
      ironLawsBlock = buildIronLawsBlock({
        outputMode: readPreferences(cwd).output_mode,
        gateState: readGateState(handle.raw),
      });
    } finally {
      handle.close();
    }
  } catch {
    // Iron-laws block is advisory.
  }

  const out = [captureBlock, stateBlock, ironLawsBlock].filter((s) => s.length > 0).join("\n\n");
  if (out.length > 0) process.stdout.write(out + "\n");
  process.exit(0);
}

// ─── pre-tool-use ──────────────────────────────────────────────────────────

function readEnabledRuntimeHookNames(cwd: string): string[] | null {
  try {
    const stateFile = join(cwd, ".codi", "state", "state.json");
    if (!existsSync(stateFile)) return null;
    const parsed = JSON.parse(readFileSync(stateFile, "utf8")) as {
      selectedHooks?: { runtime?: string[] };
    };
    return parsed.selectedHooks?.runtime ?? null;
  } catch {
    return null;
  }
}

async function runPreToolUse(): Promise<void> {
  const payload = parsePayload();
  if (!payload || typeof payload.tool_name !== "string" || !payload.tool_input) {
    process.exit(0);
  }
  const cwd = payload.cwd ?? process.cwd();
  const call: ToolCall = { tool_name: payload.tool_name, tool_input: payload.tool_input };

  // Phase / scope gate
  const ctx = buildContext(cwd);
  const decision = evaluateToolCall(call, ctx);
  if (!decision.allow) {
    console.error(`[codi pre-tool-use] BLOCKED: ${decision.reason}`);
    console.error(`[codi pre-tool-use] Suggested action: ${decision.suggested_action}`);
    process.exit(2);
  }

  // Iron Law 7 — git mutation requires unnegated approval
  if (call.tool_name === "Bash") {
    const command = (call.tool_input["command"] ?? "") as string;
    if (typeof command === "string" && command.length > 0) {
      try {
        const handle = openBrain();
        try {
          applyMigrations(handle.raw);
          const recentPrompts = readRecentPrompts(handle.raw, {
            ...(payload.session_id !== undefined ? { sessionId: payload.session_id } : {}),
            limit: 5,
          });
          const verdict = decideGitCommand({ bashCommand: command, recentPrompts });
          if (!verdict.allowed) {
            console.error(`[codi pre-tool-use] BLOCKED (Iron Law 7): ${verdict.reason}`);
            console.error(
              "[codi pre-tool-use] Ask the user before running this; an explicit prompt mentioning commit/push/merge/tag/release counts as approval.",
            );
            process.exit(2);
          }
        } finally {
          handle.close();
        }
      } catch {
        // Brain unreachable → fail open.
      }
    }
  }

  // Iron Law 5 — advisory pull-reminder for mutating edit tools
  if (
    typeof payload.session_id === "string" &&
    payload.session_id.length > 0 &&
    (call.tool_name === "Edit" || call.tool_name === "Write" || call.tool_name === "NotebookEdit")
  ) {
    try {
      const handle = openBrain();
      try {
        applyMigrations(handle.raw);
        const lastTs = readLastPromptTs(handle.raw, payload.session_id);
        if (
          shouldRecommendPull({
            lastBrainReadTs: lastTs,
            nowTs: Date.now(),
            toolName: call.tool_name,
          })
        ) {
          console.error(buildPullReminder());
        }
      } finally {
        handle.close();
      }
    } catch {
      /* advisory only */
    }
  }

  // Runtime-hook runner — security-reminder + future advisory hooks.
  // Lazy-load registry/runner to keep cold-start time off other hooks.
  if (
    call.tool_name === "Edit" ||
    call.tool_name === "Write" ||
    call.tool_name === "MultiEdit" ||
    call.tool_name === "NotebookEdit"
  ) {
    try {
      const enabled = readEnabledRuntimeHookNames(cwd);
      const allRuntime = getRuntimeHooks();
      const candidates = allRuntime.filter(
        (h) => h.required || (enabled === null ? h.default : enabled.includes(h.name)),
      );
      // Only run hooks subscribed to PreToolUse, and only the security-reminder
      // for now; the wrapper hooks are metadata-only adapters whose enforcement
      // already happens above. Filter to event subscription too.
      const runHere = candidates.filter(
        (h) => h.events.includes("PreToolUse") && h.name === "security-reminder",
      );
      if (runHere.length > 0) {
        const filePath =
          (call.tool_input["file_path"] as string | undefined) ??
          (call.tool_input["path"] as string | undefined);
        const newString = call.tool_input["new_string"] as string | undefined;
        const content = (call.tool_input["content"] as string | undefined) ?? newString ?? "";
        const runtimeCtx: RuntimeHookCtx = {
          bucket: "runtime",
          event: "PreToolUse",
          toolName: call.tool_name,
          ...(filePath !== undefined ? { filePath } : {}),
          content,
          sessionId: payload.session_id ?? "default",
          cwd,
        };
        const verdicts = await runRuntimeHooks(runHere, runtimeCtx);
        const exit = aggregateExitDecision(verdicts);
        if (exit.exitCode === 2) {
          for (const line of exit.stderrLines) console.error(`[codi pre-tool-use] ${line}`);
          process.exit(2);
        }
      }
    } catch {
      // Fail-open: never block due to runner internals.
    }
  }

  process.exit(0);
}

// ─── post-tool-use ─────────────────────────────────────────────────────────

function runPostToolUse(): void {
  const payload = parsePayload();
  if (!payload || typeof payload.tool_name !== "string" || !payload.tool_input) {
    process.exit(0);
  }
  const cwd = payload.cwd ?? process.cwd();

  // Observability: tool_calls + agent-memory ingestion
  if (typeof payload.session_id === "string" && payload.session_id.length > 0) {
    try {
      const handle = openBrain();
      try {
        applyMigrations(handle.raw);
        processPostToolUse(handle, {
          sessionId: payload.session_id,
          cwd,
          toolName: payload.tool_name,
          toolInput: payload.tool_input,
          toolResponse: payload.tool_response,
          ...(payload.transcript_path !== undefined
            ? { transcriptPath: payload.transcript_path }
            : {}),
        });
      } finally {
        handle.close();
      }
    } catch {
      /* non-blocking */
    }
  }

  // Scope-discipline: incidental change recording
  const call: PostToolCall = {
    tool_name: payload.tool_name,
    tool_input: payload.tool_input,
    ...(payload.tool_response !== undefined
      ? { tool_response: payload.tool_response as PostToolCall["tool_response"] }
      : {}),
  };
  const ctx = buildContext(cwd);
  const filePath = (call.tool_input["file_path"] ?? call.tool_input["path"]) as string | undefined;
  if (typeof filePath === "string") {
    const postContent = readFileSafe(filePath, cwd);
    const decision = evaluatePostToolCall(call, ctx, postContent);
    if (decision.recorded && decision.details) {
      try {
        recordIncidentalChange({
          filePath: decision.details.file_path,
          linesChanged: decision.details.lines_changed,
          classifierReason: decision.details.classifier_reason,
          author: { type: "system", id: "post-tool-use-hook" },
          cwd,
        });
      } catch {
        /* non-blocking */
      }
    }
  }

  process.exit(0);
}

// ─── stop ──────────────────────────────────────────────────────────────────

function runStop(): void {
  const payload = parsePayload();
  if (!payload || typeof payload.session_id !== "string" || payload.session_id.length === 0) {
    process.exit(0);
  }
  try {
    const handle = openBrain();
    try {
      applyMigrations(handle.raw);
      processStopHook(handle, {
        sessionId: payload.session_id,
        cwd: payload.cwd ?? process.cwd(),
        ...(payload.transcript_path !== undefined
          ? { transcriptPath: payload.transcript_path }
          : {}),
      });
    } finally {
      handle.close();
    }
  } catch {
    /* non-blocking */
  }
  process.exit(0);
}

// ─── Registration ──────────────────────────────────────────────────────────

const HOOK_NAMES = ["user-prompt-submit", "pre-tool-use", "post-tool-use", "stop"] as const;
export type AgentHookName = (typeof HOOK_NAMES)[number];

const DISPATCHERS: Record<AgentHookName, () => void | Promise<void>> = {
  "user-prompt-submit": runUserPromptSubmit,
  "pre-tool-use": runPreToolUse,
  "post-tool-use": runPostToolUse,
  stop: runStop,
};

export function registerAgentHookCommand(program: Command): void {
  const hook = program
    .command("hook <name>")
    .description(
      `Run a built-in F6/F7 agent hook against stdin payload. Names: ${HOOK_NAMES.join(", ")}. Wired into .claude/settings.json by 'codi init'.`,
    )
    .action(async (name: string) => {
      if (!(HOOK_NAMES as readonly string[]).includes(name)) {
        process.stderr.write(
          `[codi hook] Unknown hook name '${name}'. Valid: ${HOOK_NAMES.join(", ")}\n`,
        );
        process.exit(1);
      }
      await DISPATCHERS[name as AgentHookName]();
    });
  void hook;
}
