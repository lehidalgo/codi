import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Create a structured roadmap todo list in JSON format
managed_by: ${PROJECT_NAME}
---

Create a structured roadmap/todo list as a JSON file in docs/roadmaps/.

## Instructions
- Use the template at docs/roadmap-template.json if it exists
- Save to docs/roadmaps/ directory
- Filename convention: YYYYMMDD_HHMM_roadmap_name.json
- Include clear task descriptions, priorities, and status tracking
`;
