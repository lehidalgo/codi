import type { NormalizedConfig, McpConfig } from "../types/config.js";
import { PROJECT_NAME_DISPLAY, PROJECT_URL } from "../constants.js";

/** Build a project overview section from manifest metadata. */
export function buildProjectOverview(config: NormalizedConfig): string {
  const { manifest } = config;
  const lines = ["## Project Overview", ""];

  if (manifest.description) {
    lines.push(manifest.description);
    lines.push("");
  }

  lines.push(`**Project:** ${manifest.name}`);
  if (manifest.team) {
    lines.push(`**Team:** ${manifest.team}`);
  }
  lines.push(`**Managed by:** [${PROJECT_NAME_DISPLAY}](${PROJECT_URL})`);

  return lines.join("\n");
}

/** Build an architecture summary showing configured artifacts. */
export function buildArchitectureSummary(config: NormalizedConfig): string {
  const lines = ["## Architecture", ""];

  if (config.rules.length > 0) {
    lines.push(
      `**Rules** (${config.rules.length}): ${config.rules.map((r) => r.name).join(", ")}`,
    );
  }
  if (config.skills.length > 0) {
    lines.push(
      `**Skills** (${config.skills.length}): ${config.skills.map((s) => s.name).join(", ")}`,
    );
  }
  if (config.agents.length > 0) {
    lines.push(
      `**Agents** (${config.agents.length}): ${config.agents.map((a) => a.name).join(", ")}`,
    );
  }
  if (config.commands.length > 0) {
    lines.push(
      `**Commands** (${config.commands.length}): ${config.commands.map((c) => c.name).join(", ")}`,
    );
  }

  return lines.join("\n");
}

/** Build a commands table for agents that support commands. */
export function buildCommandsTable(config: NormalizedConfig): string | null {
  if (config.commands.length === 0) return null;

  const lines = [
    "## Key Commands",
    "",
    "| Command | Description |",
    "|---------|-------------|",
  ];

  for (const cmd of config.commands) {
    lines.push(`| \`/${cmd.name}\` | ${cmd.description} |`);
  }

  return lines.join("\n");
}

/** Build an agents table with "When to Use" guidance. */
export function buildAgentsTable(config: NormalizedConfig): string | null {
  if (config.agents.length === 0) return null;

  const lines = [
    "## Available Agents",
    "",
    "| Agent | Purpose |",
    "|-------|---------|",
  ];

  for (const agent of config.agents) {
    lines.push(`| ${agent.name} | ${agent.description} |`);
  }

  return lines.join("\n");
}

/** Build development notes derived from flags. */
export function buildDevelopmentNotes(config: NormalizedConfig): string {
  const lines = ["## Development Notes", ""];
  const notes: string[] = [];

  const flagValue = (key: string): unknown => config.flags[key]?.value;

  if (flagValue("test_before_commit") === true) {
    notes.push("- Run tests before committing");
  }
  if (flagValue("security_scan") === true) {
    notes.push("- Security scanning is enabled");
  }
  if (flagValue("type_checking") === "strict") {
    notes.push("- Strict type checking enforced");
  }
  if (flagValue("require_pr_review") === true) {
    notes.push("- All changes require PR review");
  }
  if (flagValue("allow_force_push") === false) {
    notes.push("- Force push is not allowed");
  }
  if (flagValue("lint_on_save") === true) {
    notes.push("- Lint on save is enabled");
  }

  if (notes.length === 0) return "";
  lines.push(...notes);
  return lines.join("\n");
}

/** Build workflow guidelines for agent behavior. */
export function buildWorkflowSection(): string {
  return `## Workflow

### Before Writing Code
1. **Understand** the request — read related code and ask clarifying questions
2. **Search** the codebase for existing solutions before creating new ones
3. **Propose** the approach and wait for confirmation before executing

### Self-Evaluation Checklist
Before proceeding with any solution, verify:
- **Security**: Does this introduce vulnerabilities?
- **Performance**: Will this cause bottlenecks or latency issues?
- **Scalability**: Will this work at 10x, 100x scale?
- **Cost**: Does this optimize for resource efficiency?

### Commit Discipline
- Never commit or deploy without human approval and all errors fixed
- Break work into atomic, reviewable changes`;
}

/** Filter MCP config to only enabled servers, stripping internal fields. */
export function getEnabledMcpServers(mcp: McpConfig): McpConfig {
  const filtered: McpConfig = { servers: {} };
  for (const [name, server] of Object.entries(mcp.servers)) {
    if (server.enabled === false) continue;
    const { enabled: _, ...rest } = server;
    filtered.servers[name] = rest;
  }
  return filtered;
}
