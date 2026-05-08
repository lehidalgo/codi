/**
 * Capabilities Matrix (Sprint 6).
 *
 * Per master plan §3 (Z3 = D), each integration target declares which
 * artifact types and runtime features it supports. Generators consult the
 * matrix before emitting per-target output so that, e.g., we never write a
 * hooks.json into a Cursor adapter (Cursor doesn't run them).
 *
 * Tier 1A (Claude Code) — full surface, including hooks + slash commands.
 * Tier 1B (Codex CLI)   — full except UI integration.
 * Tier 2 (Cursor / Windsurf / Cline / Copilot / Gemini) — config-only:
 *   skills + rules + MCP servers. No hooks, no slash commands, no agents.
 *
 * Governance contract (Item 5 of v3 closure plan, Q3 = grandfather)
 * =================================================================
 *
 * The matrix is OPT-IN.
 *
 * NEW emission code (plugin-manifest emit, future adapters, future
 * filtering layers) MUST consult `supports()` or `targetsSupporting()`
 * before writing output for a given (target, feature) pair.
 *
 * EXISTING per-target adapters under `src/adapters/{cursor,windsurf,
 * cline,copilot,gemini}/` are GRANDFATHERED — they emit the same
 * artifacts they emitted in v2.x. Wiring them to the matrix is
 * deliberately deferred to v3.1+ to avoid silently dropping artifact
 * directories users already rely on (e.g. .cursor/agents/).
 *
 * The contract is enforced by a regression test at
 * `tests/unit/core/capabilities-governance.test.ts` that fails if any
 * file under `src/adapters/{cursor,windsurf,cline,copilot,gemini}/`
 * starts importing from `#src/core/capabilities`. If you intentionally
 * want to migrate one of those adapters to matrix-driven emission,
 * REMOVE that adapter from the regression set + update v3.1 release
 * notes so users see the change.
 *
 * This module is the single source of truth — new modules import from here.
 */

export type Tier = "1A" | "1B" | "2";

export interface TargetCapabilities {
  readonly target: TargetId;
  readonly tier: Tier;
  readonly skills: boolean;
  readonly rules: boolean;
  readonly agents: boolean;
  readonly hooks: boolean;
  readonly slashCommands: boolean;
  readonly mcp: boolean;
  readonly uiIntegration: boolean;
}

export const TARGET_IDS = [
  "claude-code",
  "codex-cli",
  "cursor",
  "windsurf",
  "cline",
  "copilot",
  "gemini",
] as const;

export type TargetId = (typeof TARGET_IDS)[number];

/**
 * Helper: build a config-only Tier 2 entry. Sprint 7 may extend Tier 2 to
 * partial agent support per-target as those tools' SDKs evolve.
 */
function tier2(id: TargetId): TargetCapabilities {
  return {
    target: id,
    tier: "2",
    skills: true,
    rules: true,
    agents: false,
    hooks: false,
    slashCommands: false,
    mcp: true,
    uiIntegration: false,
  };
}

export const CAPABILITIES_MATRIX: Readonly<Record<TargetId, TargetCapabilities>> = {
  "claude-code": {
    target: "claude-code",
    tier: "1A",
    skills: true,
    rules: true,
    agents: true,
    hooks: true,
    slashCommands: true,
    mcp: true,
    uiIntegration: true,
  },
  "codex-cli": {
    target: "codex-cli",
    tier: "1B",
    skills: true,
    rules: true,
    agents: true,
    hooks: true,
    slashCommands: true,
    mcp: true,
    uiIntegration: false,
  },
  cursor: tier2("cursor"),
  windsurf: tier2("windsurf"),
  cline: tier2("cline"),
  copilot: tier2("copilot"),
  gemini: tier2("gemini"),
};

export const TIER_1_TARGETS: readonly TargetId[] = TARGET_IDS.filter(
  (id) => CAPABILITIES_MATRIX[id].tier === "1A" || CAPABILITIES_MATRIX[id].tier === "1B",
);

export const TIER_2_TARGETS: readonly TargetId[] = TARGET_IDS.filter(
  (id) => CAPABILITIES_MATRIX[id].tier === "2",
);

/**
 * Predicate used by generators: should this target receive output for the
 * given artifact kind? Returns false for unsupported combinations rather
 * than throwing — generators should silently skip, not blow up.
 */
export function supports(
  target: TargetId,
  feature: keyof Omit<TargetCapabilities, "target" | "tier">,
): boolean {
  return CAPABILITIES_MATRIX[target][feature];
}

/**
 * Targets that support a given feature. Useful for "fan-out the rule body
 * to every target that takes rules".
 */
export function targetsSupporting(
  feature: keyof Omit<TargetCapabilities, "target" | "tier">,
): readonly TargetId[] {
  return TARGET_IDS.filter((id) => CAPABILITIES_MATRIX[id][feature]);
}
