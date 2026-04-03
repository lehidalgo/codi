import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Use when the user needs to write internal communications such as status reports, 3P updates, leadership updates, newsletters, FAQs, or incident reports.
category: Developer Tools
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
intentHints:
  taskType: Internal Communications
  examples:
    - "Write a status report"
    - "Draft a team update"
    - "Write a company newsletter"
version: 1
---

## When to Activate

- User needs to write a status report, 3P update, or leadership update
- User asks to draft a team newsletter, FAQ response, or incident report
- User needs any structured internal communication document

## How to use this skill

To write any internal communication:

1. **Identify the communication type** from the request
2. **Load the appropriate guideline file** from the \\\`examples/\\\` directory:
    - \\\`examples/3p-updates.md\\\` - For Progress/Plans/Problems team updates
    - \\\`examples/company-newsletter.md\\\` - For company-wide newsletters
    - \\\`examples/faq-answers.md\\\` - For answering frequently asked questions
    - \\\`examples/general-comms.md\\\` - For anything else that doesn't explicitly match one of the above
3. **Follow the specific instructions** in that file for formatting, tone, and content gathering

If the communication type doesn't match any existing guideline, ask for clarification or more context about the desired format.
`;
