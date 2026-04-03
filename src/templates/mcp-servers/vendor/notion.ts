import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "notion",
  description: "Notion workspace pages and databases",
  command: "npx",
  args: ["-y", "@notionhq/notion-mcp-server"],
  env: { OPENAPI_MCP_HEADERS: "${OPENAPI_MCP_HEADERS}" },
};
