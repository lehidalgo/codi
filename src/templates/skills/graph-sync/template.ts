import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Synchronize the code knowledge graph. Use when the graph is stale, files have changed significantly, or queries return outdated results. Choose full re-index for major changes or incremental update for recent edits.
category: Developer Tools
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}}

## When to Activate

- User asks to index or re-index the repository
- User wants to refresh the code graph after changes
- User mentions the graph feels stale or incorrect

## Sync Modes

### Incremental Update (default)

**[SYSTEM]** Call the graph-code MCP \`index_repository\` tool **without** the \`force\` flag.

- Detects file changes using git status and git diff
- Only processes added, modified, or deleted files
- Preserves unchanged nodes and their embeddings
- Updates embeddings only for changed functions
- Cleans up orphaned relationships

**When to use:** After making code changes during normal development. Much faster than a full re-index.

**Report:** Files updated/added/deleted, or confirm no changes were detected.

### Full Re-index

**[SYSTEM]** Call the graph-code MCP \`index_repository\` tool with \`force=True\`.

- Clears all existing graph data for this project (other projects are preserved)
- Parses the entire repository using Tree-sitter
- Extracts functions, classes, methods, and their relationships
- Builds a complete knowledge graph
- Generates embeddings for semantic search

**When to use:**
- First time indexing a new repository
- After major refactoring when the graph seems corrupted
- When incremental updates are not working correctly
- When you want a clean slate

**Note:** Full indexing may take seconds to minutes depending on codebase size.

## After Sync

**[CODING AGENT]** Report the outcome (confirmation, errors/warnings) and suggest using the codebase-explore skill to explore the updated graph.

## Supported Languages

Python, JavaScript, TypeScript, Rust, Java, C++, Lua, Go
`;
