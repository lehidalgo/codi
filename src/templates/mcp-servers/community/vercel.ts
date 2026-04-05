import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "vercel",
  description: "Vercel projects and deployments",
  command: "npx",
  args: ["-y", "vercel-mcp"],
  env: { VERCEL_API_KEY: "${VERCEL_API_KEY}" },
};
