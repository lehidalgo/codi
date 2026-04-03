import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "memory",
  description: "Persistent knowledge graph for entity storage",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-memory"],
};
