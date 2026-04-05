import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Detect and run the project test suite, then report results with failure diagnosis. Use when running tests, checking if tests pass, or diagnosing test failures. Also activate when the user says 'run tests' or 'are tests passing'.
category: Testing
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}}

## When to Activate

- User asks to run the project's tests
- User wants to check if tests pass
- User needs test results before committing or merging

## Workflow

### Step 1: Detect Test Runner

**[SYSTEM]** Identify the test framework:
- \`package.json\` — look for vitest, jest, mocha in scripts or devDependencies
- \`pyproject.toml\` / \`setup.cfg\` — look for pytest configuration
- \`go.mod\` — Go uses \`go test\`
- \`Cargo.toml\` — Rust uses \`cargo test\`
- \`*.csproj\` / \`*.sln\` — .NET uses \`dotnet test\`

### Step 2: Execute the Full Test Suite

**[SYSTEM]** Run the appropriate command:
- Node.js: \`npm test\` / \`pnpm test\` / \`yarn test\`
- Python: \`pytest\`
- Go: \`go test ./...\`
- Rust: \`cargo test\`
- .NET: \`dotnet test\`

### Step 3: Report Results

**[CODING AGENT]** Summarize the outcome:
- Total: passed, failed, skipped
- For each failure:
  - Test name, file, and error message
  - Distinguish pre-existing failures from new ones — run \`git stash\` and re-run if needed to isolate
  - Suggest a specific fix
- If all tests pass, confirm with a one-line summary
`;
