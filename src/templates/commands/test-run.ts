import { PROJECT_NAME } from "../../constants.js";

export const template = `---
name: {{name}}
description: Run the project test suite and report results
managed_by: ${PROJECT_NAME}
---

Run the project's test suite:

1. Detect the test runner (npm test, pytest, go test, cargo test, dotnet test)
2. Execute the full test suite
3. Report results: total passed, failed, skipped
4. For each failure:
   - Show the test name, file, and error message
   - Distinguish pre-existing failures from new ones (check \`git stash\` + re-run if needed)
   - Suggest a specific fix
5. If all pass, confirm with a one-line summary
`;
