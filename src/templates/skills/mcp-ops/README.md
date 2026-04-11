# codi-mcp-ops

Sets up, calls, debugs, and builds MCP (Model Context Protocol) servers. Manages server configuration in `.codi/mcp.yaml` and distributes it to all supported coding agents via `codi generate`.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| codi CLI | `npm install -g codi` | read/write `mcp.yaml`, run `codi generate` |
| Node.js 18+ | required for stdio servers | most MCP servers run as Node.js processes |
| Python 3.9+ | optional | Python-based MCP servers |
| Go / Rust | optional | language-specific MCP server runtimes |

## Configuration File

MCP servers are declared in `.codi/mcp.yaml` and applied to all agents after running `codi generate`.

```yaml
# .codi/mcp.yaml
servers:
  github:
    command: npx
    args: ["-y", "@anthropic-ai/mcp-server-github"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"

  docs-api:
    type: http
    url: "https://example.com/mcp"
    headers:
      Authorization: "Bearer ${AUTH_TOKEN}"
```

## Server Types

| Type | When to use |
|------|------------|
| `stdio` | Local process (default) — Node.js, Python, Go executables |
| `http` | Remote service — REST or WebSocket MCP endpoint |

## Common Operations

```bash
# Apply MCP config to all agents
codi generate

# Test a local MCP server manually
npx @modelcontextprotocol/inspector stdio -- npx -y <server-package>

# Validate mcp.yaml syntax
codi validate
```

## Building a New MCP Server

See `references/` for language-specific server scaffolds:

| File | Content |
|------|---------|
| `references/server-node.md` | Node.js MCP server template |
| `references/server-python.md` | Python MCP server template |

A minimal Node.js MCP server requires `@modelcontextprotocol/sdk` and exposes tools via the `ListTools` and `CallTool` handlers.
