import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Full re-index of the code knowledge graph via graph-code MCP
managed_by: ${PROJECT_NAME}
version: 1
---

Perform a FULL re-index of the code knowledge graph for the current project.

## Instructions
1. Call the graph-code MCP index_repository tool with force=True for a full re-index
2. Wait for indexing to complete
3. Report results: confirmation, errors/warnings, and suggest using /codebase-explore to explore

## What This Does
- Clears all existing graph data for THIS project (other projects preserved)
- Parses the entire repository using Tree-sitter
- Extracts functions, classes, methods, and their relationships
- Builds a complete knowledge graph
- Generates embeddings for semantic search

## When to Use
- First time indexing a new repository
- After major refactoring when the graph seems corrupted
- When you want a clean slate
- If incremental updates (/update-graph) are not working correctly

## Notes
- Full indexing may take seconds to minutes depending on codebase size
- For regular updates after small changes, use /update-graph instead
- Multi-language support: Python, JavaScript, TypeScript, Rust, Java, C++, Lua, Go
`;
