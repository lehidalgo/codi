import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "figma",
  description: "Figma design file access for developers",
  command: "npx",
  args: ["-y", "figma-developer-mcp"],
  env: { FIGMA_API_KEY: "${FIGMA_API_KEY}" },
};
