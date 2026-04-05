import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "neon",
  description: "Neon serverless Postgres management",
  command: "npx",
  args: ["-y", "@neondatabase/mcp-server-neon"],
  env: { NEON_API_KEY: "${NEON_API_KEY}" },
};
