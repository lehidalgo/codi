import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "playwright",
  description: "Browser automation via Playwright",
  command: "npx",
  args: ["-y", "@playwright/mcp@latest"],
};
