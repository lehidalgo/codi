import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "exa",
  description: "AI-native web search via Exa",
  command: "npx",
  args: ["-y", "exa-mcp-server"],
  env: { EXA_API_KEY: "${EXA_API_KEY}" },
};
