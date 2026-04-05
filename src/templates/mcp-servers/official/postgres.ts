import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "postgres",
  description: "PostgreSQL database queries and schema inspection",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-postgres"],
  env: { POSTGRES_CONNECTION_STRING: "${POSTGRES_CONNECTION_STRING}" },
};
