import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "github",
  description: "GitHub repository operations (issues, PRs, repos)",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-github"],
  env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" },
};
