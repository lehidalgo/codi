import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "firecrawl",
  description: "Web scraping, crawling, and extraction",
  command: "npx",
  args: ["-y", "firecrawl-mcp"],
  env: { FIRECRAWL_API_KEY: "${FIRECRAWL_API_KEY}" },
};
