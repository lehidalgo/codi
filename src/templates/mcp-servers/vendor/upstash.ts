import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "upstash",
  description: "Upstash Redis, QStash, and Vector",
  command: "npx",
  args: ["-y", "@upstash/mcp-server@latest"],
  env: {
    UPSTASH_EMAIL: "${UPSTASH_EMAIL}",
    UPSTASH_API_KEY: "${UPSTASH_API_KEY}",
  },
};
