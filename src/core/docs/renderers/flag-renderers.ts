/**
 * Flag-related documentation renderers.
 */
import type { FlagSpec } from "../../../types/flags.js";

// ---------------------------------------------------------------------------
// Flags table
// ---------------------------------------------------------------------------

export function renderFlagsTable(catalog: Record<string, FlagSpec>): string {
  const rows = Object.entries(catalog).map(([name, spec]) => {
    const type = spec.type;
    const def = formatDefault(spec);
    const hook = spec.hook ?? "—";
    return `| \`${name}\` | ${type} | ${def} | ${hook} | ${spec.description} |`;
  });

  return [
    "| Flag | Type | Default | Hook | Description |",
    "|------|------|---------|------|-------------|",
    ...rows,
  ].join("\n");
}

function formatDefault(spec: FlagSpec): string {
  const val = spec.default;
  if (Array.isArray(val)) {
    return val.length === 0 ? "``" : `\`${JSON.stringify(val)}\``;
  }
  if (spec.type === "enum" && spec.values) {
    return `\`${String(val)}\``;
  }
  return `\`${String(val)}\``;
}

// ---------------------------------------------------------------------------
// Flag modes (static — 6 modes)
// ---------------------------------------------------------------------------

export function renderFlagModes(): string {
  const modes = [
    ["`enforced`", "Always active, non-negotiable", "No (stops resolution)"],
    ["`enabled`", "Active with specified value", "Yes"],
    ["`disabled`", "Explicitly turned off", "Yes"],
    ["`inherited`", "Skip — use parent layer's value", "Yes"],
    ["`delegated_to_agent_default`", "Use the flag's catalog default", "Yes"],
    ["`conditional`", "Apply only if conditions match", "Yes"],
  ];

  return [
    "| Mode | Behavior | Can Override? |",
    "|------|----------|---------------|",
    ...modes.map(([m, b, o]) => `| ${m} | ${b} | ${o} |`),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Flag-to-instruction mapping
// ---------------------------------------------------------------------------

export function renderFlagInstructions(): string {
  const mapping = [
    ["allow_shell_commands", "false", "Do NOT execute shell commands."],
    ["allow_file_deletion", "false", "Do NOT delete files."],
    [
      "max_file_lines",
      "N",
      "Keep source code files under N lines. Documentation files have no line limit.",
    ],
    ["require_tests", "true", "Write tests for all new code."],
    [
      "allow_force_push",
      "false",
      "Do NOT use force push (--force) on git operations.",
    ],
    [
      "require_pr_review",
      "true",
      "All changes require pull request review before merging.",
    ],
    ["mcp_allowed_servers", "[...]", "Only use these MCP servers: {list}."],
    [
      "require_documentation",
      "true",
      "Write documentation for all new code and APIs.",
    ],
    ["allowed_languages", "[...]", "Only use these languages: {list}."],
    ["max_context_tokens", "N", "Maximum context window: N tokens."],
  ];

  const rows = mapping.map(
    ([flag, trigger, instruction]) =>
      `| \`${flag}\` | \`${trigger}\` | ${instruction} |`,
  );

  return [
    "| Flag | Trigger Value | Generated Instruction |",
    "|------|--------------|----------------------|",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Flag-to-hook mapping
// ---------------------------------------------------------------------------

export function renderFlagHooks(catalog: Record<string, FlagSpec>): string {
  const rows = Object.entries(catalog)
    .filter(([, spec]) => spec.hook)
    .map(
      ([name, spec]) => `| \`${name}\` | ${spec.hook} | ${spec.description} |`,
    );

  return [
    "| Flag | Hook | Description |",
    "|------|------|-------------|",
    ...rows,
  ].join("\n");
}
