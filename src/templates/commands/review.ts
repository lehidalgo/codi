import { PROJECT_NAME } from "../../constants.js";

export const template = `---
name: {{name}}
description: Review recent code changes for quality and security
managed_by: ${PROJECT_NAME}
---

Review the most recent changes in the codebase:

1. Run \`git diff --staged\` and \`git diff\` to see all changes
2. Read surrounding code for context — do not review in isolation
3. Check for:
   - **CRITICAL**: Hardcoded secrets, SQL injection, XSS, auth bypasses
   - **HIGH**: Missing error handling, dead code, console.log, missing tests
   - **MEDIUM**: N+1 queries, missing timeouts, accessibility issues
   - **LOW**: TODOs without references, poor naming, magic numbers
4. Only report findings with >80% confidence
5. End with a severity summary table and verdict: Approve / Warning / Block
`;
