/**
 * Infrastructure documentation renderers: adapters, errors, hub, MCP, CLI, layers.
 */
import type { AgentAdapter } from "#src/types/agent.js";
import type { McpServerTemplate } from "#src/templates/mcp-servers/index.js";
import type { HubAction } from "#src/cli/hub.js";
import { PROJECT_CLI, PROJECT_DIR } from "#src/constants.js";

// ---------------------------------------------------------------------------
// Adapter table
// ---------------------------------------------------------------------------

export function renderAdapterTable(adapters: AgentAdapter[]): string {
  const rows = adapters.map((a) => {
    const caps = a.capabilities;
    const check = (v: boolean) => (v ? "Yes" : "—");
    return `| **${a.name}** | \`${a.paths.instructionFile}\` | ${check(caps.rules)} | ${check(caps.skills)} | ${check(caps.agents)} | ${check(caps.mcp)} |`;
  });

  return [
    "| Adapter | Instruction File | Rules | Skills | Agents | MCP |",
    "|---------|-----------------|-------|--------|--------|-----|",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Supported agents (full path matrix for README)
// ---------------------------------------------------------------------------

export function renderSupportedAgents(adapters: AgentAdapter[]): string {
  const rows = adapters.map((a) => {
    const p = a.paths;
    const caps = a.capabilities;
    const rulesCol = caps.rules ? `\`${p.rules}\`` : "—";
    const skillsCol = caps.skills ? `\`${p.skills ?? "—"}\`` : "—";
    const agentsCol = caps.agents ? `\`${p.agents ?? "—"}\`` : "—";
    const mcpCol = caps.mcp ? `\`${p.mcpConfig ?? "—"}\`` : "—";
    return `| **${a.name}** | \`${p.instructionFile}\` | ${rulesCol} | ${skillsCol} | ${agentsCol} | ${mcpCol} |`;
  });

  return [
    "| Agent | Config File | Rules | Skills | Agents | MCP |",
    "|:------|:-----------|:-----:|:------:|:------:|:---:|",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Error catalog summary
// ---------------------------------------------------------------------------

interface ErrorEntry {
  exitCode: number;
  severity: string;
  hintTemplate: string;
}

export function renderErrorCatalog(
  catalog: Record<string, ErrorEntry>,
): string {
  const rows = Object.entries(catalog).map(([code, entry]) => {
    const hint = entry.hintTemplate.replace(/\{[^}]+\}/g, "...").slice(0, 80);
    return `| \`${code}\` | ${entry.severity} | ${entry.exitCode} | ${hint} |`;
  });

  return [
    "| Code | Severity | Exit | Hint |",
    "|------|----------|------|------|",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Hub actions
// ---------------------------------------------------------------------------

export function renderHubActions(actions: HubAction[]): string {
  const rows = actions.map((a) => {
    return `| ${a.label} | ${a.hint} | \`${a.group}\` |`;
  });

  return [
    "| Action | Description | Group |",
    "|--------|-------------|-------|",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// MCP servers
// ---------------------------------------------------------------------------

export function renderMcpServers(
  servers: Record<string, McpServerTemplate>,
): string {
  const rows = Object.entries(servers).map(([key, srv]) => {
    const type = srv.type ?? "stdio";
    const cmd = srv.command
      ? `\`${srv.command} ${(srv.args ?? []).join(" ")}\``
      : (srv.url ?? "—");
    return `| \`${key}\` | ${srv.description} | ${type} | ${cmd} |`;
  });

  return [
    "| Server | Description | Type | Command/URL |",
    "|--------|-------------|------|-------------|",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// CLI reference
// ---------------------------------------------------------------------------

interface CliCommand {
  name: string;
  description: string;
  options?: string;
}

export function renderCliReference(commands: CliCommand[]): string {
  const rows = commands.map((c) => {
    return `| \`${PROJECT_CLI} ${c.name}\` | ${c.description} | ${c.options ?? ""} |`;
  });

  return [
    "| Command | Description | Key Options |",
    "|---------|-------------|-------------|",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Config resolution order (preset-based)
// ---------------------------------------------------------------------------

export function renderLayerOrder(): string {
  const layers = [
    [
      "1",
      "**Preset**",
      "Built-in or installed presets",
      "Bundles of flags + artifacts (applied at install time)",
    ],
    [
      "2",
      "**Repo**",
      `\`${PROJECT_DIR}/\` directory`,
      "Project-level configuration (single source of truth)",
    ],
    [
      "3",
      "**User**",
      `\`~/${PROJECT_DIR}/user.yaml\``,
      "Personal preferences (never committed)",
    ],
  ];

  const rows = layers.map(
    ([n, layer, source, desc]) => `| ${n} | ${layer} | ${source} | ${desc} |`,
  );

  return [
    "| # | Layer | Source | Description |",
    "|---|-------|--------|-------------|",
    ...rows,
  ].join("\n");
}
