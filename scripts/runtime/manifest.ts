#!/usr/bin/env tsx
/**
 * manifest CLI — direct interface to the event log and reducer.
 *
 * This is the low-level CLI used internally by hooks, gate runners, and the
 * higher-level `devloop` CLI. End users should prefer `devloop run/status/...`.
 *
 * Subcommands:
 *   init     <workflow-id> --type <type> --task "<text>" [--author <id>]
 *   append   <event-type> --payload '<json>' [--parent <event-id>] [--author <id>]
 *   reduce   [--workflow <id>] [--write]
 *   status   [--workflow <id>] [--json]
 *   verify   [--workflow <id>]
 *   events   [--workflow <id>] [--type <event-type>]
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { EventLog, NoActiveWorkflowError } from "../lib/event-log.js";
import { reducedStatePath } from "../lib/paths.js";
import { createEvent } from "../lib/event-factory.js";
import { reduce } from "../lib/reducer.js";
import {
  EVENT_TYPES,
  WORKFLOW_TYPES,
  type Author,
  type EventType,
  type WorkflowType,
} from "../lib/types.js";

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

function defaultAuthor(flags: Record<string, string | boolean>): Author {
  const id = typeof flags["author"] === "string" ? flags["author"] : "agent";
  const type =
    typeof flags["author-type"] === "string"
      ? (flags["author-type"] as Author["type"])
      : id === "agent"
        ? "agent"
        : "human";
  return { type, id };
}

// ─── Subcommands ─────────────────────────────────────────────────────────

function cmdInit(positional: string[], flags: Record<string, string | boolean>): void {
  const workflowId = positional[1];
  if (!workflowId) fail("init requires a <workflow-id>");
  const workflowType = flags["type"];
  if (typeof workflowType !== "string" || !WORKFLOW_TYPES.includes(workflowType as WorkflowType)) {
    fail(`init requires --type <${WORKFLOW_TYPES.join("|")}>`);
  }
  const task = flags["task"];
  if (typeof task !== "string" || task.length === 0) {
    fail("init requires --task '<text>'");
  }

  const log = EventLog.fromCwd(process.cwd());
  const event = createEvent({
    eventType: "init",
    payload: {
      workflow_id: workflowId,
      workflow_type: workflowType,
      task,
      plugin_version: "0.1.0",
    },
    author: defaultAuthor(flags),
    parentEventId: null,
  });
  log.initWorkflow(workflowId, event);
  console.log(`Initialized workflow ${workflowId} (${workflowType}).`);
  console.log(`Task: ${task}`);
}

function cmdAppend(positional: string[], flags: Record<string, string | boolean>): void {
  const eventType = positional[1] as EventType | undefined;
  if (!eventType || !EVENT_TYPES.includes(eventType)) {
    fail(`append requires a valid <event-type>. Known types: ${EVENT_TYPES.length}`);
  }
  const payloadRaw = flags["payload"];
  if (typeof payloadRaw !== "string") fail("append requires --payload '<json>'");
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (err) {
    fail(`payload is not valid JSON: ${(err as Error).message}`);
  }

  const log = EventLog.fromCwd(process.cwd());
  const workflowId = log.getActiveWorkflowId();
  if (!workflowId) throw new NoActiveWorkflowError();

  const parentEventId = typeof flags["parent"] === "string" ? flags["parent"] : null;
  const event = createEvent({
    eventType,
    payload,
    author: defaultAuthor(flags),
    parentEventId,
  });
  const result = log.append(workflowId, event);
  console.log(
    `Appended ${eventType} (seq ${result.sequence}, ${result.commitable ? "committable" : "staging"}).`,
  );
  console.log(result.path);
}

function cmdReduce(_positional: string[], flags: Record<string, string | boolean>): void {
  const log = EventLog.fromCwd(process.cwd());
  const workflowId =
    typeof flags["workflow"] === "string" ? flags["workflow"] : log.getActiveWorkflowId();
  if (!workflowId) throw new NoActiveWorkflowError();

  // --write produces an archived-only snapshot so verify (which only reads
  // committed events) is reproducible from git. Without --write, the full
  // live state (archive + staging) is shown for debugging.
  if (flags["write"] === true) {
    const archivedEvents = log.loadArchivedEvents(workflowId);
    const archivedState = reduce(archivedEvents);
    const target = reducedStatePath(log.paths, workflowId);
    writeFileSync(target, JSON.stringify(archivedState, null, 2), "utf-8");
    console.log(`Wrote archived-only reduced state to ${target}`);
    return;
  }

  const events = log.loadEvents(workflowId);
  const state = reduce(events);
  console.log(JSON.stringify(state, null, 2));
}

function cmdStatus(_positional: string[], flags: Record<string, string | boolean>): void {
  const log = EventLog.fromCwd(process.cwd());
  const workflowId =
    typeof flags["workflow"] === "string" ? flags["workflow"] : log.getActiveWorkflowId();
  if (!workflowId) {
    console.log("No active workflow.");
    return;
  }
  const events = log.loadEvents(workflowId);
  const state = reduce(events);

  if (flags["json"] === true) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }

  console.log(`Workflow: ${state.workflow_id} (${state.workflow_type})`);
  console.log(`Task:     ${state.task}`);
  console.log(`Status:   ${state.status}`);
  console.log(`Phase:    ${state.current_phase}`);
  console.log(`Owner:    ${state.current_owner}`);
  console.log(`Started:  ${state.started_at}`);
  console.log(`Events:   ${state.events_count}`);
  console.log(
    `Scope:    ${state.scope.files_in_plan.length} files, ${state.scope.incidental_changes} incidental`,
  );
  console.log(
    `Children: ${state.child_workflows.length} (${state.child_workflows.filter((c) => c.status === "active").length} active)`,
  );
  if (state.paused_for_child_id) {
    console.log(`Paused for child: ${state.paused_for_child_id}`);
  }
}

function cmdVerify(positional: string[], flags: Record<string, string | boolean>): void {
  const log = EventLog.fromCwd(process.cwd());
  const workflowId =
    positional[1] ??
    (typeof flags["workflow"] === "string" ? flags["workflow"] : log.getActiveWorkflowId());
  if (!workflowId) fail("verify requires a <workflow-id> or active workflow");

  const events = log.loadArchivedEvents(workflowId);
  if (events.length === 0) fail(`No archived events for workflow ${workflowId}.`);
  const reReduced = reduce(events);

  const snapshotPath = reducedStatePath(log.paths, workflowId);
  if (!existsSync(snapshotPath)) {
    console.log(
      `No reduced-state.json for ${workflowId}; archive contains ${events.length} events and reduces cleanly.`,
    );
    return;
  }
  const stored = JSON.parse(readFileSync(snapshotPath, "utf-8"));
  const reReducedJson = JSON.stringify(reReduced);
  const storedJson = JSON.stringify(stored);

  if (reReducedJson === storedJson) {
    console.log(`OK: archive ${workflowId} reduces to stored snapshot.`);
  } else {
    console.error(`MISMATCH: archive ${workflowId} reduces differently from stored snapshot.`);
    process.exit(1);
  }
}

function cmdEvents(_positional: string[], flags: Record<string, string | boolean>): void {
  const log = EventLog.fromCwd(process.cwd());
  const workflowId =
    typeof flags["workflow"] === "string" ? flags["workflow"] : log.getActiveWorkflowId();
  if (!workflowId) throw new NoActiveWorkflowError();

  const events = log.loadEvents(workflowId);
  const filterType = typeof flags["type"] === "string" ? flags["type"] : null;
  for (const event of events) {
    if (filterType && event.event_type !== filterType) continue;
    console.log(
      `${event.timestamp}  ${event.event_type.padEnd(32)}  ${event.author.type}:${event.author.id}`,
    );
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────

function main(): void {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const sub = positional[0];

  try {
    switch (sub) {
      case "init":
        cmdInit(positional, flags);
        break;
      case "append":
        cmdAppend(positional, flags);
        break;
      case "reduce":
        cmdReduce(positional, flags);
        break;
      case "status":
        cmdStatus(positional, flags);
        break;
      case "verify":
        cmdVerify(positional, flags);
        break;
      case "events":
        cmdEvents(positional, flags);
        break;
      default:
        console.error("manifest CLI — subcommands: init, append, reduce, status, verify, events");
        process.exit(1);
    }
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
void resolve;
