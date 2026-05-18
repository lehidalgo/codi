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
import { openBrain, type BrainHandle } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import { processPromptSubmit } from "../runtime/capture/prompt-hook.js";
import { processPostToolUse } from "../runtime/capture/tool-hook.js";
import { processStopHook } from "../runtime/capture/stop-hook.js";
import {
  buildContext,
  buildPromptStateBlock,
  buildCaptureReminderBlock,
  buildGateAdvisoryBlock,
  evaluateToolCall,
  evaluatePostToolCall,
  type PostToolCall,
  type ToolCall,
} from "../runtime/hook-logic.js";
import { BrainEventLog } from "../runtime/brain-event-log.js";
import { PROJECT_DIR, SUPPORTED_PLATFORMS } from "../constants.js";
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
import {
  buildCapabilityDiscoveryBlock,
  buildOutputModeOverrideBlock,
} from "../runtime/hooks/claude-code/capability-discovery.js";
import { runMemorySync } from "../runtime/hooks/claude-code/claudemd-memory-sync.js";
import { getRuntimeHooks } from "../core/hooks/registry/index.js";
import { runRuntimeHooks, aggregateExitDecision } from "../runtime/hooks/runner.js";
import type { HookContext as RuntimeHookCtx } from "../core/hooks/hook-artifact.js";
import {
  PostToolUsePayloadSchema,
  PreToolUsePayloadSchema,
  StopPayloadSchema,
  UserPromptSubmitPayloadSchema,
  safeParseHookPayload,
} from "#src/schemas/hook-events.js";

function readStdin(): string {
  try {
    return readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Read and JSON-parse the stdin payload. Returns `unknown` (NOT a typed
 * shape) so every caller is forced through the hook-event Zod schemas
 * in `#src/schemas/hook-events.js` — that's the only place hook
 * payloads cross the trust boundary into typed code.
 */
function parsePayloadRaw(): unknown {
  const raw = readStdin();
  if (raw.trim().length === 0) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

// ─── user-prompt-submit ────────────────────────────────────────────────────

function runUserPromptSubmit(): void {
  const cwd = process.cwd();
  const payload = safeParseHookPayload(
    UserPromptSubmitPayloadSchema,
    parsePayloadRaw(),
    "user-prompt-submit",
  );

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
          agentType: getActiveAgent(),
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
  let gateAdvisoryBlock = "";
  try {
    const handle = openBrain();
    try {
      applyMigrations(handle.raw);
      ironLawsBlock = buildIronLawsBlock({
        outputMode: readPreferences(cwd).output_mode,
        gateState: readGateState(handle.raw),
      });
      gateAdvisoryBlock = buildGateAdvisoryBlock(BrainEventLog.wrap(handle));
    } finally {
      handle.close();
    }
  } catch {
    // Iron-laws + gate-advisory blocks are advisory.
  }

  // ADR-013 Paso 8: capability-discovery + per-checkout output-mode override.
  // capability_discovery defaults to true for the codi-default preset; can be
  // disabled by editing flags.yaml or using a different preset.
  const prefs = readPreferences(cwd);
  const capabilityEnabled = prefs.capability_discovery !== false;
  const capabilityDiscoveryBlock = buildCapabilityDiscoveryBlock({
    enabled: capabilityEnabled,
  });
  const outputModeOverrideBlock = buildOutputModeOverrideBlock({ cwd });

  const out = [
    captureBlock,
    stateBlock,
    ironLawsBlock,
    gateAdvisoryBlock,
    capabilityDiscoveryBlock,
    outputModeOverrideBlock,
  ]
    .filter((s) => s.length > 0)
    .join("\n\n");
  if (out.length > 0) process.stdout.write(out + "\n");
  process.exit(0);
}

// ─── pre-tool-use ──────────────────────────────────────────────────────────

function readEnabledRuntimeHookNames(cwd: string): string[] | null {
  try {
    const stateFile = join(cwd, PROJECT_DIR, "state", "state.json");
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
  const payload = safeParseHookPayload(PreToolUsePayloadSchema, parsePayloadRaw(), "pre-tool-use");
  if (!payload || typeof payload.tool_name !== "string" || !payload.tool_input) {
    process.exit(0);
  }
  const cwd = payload.cwd ?? process.cwd();
  const call: ToolCall = { tool_name: payload.tool_name, tool_input: payload.tool_input };

  // Phase / scope gate. Workflow file/scope checks are ADVISORY: print to
  // stderr (visible to dev) but never exit non-zero. Hard gates remain
  // for Iron Law 7 (git mutations) and explicit `allow: false` decisions
  // (e.g. classifier-blocked dangerous bash, future security policies).
  const ctx = buildContext(cwd);
  const decision = evaluateToolCall(call, ctx);
  if (!decision.allow) {
    console.error(`[codi pre-tool-use] BLOCKED: ${decision.reason}`);
    console.error(`[codi pre-tool-use] Suggested action: ${decision.suggested_action}`);
    process.exit(2);
  }
  if (decision.advisories && decision.advisories.length > 0) {
    for (const line of decision.advisories) {
      console.error(`[codi pre-tool-use] advisory: ${line}`);
    }
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
              "[codi pre-tool-use] Ask the user to type 'ok' (case-insensitive) in their next prompt to authorize this git mutation.",
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
  const payload = safeParseHookPayload(
    PostToolUsePayloadSchema,
    parsePayloadRaw(),
    "post-tool-use",
  );
  if (!payload || typeof payload.tool_name !== "string" || !payload.tool_input) {
    process.exit(0);
  }
  const cwd = payload.cwd ?? process.cwd();

  // ISSUE-027: hoist a single brain handle for both processPostToolUse
  // (writes tool_calls + ingests agent-memory) and buildContext (reads
  // workflow state via reduce). Without this, PostToolUse opened the DB
  // twice per fire — once here and once inside buildContext when
  // sharedLog was undefined — doubling WAL contention + migration cost.
  // ISSUE-026's WeakSet cache does NOT defang this: each openBrain()
  // returns a fresh Database instance with its own cache identity.
  let sharedHandle: BrainHandle | null = null;
  let sharedLog: BrainEventLog | null = null;
  try {
    sharedHandle = openBrain();
    applyMigrations(sharedHandle.raw);
    sharedLog = BrainEventLog.wrap(sharedHandle);
  } catch {
    // Brain unreachable — both observability + workflow-context paths
    // degrade gracefully via the null checks below.
  }

  // Observability: tool_calls + agent-memory ingestion
  if (sharedHandle && typeof payload.session_id === "string" && payload.session_id.length > 0) {
    try {
      processPostToolUse(sharedHandle, {
        sessionId: payload.session_id,
        cwd,
        toolName: payload.tool_name,
        toolInput: payload.tool_input,
        toolResponse: payload.tool_response,
        agentType: getActiveAgent(),
        ...(payload.transcript_path !== undefined
          ? { transcriptPath: payload.transcript_path }
          : {}),
      });
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
  const ctx = sharedLog ? buildContext(cwd, sharedLog) : buildContext(cwd);
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

  // Single dispose for the shared handle (covers both observability +
  // buildContext paths). BrainEventLog.wrap() returns a non-owning view,
  // so we close via the underlying handle.
  if (sharedHandle) {
    try {
      sharedHandle.close();
    } catch {
      /* non-blocking */
    }
  }

  // ADR-013 Paso 8: agent-memory file writes also land in CLAUDE.md so the
  // user-managed memory zone survives `codi generate`. Fail-open; runs after
  // brain persistence so observability is never blocked by file-IO.
  try {
    const prefs = readPreferences(cwd);
    runMemorySync({
      cwd,
      toolName: payload.tool_name,
      toolInput: payload.tool_input as Record<string, unknown>,
      enabled: prefs.claudemd_memory_sync !== false,
    });
  } catch {
    /* fail-open */
  }

  process.exit(0);
}

// ─── stop ──────────────────────────────────────────────────────────────────

function runStop(): void {
  const payload = safeParseHookPayload(StopPayloadSchema, parsePayloadRaw(), "stop");
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
        agentType: getActiveAgent(),
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

const VALID_AGENTS: ReadonlySet<string> = new Set(SUPPORTED_PLATFORMS);
const AGENT_ENV_KEY = "CODI_HOOK_AGENT";

/**
 * Resolve the calling agent for the current hook invocation. Priority:
 *   1. `--agent <id>` flag (set by adapter-emitted hook commands)
 *   2. `CODI_HOOK_AGENT` env var (escape hatch for custom integrations)
 *   3. Detect from process tree env (CLAUDE_CODE_*, CODEX_*, etc.)
 *   4. Fallback "claude-code" (historical default)
 *
 * The resolved id is exposed via `getActiveAgent()` so the capture
 * orchestrators tag every row consistently.
 */
let activeAgent: string = "claude-code";

export function getActiveAgent(): string {
  return activeAgent;
}

function detectAgentFromEnv(): string | null {
  if (process.env["CLAUDE_PLUGIN_ROOT"] || process.env["CLAUDE_PROJECT_DIR"]) {
    return "claude-code";
  }
  if (process.env["CODEX_HOME"] || process.env["CODEX_SESSION_ID"]) {
    return "codex";
  }
  return null;
}

// ISSUE-076: parseAgentFlag(process.argv) fallback removed — commander's
// `.option("--agent <id>")` already parses both `--agent X` and `--agent=X`
// shapes into opts.agent, so re-scanning process.argv was dead code.

export function registerAgentHookCommand(program: Command): void {
  const hook = program
    .command("hook <name>")
    .description(
      `Run a built-in F6/F7 agent hook against stdin payload. Names: ${HOOK_NAMES.join(", ")}. Wired into .claude/settings.json + .codex/hooks.json by 'codi init'.`,
    )
    .option("--agent <id>", "Originating agent id (claude-code | codex | cursor | ...)")
    .action(async (name: string, opts: { agent?: string }) => {
      if (!(HOOK_NAMES as readonly string[]).includes(name)) {
        process.stderr.write(
          `[codi hook] Unknown hook name '${name}'. Valid: ${HOOK_NAMES.join(", ")}\n`,
        );
        process.exit(1);
      }
      const flagAgent = opts.agent ?? null;
      const envAgent = process.env[AGENT_ENV_KEY];
      const detected = detectAgentFromEnv();
      const resolved = flagAgent || envAgent || detected || "claude-code";
      activeAgent = VALID_AGENTS.has(resolved) ? resolved : "claude-code";
      await DISPATCHERS[name as AgentHookName]();
    });
  void hook;
}
