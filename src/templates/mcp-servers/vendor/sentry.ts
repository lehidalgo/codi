import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "sentry",
  description: "Sentry error monitoring and debugging",
  command: "npx",
  args: ["-y", "@sentry/mcp-server@latest"],
  env: { SENTRY_ACCESS_TOKEN: "${SENTRY_ACCESS_TOKEN}" },
};
