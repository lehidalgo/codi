import { PROJECT_NAME } from "../../constants.js";

export const template = `---
name: {{name}}
description: Identify and safely remove dead code
managed_by: ${PROJECT_NAME}
---

Use the refactoring skill to identify and safely remove dead code.
Run detection tools, classify findings by safety level, and delete with test verification.
Stop immediately if tests fail. Never delete without running tests first.
`;
