/**
 * `codi workflow` — namespaced CLI for the brain-backed workflow lifecycle.
 *
 * Wraps the runtime handlers in `src/runtime/cli-handlers.ts` so consumers
 * have a single user-facing entry point for the whole workflow surface:
 *
 *     codi workflow run <type> "<task>"
 *     codi workflow status
 *     codi workflow abandon --reason "<text>"
 *     codi workflow recover
 *     codi workflow transition --to <phase>
 *     codi workflow transition --approve
 *     codi workflow transition --reject --reason "<text>"
 *     codi workflow scope propose --file <path> --reason "<text>"
 *     codi workflow scope approve [--file <path>]
 *     codi workflow scope reject --reason "<text>" [--file <path>]
 *     codi workflow elevate <child-type> --trigger "<text>" --reason "<text>"
 *     codi workflow elevate --approve
 *     codi workflow elevate --reject --reason "<text>"
 *     codi workflow handover --to <id> --reason "<text>"
 *     codi workflow handover --force --to <id> --maintainer <id> --reason "<text>"
 *     codi workflow stats
 *
 * The CLI is a thin marshalling layer — every action delegates to a runtime
 * handler that already exists and already has its own tests. CLI flags map
 * onto handler option objects 1:1.
 */

import type { Command } from "commander";
import { Logger } from "../core/output/logger.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import {
  abandonWorkflow,
  approveElevation,
  approveScopeExpansion,
  approveTransition,
  computeWorkflowStats,
  forceHandover,
  getStatus,
  handover,
  proposeElevation,
  proposeScopeExpansion,
  proposeTransition,
  recoverWorkflow,
  rejectElevation,
  rejectScopeExpansion,
  rejectTransition,
  runWorkflow,
} from "../runtime/cli-handlers.js";
import type { Author, Phase, WorkflowType } from "../runtime/types.js";
import type { CommandResult } from "../core/output/types.js";
import { initFromOptions, handleOutput, type GlobalOptions } from "./shared.js";

// ─── Author resolution ──────────────────────────────────────────────────────

const HUMAN_AUTHOR: Author = { type: "human", id: process.env["USER"] ?? "user" };
const AGENT_AUTHOR: Author = { type: "agent", id: "claude-code" };

/**
 * Resolve the author for a CLI invocation. The default treats the invoker
 * as the human user (since `codi workflow ...` is typed by hand). Pass
 * `--as-agent` to attribute the action to the active agent — useful for
 * scripted runs and hooks that synthesize CLI calls.
 */
function resolveAuthor(asAgent?: boolean): Author {
  return asAgent ? AGENT_AUTHOR : HUMAN_AUTHOR;
}

// ─── Helpers: ok/fail wrappers ──────────────────────────────────────────────

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
        code: "WORKFLOW_HANDLER_FAILED",
        message,
        hint: "See the message above; re-run with --verbose for full handler output.",
        severity: "error",
        context: {},
      },
    ],
    exitCode: EXIT_CODES.GENERAL_ERROR,
  });
}

function tryRun<T>(
  command: string,
  fn: () => T,
): CommandResult<T> | CommandResult<{ message: string }> {
  try {
    return ok(command, fn());
  } catch (e) {
    return fail(command, e instanceof Error ? e.message : String(e));
  }
}

// ─── Subcommand registration ────────────────────────────────────────────────

interface AsAgentFlag {
  asAgent?: boolean;
}

interface RunFlags extends AsAgentFlag {
  fromStory?: string;
}

interface AbandonFlags extends AsAgentFlag {
  reason: string;
}

interface TransitionFlags extends AsAgentFlag {
  to?: string;
  approve?: boolean;
  reject?: boolean;
  reason?: string;
}

interface ScopeProposeFlags extends AsAgentFlag {
  file: string;
  reason: string;
}

interface ScopeApproveFlags extends AsAgentFlag {
  file?: string;
}

interface ScopeRejectFlags extends AsAgentFlag {
  file?: string;
  reason: string;
}

interface ElevateFlags extends AsAgentFlag {
  trigger?: string;
  reason?: string;
  approve?: boolean;
  reject?: boolean;
}

interface HandoverFlags extends AsAgentFlag {
  to: string;
  reason: string;
  force?: boolean;
  maintainer?: string;
}

const VALID_WORKFLOW_TYPES: ReadonlyArray<WorkflowType> = [
  "feature",
  "bug-fix",
  "refactor",
  "migration",
  "project",
];

const VALID_PHASES: ReadonlyArray<Phase> = [
  "intent",
  "plan",
  "decompose",
  "execute",
  "verify",
  "data-validation",
  "done",
];

function isWorkflowType(s: string): s is WorkflowType {
  return (VALID_WORKFLOW_TYPES as readonly string[]).includes(s);
}

function isPhase(s: string): s is Phase {
  return (VALID_PHASES as readonly string[]).includes(s);
}

export function registerWorkflowCommand(program: Command): void {
  const workflow = program
    .command("workflow")
    .description("Brain-backed workflow lifecycle (run / transition / scope / handover / stats)");

  // ── run ───────────────────────────────────────────────────────────────────
  workflow
    .command("run <type> <task>")
    .description("Start a new workflow run (type ∈ feature|bug-fix|refactor|migration|project)")
    .option("--from-story <id>", "UserStory ID this run delivers (e.g. US-007)")
    .option("--as-agent", "attribute the action to the agent rather than the human user")
    .action((type: string, task: string, opts: RunFlags) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result: CommandResult<unknown> = !isWorkflowType(type)
        ? fail(
            "workflow run",
            `unknown workflow type '${type}'. Valid: ${VALID_WORKFLOW_TYPES.join(", ")}`,
          )
        : tryRun("workflow run", () =>
            runWorkflow({
              workflowType: type,
              task,
              author: resolveAuthor(opts.asAgent),
              ...(opts.fromStory !== undefined ? { fromStoryId: opts.fromStory } : {}),
            }),
          );
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  // ── status ────────────────────────────────────────────────────────────────
  workflow
    .command("status")
    .description("Show the active workflow's reduced state (or 'no active workflow')")
    .action(() => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = tryRun("workflow status", () => getStatus({}));
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  // ── abandon ───────────────────────────────────────────────────────────────
  workflow
    .command("abandon")
    .description("Abandon the active workflow with a recorded reason")
    .requiredOption("--reason <text>", "why the workflow is being abandoned")
    .option("--as-agent", "attribute the action to the agent")
    .action((opts: AbandonFlags) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = tryRun("workflow abandon", () =>
        abandonWorkflow({ reason: opts.reason, author: resolveAuthor(opts.asAgent) }),
      );
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  // ── recover ───────────────────────────────────────────────────────────────
  workflow
    .command("recover")
    .description("Restore the active workflow pointer from the most recent non-terminal run")
    .action(() => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = tryRun("workflow recover", () => recoverWorkflow({}));
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  // ── transition ────────────────────────────────────────────────────────────
  workflow
    .command("transition")
    .description("Propose / approve / reject a phase transition")
    .option("--to <phase>", "target phase (proposes a transition)")
    .option("--approve", "approve the pending transition")
    .option("--reject", "reject the pending transition (requires --reason)")
    .option("--reason <text>", "rejection reason (required with --reject)")
    .option("--as-agent", "attribute the action to the agent")
    .action((opts: TransitionFlags) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const author = resolveAuthor(opts.asAgent);
      let result: CommandResult<unknown>;
      const flagsSet = [opts.to !== undefined, !!opts.approve, !!opts.reject].filter(
        Boolean,
      ).length;
      if (flagsSet === 0) {
        result = fail(
          "workflow transition",
          "supply exactly one of --to <phase> | --approve | --reject",
        );
      } else if (flagsSet > 1) {
        result = fail("workflow transition", "--to / --approve / --reject are mutually exclusive");
      } else if (opts.to !== undefined) {
        result = !isPhase(opts.to)
          ? fail(
              "workflow transition",
              `unknown phase '${opts.to}'. Valid: ${VALID_PHASES.join(", ")}`,
            )
          : tryRun("workflow transition --to", () =>
              proposeTransition({ toPhase: opts.to as Phase, author }),
            );
      } else if (opts.approve) {
        result = tryRun("workflow transition --approve", () => approveTransition({ author }));
      } else {
        // --reject branch
        if (!opts.reason || opts.reason.trim().length === 0) {
          result = fail("workflow transition --reject", "--reject requires --reason '<text>'");
        } else {
          result = tryRun("workflow transition --reject", () =>
            rejectTransition({ reason: opts.reason as string, author }),
          );
        }
      }
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  // ── scope ─────────────────────────────────────────────────────────────────
  const scope = workflow.command("scope").description("Scope-expansion proposals");

  scope
    .command("propose")
    .description("Propose adding a file to the current plan scope")
    .requiredOption("--file <path>", "file path to add")
    .requiredOption("--reason <text>", "why the file must be in scope")
    .option("--as-agent", "attribute the action to the agent")
    .action((opts: ScopeProposeFlags) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = tryRun("workflow scope propose", () =>
        proposeScopeExpansion({
          filePath: opts.file,
          reason: opts.reason,
          author: resolveAuthor(opts.asAgent),
        }),
      );
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  scope
    .command("approve")
    .description("Approve the most recent unresolved scope proposal (optionally by file)")
    .option("--file <path>", "approve only the proposal for this file")
    .option("--as-agent", "attribute the action to the agent")
    .action((opts: ScopeApproveFlags) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = tryRun("workflow scope approve", () =>
        approveScopeExpansion({
          author: resolveAuthor(opts.asAgent),
          ...(opts.file !== undefined ? { filePath: opts.file } : {}),
        }),
      );
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  scope
    .command("reject")
    .description("Reject the most recent unresolved scope proposal")
    .requiredOption("--reason <text>", "rejection reason")
    .option("--file <path>", "reject only the proposal for this file")
    .option("--as-agent", "attribute the action to the agent")
    .action((opts: ScopeRejectFlags) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = tryRun("workflow scope reject", () =>
        rejectScopeExpansion({
          reason: opts.reason,
          author: resolveAuthor(opts.asAgent),
          ...(opts.file !== undefined ? { filePath: opts.file } : {}),
        }),
      );
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  // ── elevate ───────────────────────────────────────────────────────────────
  workflow
    .command("elevate")
    .argument("[child-type]", "child workflow type (omit when using --approve / --reject)")
    .description("Propose / approve / reject elevating to a child workflow")
    .option("--trigger <text>", "trigger code (when proposing)")
    .option("--reason <text>", "reason (proposing OR rejecting)")
    .option("--approve", "approve the pending elevation")
    .option("--reject", "reject the pending elevation (requires --reason)")
    .option("--as-agent", "attribute the action to the agent")
    .action((childType: string | undefined, opts: ElevateFlags) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const author = resolveAuthor(opts.asAgent);
      let result: CommandResult<unknown>;
      const flagsSet = [childType !== undefined, !!opts.approve, !!opts.reject].filter(
        Boolean,
      ).length;
      if (flagsSet === 0) {
        result = fail("workflow elevate", "supply <child-type> OR --approve OR --reject");
      } else if (flagsSet > 1) {
        result = fail(
          "workflow elevate",
          "<child-type>, --approve, --reject are mutually exclusive",
        );
      } else if (childType !== undefined) {
        if (!isWorkflowType(childType)) {
          result = fail("workflow elevate", `unknown workflow type '${childType}'`);
        } else if (!opts.trigger || !opts.reason) {
          result = fail("workflow elevate", "proposing elevation requires --trigger and --reason");
        } else {
          result = tryRun("workflow elevate", () =>
            proposeElevation({
              childWorkflowType: childType,
              trigger: opts.trigger as string,
              reason: opts.reason as string,
              author,
            }),
          );
        }
      } else if (opts.approve) {
        result = tryRun("workflow elevate --approve", () => approveElevation({ author }));
      } else {
        if (!opts.reason || opts.reason.trim().length === 0) {
          result = fail("workflow elevate --reject", "--reject requires --reason '<text>'");
        } else {
          result = tryRun("workflow elevate --reject", () =>
            rejectElevation({ reason: opts.reason as string, author }),
          );
        }
      }
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  // ── handover ──────────────────────────────────────────────────────────────
  workflow
    .command("handover")
    .description("Hand the workflow over to another developer (or force as maintainer)")
    .requiredOption("--to <id>", "developer id receiving the workflow")
    .requiredOption("--reason <text>", "handover reason")
    .option("--force", "maintainer-authority handover (requires --maintainer)")
    .option("--maintainer <id>", "maintainer id (required with --force)")
    .option("--as-agent", "attribute the action to the agent")
    .action((opts: HandoverFlags) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const author = resolveAuthor(opts.asAgent);
      let result: CommandResult<unknown>;
      if (opts.force) {
        if (!opts.maintainer) {
          result = fail("workflow handover --force", "--force requires --maintainer <id>");
        } else {
          result = tryRun("workflow handover --force", () =>
            forceHandover({
              toDevId: opts.to,
              maintainerId: opts.maintainer as string,
              reason: opts.reason,
              author,
            }),
          );
        }
      } else {
        result = tryRun("workflow handover", () =>
          handover({ toDevId: opts.to, reason: opts.reason, author }),
        );
      }
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  // ── stats ─────────────────────────────────────────────────────────────────
  workflow
    .command("stats")
    .description("Aggregate stats across all workflow runs (durations, tokens, gate retries)")
    .action(() => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = tryRun("workflow stats", () => computeWorkflowStats({}));
      handleOutput(result, globalOpts);
      process.exit(result.exitCode);
    });

  // Suppress unused-import warning for Logger when imported solely for side
  // effects in future expansions.
  void Logger;
}
