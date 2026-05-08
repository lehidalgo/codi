#!/usr/bin/env tsx
/**
 * devloop CLI — user-facing entry point.
 *
 * Subcommands:
 *   run <type> "<task>" [--author <id>] [--author-type human|agent]
 *   status [--workflow <id>] [--json]
 *   transition --to <phase> [--author <id>]
 *   transition --approve [--author <id>]
 *   transition --reject --reason "<text>" [--author <id>]
 *   abandon --reason "<text>" [--author <id>]
 *   recover
 *   version
 */

import {
  abandonWorkflow,
  approveTransition,
  approveScopeExpansion,
  approveElevation,
  computeWorkflowStats,
  forceHandover,
  getStatus,
  handover,
  proposeScopeExpansion,
  proposeTransition,
  proposeElevation,
  recoverWorkflow,
  rejectTransition,
  rejectScopeExpansion,
  rejectElevation,
  resolveChild,
  runWorkflow,
} from "../lib/cli-handlers.js";
import { readFileSync } from "node:fs";
import * as nodeFs from "node:fs";
import * as nodePath from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EventLog } from "../lib/event-log.js";
import { devloopPaths } from "../lib/paths.js";
import { buildPrSummary } from "../lib/pr-summary.js";
import { compactAllArchives } from "../lib/compactor.js";
import { replay } from "../lib/replay.js";
import {
  PHASES,
  WORKFLOW_TYPES,
  type Author,
  type Phase,
  type WorkflowType,
} from "../lib/types.js";
import { cmdSheets } from "../lib/sheets/cli.js";
import { readPreferences, writePreferences, preferencesPath } from "../lib/preferences.js";

// Read version dynamically from plugin manifest so it never drifts
function readPluginVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifestPath = resolve(here, "..", ".claude-plugin", "plugin.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as { version?: string };
    return manifest.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VERSION = readPluginVersion();

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function authorFrom(flags: Record<string, string | boolean>): Author {
  const id = typeof flags["author"] === "string" ? flags["author"] : "user";
  const explicitType = flags["author-type"];
  const type: Author["type"] =
    explicitType === "agent" ? "agent" : explicitType === "system" ? "system" : "human";
  return { type, id };
}

// ─── run ─────────────────────────────────────────────────────────────────

function cmdRun(positional: string[], flags: Record<string, string | boolean>): void {
  const workflowType = positional[1] as WorkflowType | undefined;
  if (!workflowType || !WORKFLOW_TYPES.includes(workflowType)) {
    fail(`run requires <type> in ${WORKFLOW_TYPES.join("|")}`);
  }
  const task = positional[2];
  if (!task || task.trim().length === 0) {
    fail("run requires a task description in quotes");
  }
  const fromStory = typeof flags["from-story"] === "string" ? flags["from-story"] : undefined;
  const result = runWorkflow({
    workflowType,
    task,
    author: authorFrom(flags),
    ...(fromStory !== undefined ? { fromStoryId: fromStory } : {}),
  });
  console.log(`Started workflow ${result.workflowId}`);
  console.log(`Phase: intent`);
  console.log(`Task: ${task}`);
  if (fromStory !== undefined) {
    console.log(`From story: ${fromStory}`);
  }
}

// ─── status ──────────────────────────────────────────────────────────────

function cmdStatus(_positional: string[], flags: Record<string, string | boolean>): void {
  const workflowId = typeof flags["workflow"] === "string" ? flags["workflow"] : undefined;
  const result = getStatus(workflowId !== undefined ? { workflowId } : {});

  if (!result.active || !result.state) {
    if (flags["json"] === true) {
      console.log(JSON.stringify({ active: false, state: null }, null, 2));
    } else {
      console.log("No active workflow.");
    }
    return;
  }

  if (flags["json"] === true) {
    console.log(JSON.stringify({ active: true, state: result.state }, null, 2));
    return;
  }

  const s = result.state;
  console.log(`Workflow: ${s.workflow_id} (${s.workflow_type})`);
  console.log(`Task:     ${s.task}`);
  console.log(`Status:   ${s.status}`);
  console.log(`Phase:    ${s.current_phase}`);
  console.log(`Owner:    ${s.current_owner}`);
  console.log(`Started:  ${s.started_at}`);
  console.log(`Events:   ${s.events_count}`);
  console.log(
    `Scope:    ${s.scope.files_in_plan.length} files in plan, ${s.scope.incidental_changes} incidental, ${s.scope.scope_expansions_approved} expansions approved`,
  );
  console.log(
    `Subagents: ${s.subagent_stats.total_dispatched} dispatched, ${s.subagent_stats.total_tokens_consumed} tokens`,
  );
  console.log(
    `Children: ${s.child_workflows.length} (${s.child_workflows.filter((c) => c.status === "active").length} active)`,
  );
  if (s.paused_for_child_id) {
    console.log(`Paused for child: ${s.paused_for_child_id}`);
  }
}

// ─── transition ──────────────────────────────────────────────────────────

function cmdTransition(_positional: string[], flags: Record<string, string | boolean>): void {
  const author = authorFrom(flags);

  if (flags["approve"] === true) {
    const result = approveTransition({ author });
    console.log(`Approved transition ${result.fromPhase} → ${result.toPhase}.`);
    console.log(`Workflow ${result.workflowId} now in phase ${result.toPhase}.`);
    return;
  }

  if (flags["reject"] === true) {
    const reason = flags["reason"];
    if (typeof reason !== "string") fail("reject requires --reason '<text>'");
    const result = rejectTransition({ reason, author });
    console.log(`Rejected transition ${result.fromPhase} → ${result.rejectedToPhase}.`);
    return;
  }

  const to = flags["to"];
  if (typeof to !== "string" || !PHASES.includes(to as Phase)) {
    fail(`transition requires --to <phase> in ${PHASES.join("|")}`);
  }
  const result = proposeTransition({ toPhase: to as Phase, author });
  console.log(`Proposed transition ${result.fromPhase} → ${result.toPhase}.`);
  console.log(
    `Run \`devloop transition --approve\` or \`devloop transition --reject --reason "<text>"\` to resolve.`,
  );
}

// ─── scope ───────────────────────────────────────────────────────────────

function cmdScope(positional: string[], flags: Record<string, string | boolean>): void {
  const sub = positional[1];
  const author = authorFrom(flags);

  if (sub === "propose-expansion") {
    const filePath = flags["file"];
    const reason = flags["reason"];
    if (typeof filePath !== "string") fail("propose-expansion requires --file <path>");
    if (typeof reason !== "string") fail("propose-expansion requires --reason '<text>'");
    const result = proposeScopeExpansion({ filePath, reason, author });
    console.log(`Proposed scope expansion for '${result.filePath}'.`);
    console.log(`Run \`devloop scope approve --file '${result.filePath}'\` to approve, or`);
    console.log(
      `\`devloop scope reject --file '${result.filePath}' --reason "<text>"\` to reject.`,
    );
    return;
  }

  if (sub === "approve") {
    const filePath = typeof flags["file"] === "string" ? flags["file"] : undefined;
    const result = approveScopeExpansion(
      filePath !== undefined ? { filePath, author } : { author },
    );
    console.log(`Scope expansion approved for '${result.filePath}'.`);
    return;
  }

  if (sub === "reject") {
    const reason = flags["reason"];
    if (typeof reason !== "string") fail("scope reject requires --reason '<text>'");
    const filePath = typeof flags["file"] === "string" ? flags["file"] : undefined;
    const result = rejectScopeExpansion(
      filePath !== undefined ? { filePath, reason, author } : { reason, author },
    );
    console.log(`Scope expansion rejected for '${result.filePath}'.`);
    return;
  }

  fail(`scope subcommand must be one of: propose-expansion, approve, reject`);
}

// ─── abandon ─────────────────────────────────────────────────────────────

function cmdAbandon(_positional: string[], flags: Record<string, string | boolean>): void {
  const reason = flags["reason"];
  if (typeof reason !== "string") fail("abandon requires --reason '<text>'");
  const result = abandonWorkflow({ reason, author: authorFrom(flags) });
  console.log(`Abandoned workflow ${result.workflowId} in phase ${result.abandonedInPhase}.`);
}

// ─── recover ─────────────────────────────────────────────────────────────

function cmdRecover(): void {
  const result = recoverWorkflow();
  if (result.recovered) {
    console.log(`Recovered workflow: ${result.workflowId}`);
    console.log(result.reason);
  } else {
    console.log(result.reason);
  }
}

// ─── child / elevation ───────────────────────────────────────────────────

function cmdChild(positional: string[], flags: Record<string, string | boolean>): void {
  const sub = positional[1];
  const author = authorFrom(flags);

  if (sub === "elevate") {
    const type = flags["type"];
    const reason = flags["reason"];
    const trigger = typeof flags["trigger"] === "string" ? flags["trigger"] : "manual";
    if (typeof type !== "string" || !WORKFLOW_TYPES.includes(type as WorkflowType)) {
      fail(`elevate requires --type in ${WORKFLOW_TYPES.join("|")}`);
    }
    if (typeof reason !== "string") fail("elevate requires --reason '<text>'");
    proposeElevation({
      childWorkflowType: type as WorkflowType,
      trigger,
      reason,
      author,
    });
    console.log(`Proposed elevation to ${type}.`);
    console.log(`Run \`devloop child approve\` or \`devloop child reject --reason "<text>"\`.`);
    return;
  }
  if (sub === "approve") {
    const result = approveElevation({ author });
    console.log(`Elevation approved. Child: ${result.childWorkflowId}`);
    console.log(`Branch: ${result.childBranch}`);
    return;
  }
  if (sub === "reject") {
    const reason = flags["reason"];
    if (typeof reason !== "string") fail("child reject requires --reason '<text>'");
    rejectElevation({ reason, author });
    console.log("Elevation rejected.");
    return;
  }
  if (sub === "resolve") {
    const childId = flags["id"];
    const status = flags["status"];
    if (typeof childId !== "string") fail("resolve requires --id <child-workflow-id>");
    if (status !== "completed" && status !== "abandoned") {
      fail("resolve requires --status completed|abandoned");
    }
    const summary = typeof flags["summary"] === "string" ? flags["summary"] : undefined;
    const result = resolveChild({
      childWorkflowId: childId,
      status,
      ...(summary !== undefined ? { summary } : {}),
      author,
    });
    console.log(`Child ${childId} resolved as ${status}.`);
    console.log(`Parent ${result.parentWorkflowId} resumed in phase ${result.resumedInPhase}.`);
    return;
  }
  fail("child subcommands: elevate, approve, reject, resolve");
}

// ─── pr ──────────────────────────────────────────────────────────────────

function cmdPr(positional: string[]): void {
  const sub = positional[1];
  const log = EventLog.fromCwd(process.cwd());
  const wId = log.getActiveWorkflowId();
  if (!wId) fail("No active workflow.");

  const events = log.loadArchivedEvents(wId);
  if (events.length === 0) fail(`No archived events for ${wId}.`);

  if (sub === "generate-summary") {
    const summary = buildPrSummary(events);
    process.stdout.write(summary.block + "\n");
    return;
  }
  if (sub === "verify-summary") {
    const summary = buildPrSummary(events);
    console.log(`Hash: sha256:${summary.hash}`);
    return;
  }
  fail("pr subcommands: generate-summary, verify-summary");
}

// ─── replay ──────────────────────────────────────────────────────────────

function cmdReplay(positional: string[], flags: Record<string, string | boolean>): void {
  const archiveId = positional[1];
  if (!archiveId) fail("replay requires <archive-id>");
  const log = EventLog.fromCwd(process.cwd());
  const events = log.loadArchivedEvents(archiveId);
  if (events.length === 0) fail(`No archived events for ${archiveId}.`);
  const untilFlag = flags["until"];
  const until = typeof untilFlag === "string" ? untilFlag : undefined;
  const result = replay(events, until !== undefined ? { untilEventId: until } : {});
  console.log(JSON.stringify(result, null, 2));
}

// ─── compact ─────────────────────────────────────────────────────────────

function cmdCompact(_positional: string[], flags: Record<string, string | boolean>): void {
  const paths = devloopPaths(process.cwd());
  const thresholdFlag = flags["threshold"];
  const threshold = typeof thresholdFlag === "string" ? parseInt(thresholdFlag, 10) : 180;
  const results = compactAllArchives({
    archivesDir: paths.archivesDir,
    thresholdDays: threshold,
  });
  console.log(JSON.stringify(results, null, 2));
}

// ─── handover ────────────────────────────────────────────────────────────

function cmdHandover(_positional: string[], flags: Record<string, string | boolean>): void {
  const author = authorFrom(flags);
  if (flags["force"] === true) {
    const to = flags["to"];
    const maintainer = flags["maintainer"];
    const reason = flags["reason"];
    if (typeof to !== "string") fail("force-handover requires --to <dev-id>");
    if (typeof maintainer !== "string") fail("force-handover requires --maintainer <id>");
    if (typeof reason !== "string") fail("force-handover requires --reason '<text>'");
    const result = forceHandover({
      toDevId: to,
      maintainerId: maintainer,
      reason,
      author,
    });
    console.log(`Force-handover: ${result.fromDevId} → ${result.toDevId}`);
    return;
  }

  const to = flags["to"];
  const reason = flags["reason"];
  if (typeof to !== "string") fail("handover requires --to <dev-id>");
  if (typeof reason !== "string") fail("handover requires --reason '<text>'");
  const result = handover({ toDevId: to, reason, author });
  console.log(`Handover: ${result.fromDevId} → ${result.toDevId}`);
}

// ─── stats ───────────────────────────────────────────────────────────────

function cmdStats(positional: string[]): void {
  const sub = positional[1];
  const stats = computeWorkflowStats({});
  if (sub === "tokens") {
    console.log(JSON.stringify(stats.tokens, null, 2));
    return;
  }
  if (sub === "durations") {
    console.log(JSON.stringify(stats.durations, null, 2));
    return;
  }
  if (sub === "retries") {
    console.log(JSON.stringify(stats.retries, null, 2));
    return;
  }
  console.log(JSON.stringify(stats, null, 2));
}

// ─── version ─────────────────────────────────────────────────────────────

function cmdVersion(): void {
  console.log(`devloop v${VERSION}`);
}

// ─── help ────────────────────────────────────────────────────────────────

function cmdHelp(): void {
  console.log("devloop — phase-locked workflow CLI for Claude Code");
  console.log("");
  console.log("Usage:");
  console.log('  devloop run <type> "<task>" [--author <id>] [--author-type human|agent]');
  console.log("  devloop status [--workflow <id>] [--json]");
  console.log("  devloop transition --to <phase> [--author <id>]");
  console.log("  devloop transition --approve [--author <id>]");
  console.log('  devloop transition --reject --reason "<text>" [--author <id>]');
  console.log('  devloop scope propose-expansion --file <path> --reason "<text>"');
  console.log("  devloop scope approve [--file <path>]");
  console.log('  devloop scope reject --reason "<text>" [--file <path>]');
  console.log('  devloop abandon --reason "<text>" [--author <id>]');
  console.log("  devloop recover");
  console.log("  devloop version");
  console.log("");
  console.log(`Workflow types: ${WORKFLOW_TYPES.join(", ")}`);
  console.log(`Phases: ${PHASES.join(", ")}`);
}

// ─── Entry ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const sub = positional[0];

  try {
    switch (sub) {
      case "run":
        cmdRun(positional, flags);
        break;
      case "status":
        cmdStatus(positional, flags);
        break;
      case "transition":
        cmdTransition(positional, flags);
        break;
      case "scope":
        cmdScope(positional, flags);
        break;
      case "child":
        cmdChild(positional, flags);
        break;
      case "pr":
        cmdPr(positional);
        break;
      case "replay":
        cmdReplay(positional, flags);
        break;
      case "compact":
        cmdCompact(positional, flags);
        break;
      case "handover":
        cmdHandover(positional, flags);
        break;
      case "stats":
        cmdStats(positional);
        break;
      case "abandon":
        cmdAbandon(positional, flags);
        break;
      case "recover":
        cmdRecover();
        break;
      case "sheets":
        await cmdSheets(positional, flags);
        break;
      case "list-workflows":
      case "workflows":
        cmdListWorkflows(flags);
        break;
      case "preferences":
      case "prefs":
        cmdPreferences(positional, flags);
        break;
      case "version":
      case "--version":
      case "-v":
        cmdVersion();
        break;
      case undefined:
      case "help":
      case "--help":
      case "-h":
        cmdHelp();
        break;
      default:
        console.error(`unknown subcommand: ${sub}`);
        cmdHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    process.exit(1);
  }
}

/**
 * `devloop list-workflows` — print the canonical workflow inventory + active
 * project / workflow state. Used by the agent when it needs to recover the
 * menu without reading the SessionStart context.
 */
function cmdListWorkflows(flags: Record<string, string | boolean | undefined>): void {
  // Inline imports keep this command self-contained — fs / path are tiny.
  const fs = nodeFs;
  const path = nodePath;
  const cwd = process.cwd();

  const workflows = [
    { name: "project", blurb: "bootstrap a new project + Google Sheet from stakeholder docs" },
    { name: "feature", blurb: "deliver a UserStory end-to-end" },
    { name: "bug-fix", blurb: "reproduce → plan hypotheses → fix → verify" },
    { name: "refactor", blurb: "deepen a module without behavior change" },
    { name: "migration", blurb: "schema/data migration with rollback path required" },
    { name: "quality-gates", blurb: "set up + verify hooks/CI" },
  ];

  let projectName: string | null = null;
  let sheetId: string | null = null;
  let activeWorkflow: string | null = null;
  try {
    const cfgPath = path.join(cwd, ".devloop", "project.json");
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as Record<string, unknown>;
      projectName = typeof cfg["project_name"] === "string" ? cfg["project_name"] : null;
      sheetId = typeof cfg["sheet_id"] === "string" ? cfg["sheet_id"] : null;
    }
    const idPath = path.join(cwd, ".workflow", "active", "workflow-id.txt");
    if (fs.existsSync(idPath)) {
      activeWorkflow = fs.readFileSync(idPath, "utf8").trim() || null;
    }
  } catch {
    /* best-effort state probe */
  }

  if (flags["json"] === true) {
    console.log(
      JSON.stringify(
        {
          project: projectName,
          sheet_id: sheetId,
          active_workflow: activeWorkflow,
          workflows,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`devloop workflows`);
  console.log(``);
  console.log(`  project:    ${projectName ?? "none"}`);
  console.log(`  sheet:      ${sheetId ?? "(no Sheet bound)"}`);
  console.log(`  workflow:   ${activeWorkflow ?? "none active"}`);
  console.log(``);
  for (const w of workflows) {
    console.log(`  ${w.name.padEnd(14)} ${w.blurb}`);
  }
}

/**
 * `devloop preferences <show|set output-mode <caveman|normal>>`
 *
 * Persistent per-project preferences read by the SessionStart hook.
 */
function cmdPreferences(
  positional: ReadonlyArray<string>,
  flags: Record<string, string | boolean | undefined>,
): void {
  const sub = positional[1] ?? "show";
  const cwd = process.cwd();

  if (sub === "show") {
    const prefs = readPreferences(cwd);
    if (flags["json"] === true) {
      console.log(JSON.stringify({ ...prefs, path: preferencesPath(cwd) }, null, 2));
    } else {
      console.log(`devloop preferences (${preferencesPath(cwd)})`);
      console.log(`  output_mode:  ${prefs.output_mode}`);
    }
    return;
  }

  if (sub === "set") {
    const key = positional[2];
    const value = positional[3];
    if (!key || value === undefined) {
      console.error(`devloop preferences set <key> <value>`);
      console.error(`  keys: output-mode (caveman | normal)`);
      process.exit(1);
    }
    if (key === "output-mode" || key === "output_mode") {
      if (value !== "caveman" && value !== "normal") {
        console.error(`output-mode must be 'caveman' or 'normal' (got '${value}')`);
        process.exit(1);
      }
      writePreferences(cwd, { output_mode: value });
      console.log(`✓ output_mode = ${value}  (${preferencesPath(cwd)})`);
      return;
    }
    console.error(`unknown preference key: '${key}'`);
    process.exit(1);
  }

  console.error(`devloop preferences <show | set <key> <value>>`);
  process.exit(1);
}

main();
