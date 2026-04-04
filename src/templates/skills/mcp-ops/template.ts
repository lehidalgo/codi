import { MAX_NAME_LENGTH, PROJECT_CLI, PROJECT_DIR, PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: "MCP (Model Context Protocol) operations. Use when setting up, calling, debugging, or building MCP servers. Also activate when the user mentions mcp.yaml, MCP tools, Model Context Protocol, or connecting external APIs to Claude agents."
category: Developer Tools
compatibility: [claude-code]
managed_by: ${PROJECT_NAME}
version: 1
---

# {{name}}

## When to Activate

- User asks to configure, add, or set up an MCP server
- User needs to call an MCP tool and wants guidance on parameters or usage
- An MCP tool call fails and the user needs help debugging the connection
- User wants to add a new MCP server to \\\`${PROJECT_DIR}/mcp.yaml\\\`
- User asks how to distribute MCP configuration across agents
- User asks to create or build a new MCP server from scratch
- User wants to connect an external tool, database, or API as an MCP server
- User mentions Model Context Protocol servers or tool integrations

## Configuration

MCP servers are defined in \\\`${PROJECT_DIR}/mcp.yaml\\\` and distributed to agents by \\\`${PROJECT_CLI} generate\\\`.

### Server Types

**stdio** — local process:
\\\`\\\`\\\`yaml
servers:
  github:
    command: npx
    args: ["-y", "@anthropic-ai/mcp-server-github"]
    env:
      GITHUB_TOKEN: "\${GITHUB_TOKEN}"
\\\`\\\`\\\`

**http** — remote service:
\\\`\\\`\\\`yaml
servers:
  docs-api:
    type: http
    url: "https://example.com/mcp"
    headers:
      Authorization: "Bearer \${AUTH_TOKEN}"
\\\`\\\`\\\`

**Configuration rules:**
- Use \\\`\${VAR_NAME}\\\` syntax for secrets — never hardcode tokens or keys
- stdio: \\\`command\\\` + \\\`args\\\` are required
- http: \\\`url\\\` is required
- \\\`env\\\` maps variable names to template strings

After editing, run \\\`${PROJECT_CLI} generate\\\` to distribute to all agents.

## Using MCP Tools

### Step 1: Discover Available Tools

**[CODING AGENT]** Before calling any MCP tool:
- Check \\\`${PROJECT_DIR}/mcp.yaml\\\` for configured servers
- List available tools from each server
- Read tool descriptions and parameter schemas

### Step 2: Validate Before Calling

**[CODING AGENT]** Before each tool call:
- Verify all required parameters are provided
- Check parameter types match the schema
- Ensure the server is configured for the current agent

### Step 3: Handle Errors

**[CODING AGENT]** When a tool call fails:
- Log the error message and parameters used
- Check if the server is running and reachable
- Verify environment variables are set (tokens, API keys)
- Try a simpler call to isolate the issue

## Creating Server Configs

### Step 1 — Capture Intent

**[CODING AGENT]** Interview the user:

1. **What does this MCP server do?** — Get a clear one-sentence purpose.
2. **Transport type?** — \\\`stdio\\\` for local commands (npx, node), \\\`http\\\` for remote endpoints.
3. **What capabilities does it expose?** — Tools (actions), Resources (data), Prompts (templates) — at least one.
4. **Does it need environment variables?** — API keys, tokens, connection strings.

Do NOT proceed until questions 1-2 have clear answers.

### Step 2 — Scaffold

**[CODING AGENT]** Create the server config:

\\\`\\\`\\\`bash
${PROJECT_CLI} add mcp-server <name>
\\\`\\\`\\\`

This creates \\\`${PROJECT_DIR}/mcp-servers/<name>.yaml\\\` with a blank skeleton.

The name must be:
- kebab-case (lowercase letters, digits, hyphens)
- Max ${MAX_NAME_LENGTH} characters
- Descriptive of the server's purpose

### Step 3 — Validate

**[CODING AGENT]** Verify the configuration:

1. Run \\\`${PROJECT_CLI} validate\\\` — confirms no config errors
2. Check name uniqueness in \\\`${PROJECT_DIR}/mcp-servers/\\\`
3. Verify required fields:
   - stdio: \\\`command\\\` must not be empty
   - http: \\\`url\\\` must be a valid URL
4. Confirm all required env vars are documented

### Step 4 — Test

**[CODING AGENT]** Verify the server works:

1. Run \\\`${PROJECT_CLI} generate\\\` — produces agent-specific configs (\\\`.claude/mcp.json\\\`, etc.)
2. For stdio servers: verify the command runs (\\\`npx -y <package> --help\\\`)
3. For http servers: verify the URL is reachable
4. Use the MCP Inspector for interactive testing:
   \\\`\\\`\\\`bash
   npx @modelcontextprotocol/inspector
   \\\`\\\`\\\`

## Building Custom MCP Servers

When the user needs to build a server from scratch (not just configure an existing one), read the full guide at \\\`references/building-custom-servers.md\\\` in this skill's directory.

Key phases:
1. **Research and Plan** — Study the MCP protocol, load SDK docs, plan tool selection
2. **Implement** — Use \\\`@modelcontextprotocol/sdk\\\` with Zod schemas and tool annotations
3. **Review and Test** — Build, test with MCP Inspector, review quality
4. **Create Evaluations** — Write 10 eval questions to test LLM usage of the server

## Security

- Never hardcode tokens or API keys in \\\`mcp.yaml\\\` — use \\\`\${VAR_NAME}\\\` syntax to reference environment variables
- Apply least-privilege: grant MCP servers access only to the resources they need
- For http servers, verify the URL uses HTTPS in production — unencrypted MCP traffic exposes tool calls and results
- Review MCP server permissions before granting access to sensitive data (databases, admin APIs)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Tool not found | Server not in mcp.yaml | Add server to \\\`${PROJECT_DIR}/mcp.yaml\\\`, run \\\`${PROJECT_CLI} generate\\\` |
| Connection refused | Server not running | Start the server process or check the URL |
| Auth failed | Missing env var | Set GITHUB_TOKEN, API_KEY, etc. in environment |
| Invalid params | Wrong parameter types | Check the tool's schema for required fields and types |
| Timeout | Server too slow | Increase timeout or check server health |

## Quality Checklist

Before finishing, verify:
- [ ] Name is kebab-case and descriptive
- [ ] Description clearly states what the server provides
- [ ] All required env vars use \\\$\\{VAR_NAME\\} syntax (no hardcoded secrets)
- [ ] Transport type matches use case (stdio for local, http for remote)
- [ ] \\\`${PROJECT_CLI} validate\\\` passes
- [ ] \\\`${PROJECT_CLI} generate\\\` produces correct agent configs

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

## Available Agents

For API design review of MCP server interfaces, delegate to these agents (see \\\`agents/\\\` directory):
- **${PROJECT_NAME}-api-designer** — Review tool naming, parameters, and error handling
`;
