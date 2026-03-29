import { createHash } from "node:crypto";
import type { NormalizedConfig } from "../../types/config.js";
import { buildFlagInstructions } from "../../adapters/flag-instructions.js";
import { TOKEN_HASH_LENGTH, TOKEN_PREFIX } from "#src/constants.js";

export interface VerificationData {
  token: string;
  ruleNames: string[];
  skillNames: string[];
  agentNames: string[];
  commandNames: string[];
  brandNames: string[];
  mcpServerNames: string[];
  activeFlags: string[];
  timestamp: string;
}

export function buildVerificationData(
  config: NormalizedConfig,
): VerificationData {
  const ruleNames = config.rules.map((r) => r.name);
  const skillNames = config.skills.map((s) => s.name);
  const agentNames = config.agents.map((a) => a.name);
  const commandNames = config.commands.map((c) => c.name).sort();
  const brandNames = config.brands.map((b) => b.name).sort();
  const mcpServerNames = Object.keys(config.mcp.servers).sort();

  const flagText = buildFlagInstructions(config.flags);
  const activeFlags = flagText
    ? flagText.split("\n").filter((line) => line.trim().length > 0)
    : [];

  const sortedManifestAgents = [...(config.manifest.agents ?? [])].sort();
  const ruleEntries = config.rules
    .map((r) => `${r.name}:${r.content}`)
    .join(",");
  const raw = [
    config.manifest.name,
    sortedManifestAgents.join(","),
    ruleEntries,
    skillNames.join(","),
    agentNames.join(","),
    commandNames.join(","),
    brandNames.join(","),
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
    commandNames,
    brandNames,
    mcpServerNames,
    activeFlags,
    timestamp,
  };
}
