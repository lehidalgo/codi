import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "chrome-devtools",
  description: "Chrome DevTools for browser inspection, network, and debugging",
  command: "npx",
  args: ["-y", "chrome-devtools-mcp@latest"],
};
