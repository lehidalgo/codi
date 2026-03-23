export const template = `---
name: {{name}}
description: Guidelines for using MCP server tools. Use when interacting with MCP servers, calling MCP tools, or debugging MCP connections
type: skill
compatibility: [claude-code]
tools: []
---

# {{name}}

## When to Use

Use this skill when interacting with MCP servers.

## Instructions

- Check available MCP tools before starting
- Validate tool parameters before calling
- Handle MCP connection errors gracefully
- Log tool results for debugging`;
