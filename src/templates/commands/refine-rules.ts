import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Review rule feedback and propose improvements
managed_by: ${PROJECT_NAME}
---

Use the refine-rules skill to review collected rule feedback and propose improvements.
Read observations from the feedback directory, group by rule, show evidence, and propose
changes one at a time. Only apply changes with explicit user approval.
`;
