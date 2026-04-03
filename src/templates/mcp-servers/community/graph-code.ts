import type { McpServerEntry } from "../types.js";

export const server: McpServerEntry = {
  name: "graph-code",
  description: "Code knowledge graph for codebase structure, call graphs, and dependency analysis",
  command: "uv",
  args: ["run", "--directory", "${GRAPH_CODE_DIR}", "graph-code", "mcp-server"],
  env: {
    MEMGRAPH_HOST: "${MEMGRAPH_HOST}",
    MEMGRAPH_PORT: "${MEMGRAPH_PORT}",
    CYPHER_PROVIDER: "${CYPHER_PROVIDER}",
    CYPHER_MODEL: "${CYPHER_MODEL}",
    CYPHER_API_KEY: "${CYPHER_API_KEY}",
  },
};
