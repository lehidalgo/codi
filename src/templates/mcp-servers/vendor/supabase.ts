import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "supabase",
  description: "Supabase database and project management",
  command: "npx",
  args: ["-y", "@supabase/mcp-server-supabase@latest"],
  env: { SUPABASE_ACCESS_TOKEN: "${SUPABASE_ACCESS_TOKEN}" },
};
