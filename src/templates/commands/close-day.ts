export const template = `---
name: {{name}}
description: Log daily work summary to the control file
managed_by: codi
---

Update docs/CONTROL.json with a summary of the day's work.

## Instructions
- Add a new entry at the BEGINNING of the file (latest entry on top)
- Be concise and summarized — maximum 300 characters
- Include details about roadmap progress or considerations
- Reference any relevant files, PRs, or decisions made
`;
