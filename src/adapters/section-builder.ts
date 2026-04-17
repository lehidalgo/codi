import type { NormalizedConfig, NormalizedSkill, McpConfig } from "../types/config.js";
import { PROJECT_NAME, PROJECT_NAME_DISPLAY, PROJECT_URL, BRAND_CATEGORY } from "../constants.js";

/** Build a project overview section from manifest metadata. */
export function buildProjectOverview(config: NormalizedConfig): string {
  const { manifest } = config;
  const lines = ["## Project Overview", ""];

  if (manifest.description) {
    lines.push(manifest.description);
    lines.push("");
  }

  lines.push(`**Project:** ${manifest.name}`);
  lines.push(`**Managed by:** [${PROJECT_NAME_DISPLAY}](${PROJECT_URL})`);

  return lines.join("\n");
}

/** Build an architecture summary showing configured artifacts. */
export function buildArchitectureSummary(config: NormalizedConfig): string {
  const lines = ["## Architecture", ""];

  if (config.rules.length > 0) {
    lines.push(`**Rules** (${config.rules.length}): ${config.rules.map((r) => r.name).join(", ")}`);
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

  return lines.join("\n");
}

/** Build an agents table with "When to Use" guidance. */
export function buildAgentsTable(config: NormalizedConfig): string | null {
  if (config.agents.length === 0) return null;

  const lines = ["## Available Agents", "", "| Agent | Purpose |", "|-------|---------|"];

  for (const agent of config.agents) {
    lines.push(`| ${agent.name} | ${agent.description} |`);
  }

  return lines.join("\n");
}

/** Build a skill routing table mapping user intents to recommended skills. */
export function buildSkillRoutingTable(config: NormalizedConfig): string | null {
  const routableSkills = config.skills.filter((s) => s.category !== BRAND_CATEGORY);
  if (routableSkills.length === 0) return null;

  const lines = ["## Skill Routing", "", "| Skill | When to use |", "|-------|-------------|"];

  for (const skill of routableSkills) {
    lines.push(buildSkillRow(skill));
  }

  return lines.join("\n");
}

function buildSkillRow(skill: NormalizedSkill): string {
  const summary = extractRoutingSummary(skill.description);
  return `| ${skill.name} | ${summary} |`;
}

function extractRoutingSummary(description: string): string {
  const sentences = description.split(/\.\s/);
  let summary = sentences[0] ?? description;
  if (sentences[1] !== undefined && (summary + ". " + sentences[1]).length <= 200) {
    summary = summary + ". " + sentences[1];
  }
  return summary.length > 200 ? summary.slice(0, 197) + "..." : summary;
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

const ENV_PLACEHOLDER = /\$\{([^}]+)\}/g;

/**
 * Collect all environment variable names referenced in MCP server configs.
 * Scans both `env` values and `headers` values for ${VAR_NAME} placeholders.
 * Returns a deduplicated, sorted list of variable names.
 */
export function collectMcpEnvVars(servers: McpConfig["servers"]): string[] {
  const vars = new Set<string>();
  for (const server of Object.values(servers)) {
    for (const value of Object.values(server.env ?? {})) {
      for (const match of value.matchAll(ENV_PLACEHOLDER)) {
        if (match[1]) vars.add(match[1]);
      }
    }
    for (const value of Object.values(server.headers ?? {})) {
      for (const match of value.matchAll(ENV_PLACEHOLDER)) {
        if (match[1]) vars.add(match[1]);
      }
    }
  }
  return [...vars].sort();
}

/**
 * Build a .env.example file listing all env vars required by the enabled MCP servers.
 * Each line is commented with the server name(s) that require it.
 */
export function buildMcpEnvExample(servers: McpConfig["servers"]): string | null {
  const varToServers = new Map<string, string[]>();
  for (const [name, server] of Object.entries(servers)) {
    const sources = [...Object.values(server.env ?? {}), ...Object.values(server.headers ?? {})];
    for (const value of sources) {
      for (const match of value.matchAll(ENV_PLACEHOLDER)) {
        if (!match[1]) continue;
        const existing = varToServers.get(match[1]) ?? [];
        existing.push(name);
        varToServers.set(match[1], existing);
      }
    }
  }
  if (varToServers.size === 0) return null;

  const lines = [
    "# MCP server environment variables",
    "# Set these values before running: codi generate",
    "# Required by the MCP servers configured in .codi/mcp-servers/",
    "",
  ];
  for (const [varName, serverNames] of [...varToServers.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`# Required by: ${serverNames.join(", ")}`);
    lines.push(`${varName}=`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Build a Project Context section from the manifest's project_context field. */
export function buildProjectContext(config: NormalizedConfig): string | null {
  const ctx = config.manifest.project_context;
  if (!ctx?.trim()) return null;
  return `## Project Context\n\n${ctx.trim()}`;
}

/** Build a Self-Development Mode warning when working on the Codi source repo. */
export function buildSelfDevWarning(config: NormalizedConfig): string | null {
  if (config.manifest.name !== PROJECT_NAME) return null;
  return [
    "## Self-Development Mode",
    "",
    "> You are working on the **Codi source code** — not a consumer project.",
    "> The source of truth for templates shipped to users is `src/templates/`, not `.codi/`.",
    "",
    "| To change | Edit | Never edit |",
    "|-----------|------|------------|",
    "| A rule template | `src/templates/rules/<name>.md` | `.claude/rules/` (generated) |",
    "| A skill template | `src/templates/skills/<name>/template.ts` | `.claude/skills/` (generated) |",
    "| An agent template | `src/templates/agents/<name>.md` | `.claude/agents/` (generated) |",
    "| This project's own rules | `.codi/rules/<name>.md` | `.claude/rules/` (generated) |",
    "",
    "Bump `version:` in template frontmatter whenever content changes.",
    "",
    "### The three-layer pipeline",
    "",
    "Codi moves content through three distinct layers. Understanding which layer",
    "a command reads from prevents the most common mistake in self-dev mode:",
    "editing `src/templates/` and wondering why `codi generate` did nothing.",
    "",
    "| Layer | Path | What lives here |",
    "|-------|------|-----------------|",
    "| 1. Source | `src/templates/` | The template shipped to consumers |",
    "| 2. Installed | `.codi/<artifact-type>/<name>/` | A project's **local copy** of an installed artifact |",
    "| 3. Generated | `.claude/` / `.cursor/` / `.codex/` / ... | Per-agent output produced from the installed copy |",
    "",
    "`pnpm build` compiles `src/templates/` into `dist/`.",
    "`codi add <artifact-type> <name> --template <name>` copies `dist/` into `.codi/`.",
    "`codi generate` reads `.codi/` and writes the per-agent directories.",
    "",
    "### When editing `src/templates/` (framework development)",
    "",
    "**`codi generate` does NOT read from `src/templates/`.** It only reads from",
    "`.codi/`. To make source edits take effect, refresh the installed copy first:",
    "",
    "```bash",
    "# 1. Edit src/templates/skills/<name>/",
    "# 2. Rebuild compiled templates",
    "pnpm build",
    "",
    "# 3. Clean the stale installed copy",
    "rm -rf .codi/skills/codi-<name>",
    "",
    "# 4. Remove the entry from the artifact manifest",
    "node -e \"const fs=require('fs'); const p='.codi/artifact-manifest.json'; const m=JSON.parse(fs.readFileSync(p,'utf8')); if(m.artifacts) delete m.artifacts['codi-<name>']; fs.writeFileSync(p, JSON.stringify(m, null, 2)+'\\n');\"",
    "",
    "# 5. Reinstall from the freshly built template",
    "codi add skill codi-<name> --template codi-<name>",
    "",
    "# 6. Regenerate per-agent output",
    "codi generate --force",
    "```",
    "",
    "The same pattern applies to rules and agents — swap `skill` for `rule` or",
    "`agent`. `codi update --skills --force` is documented as a refresh path but",
    "does not consistently overwrite `.codi/` when the installed artifact already",
    "exists; prefer the explicit clean + reinstall above for deterministic behavior.",
    "",
    "### When editing `.codi/` directly (consumer workflow)",
    "",
    "This is the flow for a regular consumer. A user edits their own `.codi/`",
    "artifacts (custom rules, `managed_by: user` overrides), then runs",
    "`codi generate` to propagate changes into the per-agent directories.",
    "`codi generate` is **only for this case** — it does not pull source edits.",
    "",
    "If you are editing `src/templates/` and only run `codi generate`, your",
    "changes will never reach `.claude/` or any other agent output. Always",
    "follow the clean + reinstall flow above when the edit is at the source",
    "layer.",
  ].join("\n");
}
