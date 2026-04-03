import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "sequential-thinking",
  description: "Step-by-step reasoning for complex problems",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
};
