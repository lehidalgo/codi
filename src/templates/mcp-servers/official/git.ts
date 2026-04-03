import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "git",
  description: "Git repository read, search, and history",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-git"],
};
