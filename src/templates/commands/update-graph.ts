import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Incremental update of the code knowledge graph for changed files
managed_by: ${PROJECT_NAME}
---

Incrementally update the code knowledge graph, processing only files that changed since the last index.

## Instructions
1. Call the graph-code MCP index_repository tool (without force) for an incremental update
2. Wait for the update to complete
3. Report: files updated/added/deleted, or that no changes were detected
4. Suggest using /codebase-explore to explore the updated code

## How It Works
- Detects file changes using git status and git diff
- Only processes added, modified, or deleted files
- Preserves unchanged nodes and their embeddings
- Updates embeddings only for changed functions
- Cleans up orphaned relationships

## When to Use
- After making code changes (daily workflow)
- Before doing codebase exploration
- Regularly during development sessions

## Notes
- First run on a new project automatically does a full index
- Much faster than full re-index for small changes
- If updates seem broken, use /index-graph for a full re-index
`;
