# Building a Custom MCP Server

Use this guide when the user needs to code a new MCP server from scratch (not just configure an existing one).

## Phase 1 — Research and Plan

1. **Study the MCP protocol**: Start with `https://modelcontextprotocol.io/sitemap.xml`, then fetch specific pages with `.md` suffix for markdown format.
2. **Load SDK docs**: TypeScript SDK from `https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md`, Python SDK from `https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md`.
3. **Understand the target API**: Review the service's API docs, identify key endpoints, auth requirements, and data models.
4. **Plan tool selection**: Prioritize comprehensive API coverage. List endpoints to implement, starting with the most common operations.

**Design decisions:**
- **API Coverage vs. Workflow Tools**: Balance comprehensive endpoint coverage with specialized workflow tools. When uncertain, prioritize comprehensive API coverage.
- **Tool Naming**: Use consistent prefixes and action-oriented naming (e.g., `github_create_issue`, `github_list_repos`).
- **Context Management**: Design tools that return focused, relevant data with pagination support.
- **Actionable Errors**: Error messages should guide agents toward solutions with specific suggestions.

## Phase 2 — Implement

**Recommended stack:** TypeScript with `@modelcontextprotocol/sdk`, Streamable HTTP transport for remote, stdio for local.

Scaffold with:
```bash
npx @modelcontextprotocol/create-server my-server
```

For each tool, define:
- **Input Schema**: Use Zod (TypeScript) or Pydantic (Python) with constraints and descriptions
- **Output Schema**: Define `outputSchema` where possible for structured data
- **Tool Annotations**: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`

Example server skeleton:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

server.tool("my-tool", { param: z.string() }, async ({ param }) => ({
  content: [{ type: "text", text: result }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Phase 3 — Review and Test

1. Run build to verify compilation
2. Test with MCP Inspector: `npx @modelcontextprotocol/inspector`
3. Review for: no duplicated code, consistent error handling, full type coverage, clear tool descriptions

## Phase 4 — Create Evaluations

Create 10 evaluation questions that test whether LLMs can effectively use your MCP server:
- Each question must be independent, read-only, complex (requiring multiple tool calls), and verifiable
- Output as XML:
```xml
<evaluation>
  <qa_pair>
    <question>...</question>
    <answer>...</answer>
  </qa_pair>
</evaluation>
```

## Register as Community Template

Run `codi contribute` to share as a community template once the server is stable.
