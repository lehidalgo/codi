/**
 * Agent auto-memory ingestion (DEFECT-009 follow-up).
 *
 * Coding agents persist long-term knowledge in different ways:
 *
 *   - Claude Code: ~/.claude/projects/<slug>/memory/*.md
 *                  YAML frontmatter (name/description/type/originSessionId)
 *                  + Markdown body with "Why" / "How to apply" sections.
 *   - Codex:       ~/.codex/memories/  — directory layout exists, file
 *                  format not documented at the time of writing.
 *                  Provider stubbed below; fill in when format is known.
 *   - Gemini:      ~/.gemini/GEMINI.md  — single file, not per-project.
 *                  Out of scope for now (different paradigm).
 *   - Cursor / Windsurf / Copilot: no structured memory layout exposed.
 *
 * This module mirrors those writes into the brain's `captures` table —
 * lossless content preservation, dedup keyed by content hash, no schema
 * change. The PostToolUse hook calls `ingestAgentMemory` after every tool
 * call; the function is a no-op for non-memory writes.
 *
 * Same canonical capture vocabulary (Iron Law 9 closed set), same table.
 * Per-agent differences are absorbed by the provider implementations
 * below.
 */

import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import type { CaptureType } from "./markers.js";
import type { AgentId } from "#src/adapters/index.js";
import { resolveTeamId } from "#src/core/audit/resolve-team.js";

// ─── Provider contract ─────────────────────────────────────────────────────

export interface MemoryProvider {
  /** Stable agent id matching `sessions.agent_type`. */
  readonly agentType: string;
  /** True when this tool call writes a structured memory file. */
  isMemoryWrite(toolName: string, filePath: unknown): boolean;
  /** Parse the file content into a normalised memory record. */
  parseMemory(content: string): ParsedMemory;
}

export interface ParsedMemory {
  readonly name?: string;
  readonly description?: string;
  /** Source-side type vocabulary, mapped to CaptureType by `mapMemoryTypeToCaptureType`. */
  readonly type?: string;
  readonly originSessionId?: string;
  readonly body: string;
}

// ─── Shared helpers ────────────────────────────────────────────────────────

/**
 * Map an agent's source-side memory type vocabulary to the closed Iron
 * Law 9 capture set so the brain stays in a single canonical schema.
 *   feedback   → FEEDBACK
 *   user       → PREFERENCE
 *   project    → OBSERVATION
 *   reference  → OBSERVATION
 *   anything else (or missing) → OBSERVATION (safe default)
 */
export function mapMemoryTypeToCaptureType(memoryType: string | undefined): CaptureType {
  switch ((memoryType ?? "").toLowerCase()) {
    case "feedback":
      return "FEEDBACK";
    case "user":
      return "PREFERENCE";
    case "project":
    case "reference":
      return "OBSERVATION";
    default:
      return "OBSERVATION";
  }
}

/**
 * Generic YAML frontmatter parser. Tolerant — malformed input degrades
 * to `{ body: <full content> }` so ingestion never throws.
 */
export function parseFrontmatterMarkdown(markdown: string): ParsedMemory {
  const trimmed = markdown.trimStart();
  if (!trimmed.startsWith("---")) {
    return { body: markdown };
  }
  const afterOpen = trimmed.slice(3);
  const closeIdx = afterOpen.indexOf("\n---");
  if (closeIdx < 0) {
    return { body: markdown };
  }
  const yamlBlock = afterOpen.slice(0, closeIdx);
  const body = afterOpen.slice(closeIdx + 4).replace(/^\s*\n/, "");

  const fields: Record<string, string> = {};
  for (const rawLine of yamlBlock.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key.length === 0) continue;
    fields[key] = value.replace(/^["']|["']$/g, "");
  }

  const out: ParsedMemory = {
    body,
    ...(fields["name"] !== undefined ? { name: fields["name"] } : {}),
    ...(fields["description"] !== undefined ? { description: fields["description"] } : {}),
    ...(fields["type"] !== undefined ? { type: fields["type"] } : {}),
    ...(fields["originSessionId"] !== undefined
      ? { originSessionId: fields["originSessionId"] }
      : {}),
  };
  return out;
}

// ─── Claude Code provider ──────────────────────────────────────────────────

const CLAUDE_MEMORY_PATH_RE = /\/\.claude\/projects\/[^/]+\/memory\/[^/]+\.md$/;

export const claudeCodeProvider: MemoryProvider = {
  agentType: "claude-code",
  isMemoryWrite(toolName, filePath) {
    if (toolName !== "Write") return false;
    if (typeof filePath !== "string") return false;
    if (!CLAUDE_MEMORY_PATH_RE.test(filePath)) return false;
    if (filePath.endsWith("/MEMORY.md")) return false;
    return true;
  },
  parseMemory: parseFrontmatterMarkdown,
};

// ─── Codex provider (stub) ─────────────────────────────────────────────────
//
// `~/.codex/memories/` exists in the Codex install layout but the file
// format is not yet documented. When the format crystallises, fill in:
//   1. The path predicate in `isMemoryWrite`
//   2. The parser (likely `parseFrontmatterMarkdown` if Codex chooses
//      a Markdown-with-frontmatter shape)
//   3. The agent_type override (codex sessions write 'codex' or
//      similar to sessions.agent_type)
//
// Until then, the provider matches nothing — Codex tool calls flow
// through PostToolUse normally without auto-ingestion.

const CODEX_MEMORY_PATH_RE = /\/\.codex\/memories\/[^/]+\.(md|json)$/;

export const codexProvider: MemoryProvider = {
  agentType: "codex",
  isMemoryWrite(toolName, filePath) {
    if (toolName !== "Write") return false;
    if (typeof filePath !== "string") return false;
    return CODEX_MEMORY_PATH_RE.test(filePath);
  },
  parseMemory: parseFrontmatterMarkdown, // best-effort until format is documented
};

// ─── Provider registry ─────────────────────────────────────────────────────
//
// Closed allowlist. Memory ingestion is a Claude Code / Codex feature only
// — no other agent in the supported matrix exposes a structured per-project
// memory layout we can ingest losslessly. For sessions tagged with any
// other agent_type (gemini, cursor, windsurf, copilot, copilot-cli, ...),
// the ingestion silently no-ops and the standard tool_calls observability
// still records the write.

// Deliberate subset of `SUPPORTED_PLATFORMS` (constants.ts) — agent-memory
// ingestion is only implemented for claude-code and codex transcripts; other
// agents no-op. The `satisfies` constraint enforces that every entry is also
// declared in the canonical id list, so renaming an agent there (or removing
// support) will surface here at compile time instead of silently desyncing.
export const SUPPORTED_AGENT_TYPES = ["claude-code", "codex"] as const satisfies readonly AgentId[];
export type SupportedAgentType = (typeof SUPPORTED_AGENT_TYPES)[number];

export function isSupportedAgentType(
  agentType: string | undefined,
): agentType is SupportedAgentType {
  return (
    typeof agentType === "string" &&
    (SUPPORTED_AGENT_TYPES as readonly string[]).includes(agentType)
  );
}

const PROVIDERS: readonly MemoryProvider[] = [claudeCodeProvider, codexProvider];

/**
 * Resolve the right provider for a (agentType, toolName, filePath) tuple.
 * Returns the first provider that claims the write, or null when:
 *
 *   - agentType is provided AND is NOT one of SUPPORTED_AGENT_TYPES
 *     (graceful degradation for gemini/cursor/windsurf/copilot/etc.)
 *   - agentType is provided AND supported, but the path doesn't match
 *     that provider's layout
 *   - agentType is missing AND no provider's path matcher claims it
 *
 * The "missing agentType" path-fallback only runs through SUPPORTED
 * providers — never through a future unsupported provider that might be
 * added experimentally.
 */
export function resolveMemoryProvider(
  toolName: string,
  filePath: unknown,
  agentType?: string,
): MemoryProvider | null {
  if (typeof agentType === "string") {
    if (!isSupportedAgentType(agentType)) return null;
    const exact = PROVIDERS.find((p) => p.agentType === agentType);
    if (exact && exact.isMemoryWrite(toolName, filePath)) return exact;
    return null;
  }
  // Missing agentType — fall back to path-only match across the supported set.
  for (const p of PROVIDERS) {
    if (p.isMemoryWrite(toolName, filePath)) return p;
  }
  return null;
}

// ─── Backwards-compatible Claude detector + parser ─────────────────────────
//
// Re-exported so existing callers keep working without churn.

export const isClaudeMemoryWrite = (toolName: string, filePath: unknown): boolean =>
  claudeCodeProvider.isMemoryWrite(toolName, filePath);

export const parseMemoryFrontmatter = parseFrontmatterMarkdown;

// ─── Ingestion ─────────────────────────────────────────────────────────────

export interface IngestMemoryInput {
  readonly sessionId: string;
  readonly turnId: number;
  readonly promptId: number;
  readonly toolName: string;
  readonly toolInput: unknown;
  readonly agentType?: string;
  readonly workflowId?: string;
  readonly phase?: string;
}

export interface IngestMemoryResult {
  readonly ingested: boolean;
  readonly captureId?: number;
  readonly providerAgentType?: string;
  readonly skippedReason?: string;
}

/**
 * If the tool call is an agent memory write recognised by any registered
 * provider, persist the full content into `captures` with a synthetic
 * dedup-friendly raw_marker. Idempotent — repeated identical writes to
 * the same file collapse on (turn_id, raw_marker).
 */
export function ingestAgentMemory(
  raw: Database.Database,
  input: IngestMemoryInput,
): IngestMemoryResult {
  // Graceful degradation: unsupported agents (gemini/cursor/windsurf/
  // copilot/...) never get their tool calls scrutinised for memory shape.
  if (input.agentType !== undefined && !isSupportedAgentType(input.agentType)) {
    return {
      ingested: false,
      skippedReason: `unsupported agent_type '${input.agentType}' (memory ingestion is Claude Code / Codex only)`,
    };
  }

  const toolInput = (input.toolInput ?? {}) as Record<string, unknown>;
  const filePath = toolInput["file_path"];

  const provider = resolveMemoryProvider(input.toolName, filePath, input.agentType);
  if (!provider) {
    return { ingested: false, skippedReason: "no provider matched" };
  }

  const content = toolInput["content"];
  if (typeof content !== "string" || content.length === 0) {
    return {
      ingested: false,
      providerAgentType: provider.agentType,
      skippedReason: "Write payload has empty content",
    };
  }

  const parsed = provider.parseMemory(content);
  const captureType = mapMemoryTypeToCaptureType(parsed.type);

  const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  const rawMarker = `${provider.agentType}-memory://${filePath as string}:${hash}`;

  const existing = raw
    .prepare(`SELECT capture_id FROM captures WHERE turn_id = ? AND raw_marker = ?`)
    .get(input.turnId, rawMarker) as { capture_id?: number } | undefined;
  if (existing?.capture_id !== undefined) {
    return {
      ingested: false,
      captureId: existing.capture_id,
      providerAgentType: provider.agentType,
      skippedReason: "duplicate",
    };
  }

  const result = raw
    .prepare(
      `INSERT INTO captures(session_id, prompt_id, turn_id, ts, type, content, raw_marker, file_paths, workflow_id, phase, team_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.sessionId,
      input.promptId,
      input.turnId,
      Date.now(),
      captureType,
      content,
      rawMarker,
      JSON.stringify([filePath]),
      input.workflowId ?? null,
      input.phase ?? null,
      resolveTeamId(),
    );

  return {
    ingested: true,
    captureId: Number(result.lastInsertRowid),
    providerAgentType: provider.agentType,
  };
}

/**
 * Helper used by retroactive scanners (`codi brain ingest-memory`) — same
 * insertion logic but takes a pre-parsed (filePath, content, agentType)
 * triple. The synthetic raw_marker uses agent_type prefix so claude-memory
 * and codex-memory entries don't collide on the same path.
 */
export function ingestMemoryFile(
  raw: Database.Database,
  args: {
    readonly sessionId: string;
    readonly turnId: number;
    readonly promptId: number;
    readonly agentType: string;
    readonly filePath: string;
    readonly content: string;
    readonly workflowId?: string;
    readonly phase?: string;
  },
): IngestMemoryResult {
  if (!isSupportedAgentType(args.agentType)) {
    return {
      ingested: false,
      skippedReason: `unsupported agent_type '${args.agentType}' (memory ingestion is Claude Code / Codex only)`,
    };
  }
  const provider = PROVIDERS.find((p) => p.agentType === args.agentType);
  const parsed = (provider?.parseMemory ?? parseFrontmatterMarkdown)(args.content);
  const captureType = mapMemoryTypeToCaptureType(parsed.type);
  const hash = createHash("sha256").update(args.content).digest("hex").slice(0, 16);
  const rawMarker = `${args.agentType}-memory://${args.filePath}:${hash}`;

  const existing = raw
    .prepare(`SELECT capture_id FROM captures WHERE raw_marker = ? LIMIT 1`)
    .get(rawMarker) as { capture_id?: number } | undefined;
  if (existing?.capture_id !== undefined) {
    return {
      ingested: false,
      captureId: existing.capture_id,
      providerAgentType: args.agentType,
      skippedReason: "duplicate",
    };
  }

  const result = raw
    .prepare(
      `INSERT INTO captures(session_id, prompt_id, turn_id, ts, type, content, raw_marker, file_paths, workflow_id, phase, team_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      args.sessionId,
      args.promptId,
      args.turnId,
      Date.now(),
      captureType,
      args.content,
      rawMarker,
      JSON.stringify([args.filePath]),
      args.workflowId ?? null,
      args.phase ?? null,
      resolveTeamId(),
    );
  return {
    ingested: true,
    captureId: Number(result.lastInsertRowid),
    providerAgentType: args.agentType,
  };
}
