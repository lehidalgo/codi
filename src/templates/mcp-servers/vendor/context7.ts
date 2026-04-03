import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "context7",
  description: "Up-to-date library docs for LLMs",
  command: "npx",
  args: ["-y", "@upstash/context7-mcp"],
};
