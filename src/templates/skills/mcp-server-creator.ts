import {
  MAX_NAME_LENGTH,
} from '../../constants.js';

export const template = `---
name: {{name}}
description: |
  MCP server creation workflow. Use when the user asks to create, configure, or add
  an MCP server. Also activate when the user wants to connect an external tool,
  database, or API as an MCP server for their AI coding agents.
managed_by: codi
---

# MCP Server Creator

## When to Activate

- User asks to create or add a new MCP server
- User wants to connect an external tool or API as an MCP server
- User asks about MCP server configuration or YAML format
- User mentions Model Context Protocol servers or tool integrations
- User wants to make an existing service available to AI agents

## The 6-Step Lifecycle

### Step 1 — Capture Intent

**[CODING AGENT]** Interview the user:

1. **What does this MCP server do?** — Get a clear one-sentence purpose. Example: "Provides access to our internal Jira API."
2. **Transport type?** — \\\`stdio\\\` for local commands (npx, node), \\\`http\\\` for remote endpoints.
3. **What capabilities does it expose?** — Tools (actions), Resources (data), Prompts (templates) — at least one.
4. **Does it need environment variables?** — API keys, tokens, connection strings.

Do NOT proceed until questions 1-2 have clear answers.

### Step 2 — Scaffold

**[CODING AGENT]** Create the server config:

\\\`\\\`\\\`bash
codi add mcp-server <name>
\\\`\\\`\\\`

This creates \\\`.codi/mcp-servers/<name>.yaml\\\` with a blank skeleton.

The name must be:
- kebab-case (lowercase letters, digits, hyphens)
- Max ${MAX_NAME_LENGTH} characters
- Descriptive of the server's purpose

### Step 3 — Write Configuration

**[CODING AGENT]** Fill in the YAML fields based on transport type:

**For stdio servers** (local processes):
\\\`\\\`\\\`yaml
name: my-server
managed_by: user
command: npx
args:
  - "-y"
  - "@scope/mcp-server-name"
env:
  API_KEY: "\\\${API_KEY}"
\\\`\\\`\\\`

**For http servers** (remote endpoints):
\\\`\\\`\\\`yaml
name: my-server
managed_by: user
type: http
url: http://localhost:3001/mcp
headers:
  Authorization: "Bearer \\\${AUTH_TOKEN}"
\\\`\\\`\\\`

**Configuration rules:**
- Use \\\`\\\${VAR_NAME}\\\` syntax for secrets — never hardcode tokens or keys
- stdio: \\\`command\\\` + \\\`args\\\` are required
- http: \\\`url\\\` is required
- \\\`env\\\` maps variable names to template strings

### Step 4 — Validate

**[CODING AGENT]** Verify the configuration:

1. Run \\\`codi validate\\\` — confirms no config errors
2. Check name uniqueness in \\\`mcp-servers/\\\`
3. Verify required fields:
   - stdio: \\\`command\\\` must not be empty
   - http: \\\`url\\\` must be a valid URL
4. Confirm all required env vars are documented

### Step 5 — Test

**[CODING AGENT]** Verify the server works:

1. Run \\\`codi generate\\\` — produces agent-specific configs (\\\`.claude/mcp.json\\\`, etc.)
2. For stdio servers: verify the command runs (\\\`npx -y <package> --help\\\`)
3. For http servers: verify the URL is reachable
4. Use the MCP Inspector for interactive testing:
   \\\`\\\`\\\`bash
   npx @modelcontextprotocol/inspector
   \\\`\\\`\\\`

### Step 6 — Register (Optional)

If building a standalone MCP server as a package:

1. Scaffold with \\\`npx @modelcontextprotocol/create-server my-server\\\`
2. Use \\\`@modelcontextprotocol/sdk\\\` for the implementation:
   \\\`\\\`\\\`typescript
   import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
   import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

   const server = new McpServer({ name: "my-server", version: "1.0.0" });
   server.tool("my-tool", { param: z.string() }, async ({ param }) => ({
     content: [{ type: "text", text: result }],
   }));
   const transport = new StdioServerTransport();
   await server.connect(transport);
   \\\`\\\`\\\`
3. Run \\\`codi contribute\\\` to share as a community template

## Quality Checklist

Before finishing, verify:
- [ ] Name is kebab-case and descriptive
- [ ] Description clearly states what the server provides
- [ ] All required env vars use \\\$\\{VAR_NAME\\} syntax (no hardcoded secrets)
- [ ] Transport type matches use case (stdio for local, http for remote)
- [ ] \\\`codi validate\\\` passes
- [ ] \\\`codi generate\\\` produces correct agent configs

## Common Patterns

| Use Case | Config |
|----------|--------|
| GitHub operations | \\\`npx -y @modelcontextprotocol/server-github\\\` |
| Database queries | \\\`npx -y @modelcontextprotocol/server-postgres\\\` |
| Local filesystem | \\\`npx -y @modelcontextprotocol/server-filesystem /path\\\` |
| Knowledge graph | \\\`npx -y @modelcontextprotocol/server-memory\\\` |
| Custom Node.js | \\\`node ./path/to/server.mjs\\\` |
| Remote HTTP | \\\`url: http://localhost:3001/mcp\\\` |

## Reference

- SDK: \\\`@modelcontextprotocol/sdk\\\` (v1.28.0+)
- Scaffolder: \\\`npx @modelcontextprotocol/create-server\\\`
- Inspector: \\\`npx @modelcontextprotocol/inspector\\\`
- Transports: StdioServerTransport (local), Streamable HTTP (remote)
- Capabilities: Tools (actions), Resources (data), Prompts (templates)
`;
