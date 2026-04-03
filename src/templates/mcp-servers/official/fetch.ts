import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "fetch",
  description: "Web content fetching and conversion",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-fetch"],
};
