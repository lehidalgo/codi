import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Measure and improve test coverage
managed_by: ${PROJECT_NAME}
---

Use the test-coverage skill to measure and improve code coverage.
Detect the test framework, run coverage analysis, identify files below 80%.
Generate missing tests for uncovered code paths.
Report before/after coverage comparison.
`;
