import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "linear",
  description: "Linear issue tracking and project management",
  command: "npx",
  args: ["-y", "linear-mcp"],
  env: { LINEAR_API_KEY: "${LINEAR_API_KEY}" },
};
