import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "kubernetes",
  description: "Kubernetes cluster management",
  command: "npx",
  args: ["-y", "mcp-server-kubernetes"],
};
