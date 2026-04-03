import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "filesystem",
  description: "Local filesystem read/write operations",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
};
