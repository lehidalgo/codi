export const template = `---
name: {{name}}
description: MCP (Model Context Protocol) server usage. Use when configuring MCP servers, calling MCP tools, or debugging MCP connections.
category: Developer Tools
compatibility: [claude-code]
managed_by: codi
---

# {{name}}

## When to Use

Use when working with MCP servers — configuring, calling tools, or debugging.

## When to Activate

- User asks to configure or set up an MCP server for their project
- User needs to call an MCP tool and wants guidance on parameters or usage
- An MCP tool call fails and the user needs help debugging the connection
- User wants to add a new MCP server to \\\`.codi/mcp.yaml\\\`
- User asks how to distribute MCP configuration across agents

## Configuration

MCP servers are defined in \\\`.codi/mcp.yaml\\\` and distributed to agents by \\\`codi generate\\\`.

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
\\\`\\\`\\\`

After editing, run \\\`codi generate\\\` to distribute to all agents.

## Using MCP Tools

### Step 1: Discover Available Tools

**[CODING AGENT]** Before calling any MCP tool:
- Check \\\`.codi/mcp.yaml\\\` for configured servers
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

## Security Considerations

- Never hardcode tokens or API keys in \\\`mcp.yaml\\\` — use \\\`\\\${VAR_NAME}\\\` syntax to reference environment variables
- Apply least-privilege: grant MCP servers access only to the resources they need
- For http servers, verify the URL uses HTTPS in production — unencrypted MCP traffic exposes tool calls and results
- Review MCP server permissions before granting access to sensitive data (databases, admin APIs)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Tool not found | Server not in mcp.yaml | Add server to \\\`.codi/mcp.yaml\\\`, run \\\`codi generate\\\` |
| Connection refused | Server not running | Start the server process or check the URL |
| Auth failed | Missing env var | Set GITHUB_TOKEN, API_KEY, etc. in environment |
| Invalid params | Wrong parameter types | Check the tool's schema for required fields and types |
| Timeout | Server too slow | Increase timeout or check server health |
`;
