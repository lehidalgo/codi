/**
 * Preset-related documentation renderers.
 */
import type { FlagSpec } from "../../../types/flags.js";
import type { BuiltinPresetDefinition } from "../../../templates/presets/types.js";

// ---------------------------------------------------------------------------
// Preset table
// ---------------------------------------------------------------------------

export function renderPresetTable(
  presets: Record<string, BuiltinPresetDefinition>,
): string {
  const rows = Object.entries(presets).map(([key, p]) => {
    const tags = p.tags.length > 0 ? p.tags[0] : "General";
    return `| \`${key}\` | ${tags} | ${p.description} |`;
  });

  return [
    "| Preset | Focus | Description |",
    "|:-------|:------|:------------|",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Preset flag comparison (core presets only)
// ---------------------------------------------------------------------------

export function renderPresetFlagComparison(
  presets: Record<string, BuiltinPresetDefinition>,
  flagCatalog: Record<string, FlagSpec>,
): string {
  const coreNames = ["minimal", "balanced", "strict"];
  const core = coreNames
    .filter((n): n is string => n in presets)
    .map((n) => ({ name: n, def: presets[n]! }));

  if (core.length === 0) return "";

  const header = `| Flag | ${core.map((c) => c.name.charAt(0).toUpperCase() + c.name.slice(1)).join(" | ")} |`;
  const sep = `|------|${core.map(() => "--------").join("|")}|`;

  const flagNames = Object.keys(flagCatalog);
  const rows = flagNames.map((flag) => {
    const flagSpec = flagCatalog[flag];
    if (!flagSpec)
      return `| \`${flag}\` | ${core.map(() => "—").join(" | ")} |`;
    const cells = core.map((c) => {
      const fd = c.def.flags[flag];
      if (!fd) return `\`${String(flagSpec.default)}\``;
      const val = `\`${String(fd.value ?? flagSpec.default)}\``;
      const suffix =
        fd.mode === "enforced" && fd.locked ? " (enforced, locked)" : "";
      return val + suffix;
    });
    return `| \`${flag}\` | ${cells.join(" | ")} |`;
  });

  return [header, sep, ...rows].join("\n");
}
