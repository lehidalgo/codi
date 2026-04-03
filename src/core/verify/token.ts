import { createHash } from "node:crypto";
import type { NormalizedConfig } from "../../types/config.js";
import { buildFlagInstructions } from "../../adapters/flag-instructions.js";
import { TOKEN_HASH_LENGTH, TOKEN_PREFIX } from "#src/constants.js";

export interface VerificationData {
  token: string;
  ruleNames: string[];
  skillNames: string[];
  agentNames: string[];
  mcpServerNames: string[];
  activeFlags: string[];
  timestamp: string;
}

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
