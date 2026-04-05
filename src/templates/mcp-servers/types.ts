/**
 * Shared types and helpers for MCP server template definitions.
 * Each server template file imports from here to ensure consistent structure.
 */

export interface McpServerTemplate {
  name: string;
  description: string;
  version: number;
  type?: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

/** Convenience type for per-file server definitions (version is injected by the registry). */
export type McpServerEntry = Omit<McpServerTemplate, "version">;

/** Stamps version: 1 onto every template in the record. */
export function withDefaultVersions<T extends Record<string, McpServerEntry>>(
  templates: T,
): Record<string, McpServerTemplate> {
  return Object.fromEntries(
    Object.entries(templates).map(([name, template]) => [name, { ...template, version: 1 }]),
  );
}
