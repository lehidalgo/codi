import { z } from "zod";

const McpServerSchema = z.object({
  type: z
    .enum(["stdio", "http"])
    .optional()
    .describe("Transport type: 'stdio' launches a local process; 'http' connects to a remote URL."),
  command: z
    .string()
    .optional()
    .describe("Command to execute for stdio servers (e.g. 'npx', 'node')."),
  args: z
    .array(z.string())
    .optional()
    .describe("Arguments passed to the command for stdio servers."),
  env: z
    .record(z.string(), z.string())
    .optional()
    .describe("Environment variables injected into the server process for stdio servers."),
  url: z.string().optional().describe("HTTP endpoint URL for http servers."),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe("HTTP headers sent with each request to an http server."),
  enabled: z
    .boolean()
    .optional()
    .describe("When false, this server is excluded from generation. Defaults to true."),
});

/**
 * Validates the contents of `.codi/mcp.yaml`.
 *
 * Defines MCP (Model Context Protocol) servers available to agents in this project.
 * Server names defined here can be referenced in agent frontmatter via `mcpServers`.
 */
export const McpConfigSchema = z.object({
  servers: z
    .record(z.string(), McpServerSchema)
    .default({})
    .describe(
      "Map of server name to server configuration. Keys are referenced in agent frontmatter mcpServers fields.",
    ),
});

export type McpConfigInput = z.input<typeof McpConfigSchema>;
export type McpConfigOutput = z.output<typeof McpConfigSchema>;
