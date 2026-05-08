/**
 * Generates a deterministic "Workflow Summary" block for PR descriptions
 * with an integrity hash. The hash is computed only over commitable
 * events, so non-commitable transients (subagent dispatches, etc.) do
 * not invalidate it.
 */

import { createHash } from "node:crypto";
import type { ManifestEvent } from "./types.js";
import { reduce } from "./reducer.js";
import { COMMITABLE_EVENT_TYPES } from "./types.js";

export interface PrSummary {
  block: string;
  hash: string;
}

export function buildPrSummary(events: ManifestEvent[]): PrSummary {
  if (events.length === 0) {
    return { block: "", hash: "" };
  }
  const state = reduce(events);
  const commitableEvents = events.filter((e) => COMMITABLE_EVENT_TYPES.has(e.event_type));
  const hash = createHash("sha256")
    .update(
      JSON.stringify(
        commitableEvents.map((e) => ({
          id: e.event_id,
          type: e.event_type,
          ts: e.timestamp,
          payload: e.payload,
        })),
      ),
    )
    .digest("hex");

  const totalDurationMs =
    new Date(state.last_event_timestamp).getTime() - new Date(state.started_at).getTime();
  const totalDurationStr = formatDuration(totalDurationMs);

  const adrs = state.knowledge.adrs_approved.length;
  const decisions = events.filter((e) => e.event_type === "decision_recorded").length;
  const incidentals = state.scope.incidental_changes;
  const expansions = state.scope.scope_expansions_approved;

  const phaseList = state.phase_history
    .map((p) => {
      const dur = p.duration_ms !== undefined ? formatDuration(p.duration_ms) : "in progress";
      const status = p.completed_at ? "[x]" : "[ ]";
      return `- ${status} ${p.phase} (${dur})`;
    })
    .join("\n");

  const lines: string[] = [
    "## Workflow Summary",
    "*Generated from `.workflow/archives/" + state.workflow_id + "/`*",
    "",
    `**Type:** ${state.workflow_type}`,
    `**Workflow ID:** ${state.workflow_id}`,
    `**Status:** ${state.status}`,
    `**Started:** ${state.started_at}`,
    `**Last event:** ${state.last_event_timestamp}`,
    `**Total duration:** ${totalDurationStr}`,
    "",
    "### Scope",
    `- **Files in plan:** ${state.scope.files_in_plan.length}`,
    `- **Incidental changes:** ${incidentals}`,
    `- **Scope expansions:** ${expansions} approved, ${state.scope.scope_expansions_rejected} rejected`,
    "",
    "### Phases",
    phaseList,
    "",
    "### Decisions and Knowledge",
    `- ADRs approved: ${adrs}`,
    `- Decisions recorded: ${decisions}`,
    `- Context terms added: ${state.knowledge.context_terms_added.length}`,
    "",
    "### Audit Trail",
    `Full event log: \`.workflow/archives/${state.workflow_id}/\``,
    `Total events: ${state.events_count}`,
    "",
    `<!-- devloop-summary-hash: sha256:${hash} -->`,
  ];

  return { block: lines.join("\n"), hash };
}

function formatDuration(ms: number): string {
  if (ms < 0) return "0s";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

export function extractHashFromBlock(block: string): string | null {
  const match = block.match(/<!-- devloop-summary-hash: sha256:([0-9a-f]{64}) -->/);
  return match ? (match[1] ?? null) : null;
}
