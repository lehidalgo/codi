import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "neon-cloud",
  description: "Neon serverless Postgres management via cloud API (HTTP)",
  type: "http",
  url: "https://mcp.neon.tech/mcp",
  headers: { Authorization: "Bearer ${NEON_API_KEY}" },
};
