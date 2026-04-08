import { createHash } from "node:crypto";
import type { NormalizedConfig } from "#src/types/config.js";
import { buildFlagInstructions } from "#src/adapters/flag-instructions.js";
import { TOKEN_HASH_LENGTH, TOKEN_PREFIX } from "#src/constants.js";

/**
 * Snapshot of a project's configuration used to build the verification token
 * and to validate an agent's `/verify` response.
 */
export interface VerificationData {
  /** Deterministic token derived from the full configuration hash (e.g. `"codi-a300d6153983"`). */
  token: string;
  /** Sorted list of rule names active in this configuration. */
  ruleNames: string[];
  /** Sorted list of skill names active in this configuration. */
  skillNames: string[];
  /** Sorted list of agent names active in this configuration. */
  agentNames: string[];
  /** Sorted list of MCP server names active in this configuration. */
  mcpServerNames: string[];
  /** Human-readable flag instruction lines that should appear in the agent's response. */
  activeFlags: string[];
  /** ISO-8601 timestamp when this data was generated. */
  timestamp: string;
}

/**
 * Build a {@link VerificationData} snapshot from a resolved configuration.
 *
 * The verification token is a deterministic SHA-256 hash of the project name,
 * sorted agent IDs, rule names + content, skill names, agent names, MCP server
 * names, and active flag instructions. Any change to the configuration
 * produces a different token.
 *
 * @param config - Fully resolved Codi configuration.
 * @returns Verification snapshot including the token and all sorted name lists.
 */
export function buildVerificationData(config: NormalizedConfig): VerificationData {
  const ruleNames = config.rules.map((r) => r.name).sort();
  const skillNames = config.skills.map((s) => s.name).sort();
  const agentNames = config.agents.map((a) => a.name).sort();
  const mcpServerNames = Object.keys(config.mcp.servers).sort();

  const flagText = buildFlagInstructions(config.flags);
  const activeFlags = flagText ? flagText.split("\n").filter((line) => line.trim().length > 0) : [];

  const sortedManifestAgents = [...(config.manifest.agents ?? [])].sort();
  const ruleEntries = [...config.rules]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => `${r.name}:${r.content}`)
    .join(",");
  const raw = [
    config.manifest.name,
    sortedManifestAgents.join(","),
    ruleEntries,
    skillNames.join(","),
    agentNames.join(","),
    mcpServerNames.join(","),
    activeFlags.join(","),
  ].join("|");

  const hash = createHash("sha256").update(raw, "utf8").digest("hex");
  const token = `${TOKEN_PREFIX}-${hash.slice(0, TOKEN_HASH_LENGTH)}`;
  const timestamp = new Date().toISOString();

  return {
    token,
    ruleNames,
    skillNames,
    agentNames,
    mcpServerNames,
    activeFlags,
    timestamp,
  };
}
