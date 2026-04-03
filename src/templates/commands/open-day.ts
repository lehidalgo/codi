import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Review prior work from the daily control log to resume context
managed_by: ${PROJECT_NAME}
version: 1
---

Read docs/CONTROL.json to get up to date on what was being worked on.

## Instructions
- Read only the latest 5 entries — do NOT read the entire file
- Iteratively read more entries only if needed for additional context
- Summarize the current state and what was last being worked on
- Identify any pending tasks or blockers from previous sessions
`;
