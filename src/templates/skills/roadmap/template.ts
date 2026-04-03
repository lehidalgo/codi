import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Create a structured roadmap todo list as a JSON file in docs/roadmaps/.
category: Planning
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
intentHints:
  taskType: Roadmap Creation
  examples:
    - "Create a roadmap"
    - "Make a todo list for this feature"
    - "Plan out the next steps"
    - "Generate a project roadmap"
version: 1
---

# {{name}}

## When to Activate

- User wants to create a structured task list or roadmap for a feature or project
- User asks to plan out next steps in a persistent format
- User needs a trackable task list saved to the repository

## Workflow

### Step 1: Gather Requirements

**[CODING AGENT]** Understand the scope:
- What feature, epic, or project is being planned?
- What is the target completion or priority?
- Are there dependencies or blockers to capture?

### Step 2: Structure the Roadmap

**[CODING AGENT]** Organize tasks with:
- Clear task descriptions
- Priority levels (high / medium / low)
- Status tracking (pending / in-progress / done)
- Dependencies between tasks where relevant

### Step 3: Save to File

**[SYSTEM]** Save the roadmap:
- Use the template at \`docs/roadmap-template.json\` if it exists
- Save to \`docs/roadmaps/\` directory
- Filename convention: \`YYYYMMDD_HHMM_roadmap_name.json\`
`;
