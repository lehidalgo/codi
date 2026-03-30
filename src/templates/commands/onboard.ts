import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Analyze and onboard to a codebase
managed_by: ${PROJECT_NAME}
---

Use the codebase-onboarding skill to analyze this project.
Walk through the codebase systematically: framework detection, architecture mapping, convention detection.
Produce a concise onboarding guide (<100 lines) covering setup, architecture, and key files.
`;
