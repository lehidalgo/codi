import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "anthropic-docs",
  description: "Anthropic documentation — Claude API, Claude Code, models, and SDKs",
  command: "npx",
  args: ["-y", "@anthropic-ai/mcp-docs-server"],
};
