import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "brave-search",
  description: "Web search via Brave Search API",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-brave-search"],
  env: { BRAVE_API_KEY: "${BRAVE_API_KEY}" },
};
