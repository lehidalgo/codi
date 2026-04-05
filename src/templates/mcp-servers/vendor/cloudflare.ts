import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "cloudflare",
  description: "Cloudflare Workers, KV, R2, and D1",
  command: "npx",
  args: ["-y", "@cloudflare/mcp-server-cloudflare"],
  env: { CF_API_TOKEN: "${CF_API_TOKEN}" },
};
