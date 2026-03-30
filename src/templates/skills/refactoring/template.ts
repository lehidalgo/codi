import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Safe dead code removal and refactoring workflow. Detects unused code, classifies safety level, and deletes with test verification after each change. Stops immediately if tests fail.
category: Code Quality
compatibility: [claude-code, cursor, codex]
managed_by: ${PROJECT_NAME}
---

# {{name}}

## When to Use

Use when asked to clean up dead code, remove unused exports, or refactor for simplicity.

## When to Activate

- User asks to remove dead code, unused imports, or unused exports
- User wants to consolidate duplicate functions or redundant abstractions
- User asks to refactor a module for simplicity without changing behavior
- User needs to identify and safely delete code that is no longer referenced

## Refactoring Process

### Step 1: Detect Dead Code

**[SYSTEM]** Run the appropriate dead code detection tool:
- TypeScript/JavaScript: \\\`npx knip --reporter=json\\\`
- Python: \\\`vulture . --min-confidence=80\\\`
- Go: \\\`deadcode ./...\\\`
- Rust: \\\`cargo +nightly udeps\\\`

If the tool is not installed, install it first, then run.

### Step 2: Classify Findings

**[CODING AGENT]** Review each finding and classify into three categories:

**SAFE** — Confidently delete:
- Unexported functions with no internal callers
- Unused imports and variables
- Dead branches after constant conditions
- Test utilities only used by deleted tests

**CAUTION** — Investigate before deleting:
- Exports that may be used by external consumers
- Functions referenced via dynamic imports or string-based lookups
- Event handlers registered by name
- Code behind feature flags

**DANGER** — Do not auto-delete:
- Public API surface (exported from package entry point)
- Functions called via reflection or metaprogramming
- Code referenced in configuration files or scripts
- Plugin interfaces or extension points

### Step 3: Baseline Test Run

**[SYSTEM]** Run the full test suite before making any changes:
- Record pass/fail counts and total run time
- If tests already fail, report and stop — do not refactor on a broken baseline

### Step 4: Delete SAFE Items

**[CODING AGENT]** Delete SAFE items one at a time:
- Remove the unused code
- Remove any imports that become unused as a result
- Update or remove related documentation comments

**[SYSTEM]** After each deletion, run the test suite.

If tests fail after a deletion:
- Immediately revert the change
- Reclassify the item as CAUTION
- Continue with the next SAFE item

### Step 5: Investigate CAUTION Items

**[CODING AGENT]** For each CAUTION item:
- Search for dynamic references (string interpolation, reflection)
- Check configuration files, scripts, and build tools
- Look for references in other repositories if it is a shared package
- If confirmed unused, reclassify as SAFE and delete with test verification

### Step 6: Consolidate Duplicates

**[CODING AGENT]** After dead code removal, look for:
- Nearly identical functions that can be merged
- Wrapper functions that add no value (just forward arguments)
- Redundant type definitions or interfaces
- Files that now have fewer than 10 lines of meaningful code (candidates for merging)

Apply the same delete-and-test cycle for each consolidation.

### Step 7: Final Report

**[CODING AGENT]** Summarize the refactoring:
- Items removed (count by category)
- Items skipped with reasons
- Lines of code removed
- Complexity improvement: report before/after cognitive complexity for refactored modules (if linter supports it)
- Test results: all passing, none broken
- CAUTION and DANGER items left for manual review

## Stop Conditions

Stop the refactoring process if:
- Tests fail and the cause cannot be identified
- The same error persists after 3 fix attempts
- More errors are introduced than resolved
- A deletion affects public API contracts

## Available Agents

For specialized analysis, delegate to these agents (see \\\`agents/\\\` directory):
- **codi-refactorer** — Autonomous dead code removal with classification system
- **codi-test-generator** — Generate tests for refactored code

## Related Skills

- **codi-test-coverage** — Verify coverage after refactoring changes
- **codi-code-review** — Review refactored code for quality
`;
