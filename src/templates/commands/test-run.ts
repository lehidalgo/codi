export const template = `---
name: {{name}}
description: Run the project test suite and report results
managed_by: codi
---

Run the project's test suite:
1. Detect the test runner (npm test, pytest, go test, cargo test)
2. Execute tests
3. Report results: passed, failed, skipped
4. If failures, analyze and suggest fixes
`;
