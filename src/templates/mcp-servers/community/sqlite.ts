import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "sqlite",
  description: "SQLite database operations",
  command: "npx",
  args: ["-y", "@pollinations/mcp-server-sqlite"],
};
