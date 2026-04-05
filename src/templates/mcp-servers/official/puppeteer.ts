import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "puppeteer",
  description: "Browser automation and web scraping",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-puppeteer"],
};
