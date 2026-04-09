# Preset System Restructuring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce 9 built-in presets to 6 well-differentiated presets by merging security-hardened into strict, replacing language-specific presets with a new language-agnostic fullstack preset, trimming power-user, and removing data-ml.

**Architecture:** Each preset is a `BuiltinPresetDefinition` object in `src/templates/presets/`. The registry in `index.ts` maps names to definitions via `BUILTIN_PRESETS`. Tests use dynamic discovery (`getBuiltinPresetNames()`) so integration tests auto-adapt. Unit tests have hardcoded counts and preset-specific assertions that need updating.

**Tech Stack:** TypeScript, Vitest, Zod validation

**Spec:** `docs/superpowers/specs/2026-03-30-preset-restructuring-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| CREATE | `src/templates/presets/fullstack.ts` | New language-agnostic fullstack preset |
| MODIFY | `src/templates/presets/strict.ts` | Absorb security-hardened's locked flags |
| MODIFY | `src/templates/presets/power-user.ts` | Trim rules/skills/agents/commands |
| MODIFY | `src/templates/presets/index.ts` | Remove 4 presets, add fullstack |
| NO-OP | `src/core/flags/flag-presets.ts` | Only references minimal/balanced/strict — no change needed |
| DELETE | `src/templates/presets/security-hardened.ts` | Merged into strict |
| DELETE | `src/templates/presets/python-web.ts` | Replaced by fullstack |
| DELETE | `src/templates/presets/typescript-fullstack.ts` | Replaced by fullstack |
| DELETE | `src/templates/presets/data-ml.ts` | Removed (agent pack pattern) |
| MODIFY | `tests/unit/templates/presets/registry.test.ts` | Update count 9→6, fix preset-specific tests |
| MODIFY | `tests/unit/core/preset/preset-builtin.test.ts` | Remove deleted preset tests, add fullstack |
| MODIFY | `tests/unit/cli/init-wizard.test.ts` | Remove python-web test block |
| MODIFY | `docs/presets.md` | Update preset table and descriptions |
| MODIFY | `docs/features.md` | Update preset count 9→6 |
| MODIFY | `CHANGELOG.md` | Breaking change note |

---

### Task 1: Create the fullstack preset definition

**Files:**
- Create: `src/templates/presets/fullstack.ts`

- [ ] **Step 1: Create fullstack.ts**

Use the same structure as `src/templates/presets/balanced.ts` as the template. The new preset:

```typescript
import type { FlagDefinition } from "../../types/flags.js";
import type { BuiltinPresetDefinition } from "./types.js";
import { prefixedName, PROJECT_NAME } from "#src/constants.js";

export const preset: BuiltinPresetDefinition = {
  name: prefixedName("fullstack"),
  description:
    "Comprehensive web/app development — broad rules, testing, and security. Language-agnostic.",
  version: "1.0.0",
  author: PROJECT_NAME,
  tags: ["fullstack", "web", "app", "api"],
  compatibility: {
    engine: ">=0.3.0",
    agents: ["claude-code", "cursor", "windsurf", "codex", "cline"],
  },
  flags: {
    auto_commit: { mode: "enabled", value: false },
    test_before_commit: { mode: "enabled", value: true },
    security_scan: { mode: "enforced", value: true },
    type_checking: { mode: "enforced", value: "strict" },
    max_file_lines: { mode: "enabled", value: 500 },
    require_tests: { mode: "enabled", value: true },
    allow_shell_commands: { mode: "enabled", value: true },
    allow_file_deletion: { mode: "enabled", value: true },
    lint_on_save: { mode: "enabled", value: true },
    allow_force_push: { mode: "enabled", value: false },
    require_pr_review: { mode: "enabled", value: true },
    mcp_allowed_servers: { mode: "enabled", value: [] },
    require_documentation: { mode: "enabled", value: false },
    allowed_languages: { mode: "enabled", value: ["*"] },
    max_context_tokens: { mode: "enabled", value: 50000 },
    progressive_loading: { mode: "enabled", value: "metadata" },
    drift_detection: { mode: "enabled", value: "warn" },
    auto_generate_on_change: { mode: "enabled", value: false },
  } satisfies Record<string, FlagDefinition>,
  rules: [
    prefixedName("code-style"),
    prefixedName("testing"),
    prefixedName("architecture"),
    prefixedName("error-handling"),
    prefixedName("api-design"),
    prefixedName("security"),
    prefixedName("performance"),
  ],
  skills: [
    prefixedName("code-review"),
    prefixedName("e2e-testing"),
    prefixedName("refactoring"),
    prefixedName("security-scan"),
    prefixedName("commit"),
  ],
  agents: [
    prefixedName("code-reviewer"),
    prefixedName("test-generator"),
  ],
  commands: [
    prefixedName("check"),
    prefixedName("commit"),
    prefixedName("review"),
    prefixedName("test-run"),
    prefixedName("security-scan"),
  ],
  mcpServers: [],
};
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/templates/presets/fullstack.ts`
Expected: No errors

---

### Task 2: Modify strict.ts to absorb security-hardened

**Files:**
- Modify: `src/templates/presets/strict.ts`
- Reference (read-only): `src/templates/presets/security-hardened.ts`

- [ ] **Step 1: Add locked flags from security-hardened**

In `src/templates/presets/strict.ts`, change these two flag entries:

```typescript
// BEFORE:
allow_shell_commands: { mode: "enabled", value: true },
allow_file_deletion: { mode: "enabled", value: false },

// AFTER:
allow_shell_commands: { mode: "enforced", value: true, locked: true },
allow_file_deletion: { mode: "enforced", value: false, locked: true },
```

- [ ] **Step 2: Add api-design rule from security-hardened**

In the `rules` array, add `prefixedName("api-design")` if not already present:

```typescript
rules: [
    prefixedName("code-style"),
    prefixedName("testing"),
    prefixedName("error-handling"),
    prefixedName("security"),
    prefixedName("git-workflow"),
    prefixedName("api-design"),     // <-- add this
    devArtifactName("improvement"),
],
```

- [ ] **Step 3: Update tags to include security-hardened's identity**

```typescript
// BEFORE:
tags: ["strict", "enforced", "security"],

// AFTER:
tags: ["strict", "enforced", "security", "enterprise", "compliance"],
```

---

### Task 3: Trim power-user preset

**Files:**
- Modify: `src/templates/presets/power-user.ts`

- [ ] **Step 1: Trim rules array from 13 to 6**

Replace the rules array:

```typescript
rules: [
    prefixedName("workflow"),
    prefixedName("agent-usage"),
    prefixedName("code-style"),
    prefixedName("error-handling"),
    prefixedName("git-workflow"),
    devArtifactName("improvement"),
],
```

Removed: testing, architecture, documentation, production-mindset, simplicity-first, security, performance (these belong in fullstack/strict).

- [ ] **Step 2: Trim skills array from 9 to 6**

Replace the skills array:

```typescript
skills: [
    prefixedName("code-review"),
    prefixedName("commit"),
    prefixedName("codebase-onboarding"),
    prefixedName("documentation"),
    prefixedName("error-recovery"),
    prefixedName("compare-preset"),
],
```

Removed: security-scan, refactoring, test-coverage (these belong in fullstack/strict).

- [ ] **Step 3: Trim agents array from 3 to 2**

Replace the agents array:

```typescript
agents: [
    prefixedName("codebase-explorer"),
    prefixedName("code-reviewer"),
],
```

Removed: security-analyzer (belongs in strict).

- [ ] **Step 4: Trim commands array from 15 to 12**

Replace the commands array:

```typescript
commands: [
    prefixedName("commit"),
    prefixedName("review"),
    prefixedName("check"),
    prefixedName("codebase-explore"),
    prefixedName("index-graph"),
    prefixedName("update-graph"),
    prefixedName("open-day"),
    prefixedName("close-day"),
    prefixedName("roadmap"),
    prefixedName("docs-lookup"),
    prefixedName("session-handoff"),
    prefixedName("onboard"),
],
```

Removed: security-scan, test-run, refactor (available from fullstack/strict).

---

### Task 4: Update preset registry (index.ts)

**Files:**
- Modify: `src/templates/presets/index.ts`

- [ ] **Step 1: Replace index.ts imports and exports**

Remove imports for deleted presets, add fullstack:

```typescript
import { prefixedName, PROJECT_NAME } from "#src/constants.js";
import { preset as minimal } from "./minimal.js";
import { preset as balanced } from "./balanced.js";
import { preset as strict } from "./strict.js";
import { preset as fullstack } from "./fullstack.js";
import { preset as development } from "./development.js";
import { preset as powerUser } from "./power-user.js";
import type { BuiltinPresetDefinition } from "./types.js";

export {
  minimal,
  balanced,
  strict,
  fullstack,
  development,
  powerUser,
};

export const BUILTIN_PRESETS: Record<string, BuiltinPresetDefinition> = {
  [prefixedName("minimal")]: minimal,
  [prefixedName("balanced")]: balanced,
  [prefixedName("strict")]: strict,
  [prefixedName("fullstack")]: fullstack,
  [`${PROJECT_NAME}-dev`]: development,
  [prefixedName("power-user")]: powerUser,
};
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors (deleted files are no longer imported)

---

### Task 5: Delete removed preset files

**Files:**
- Delete: `src/templates/presets/security-hardened.ts`
- Delete: `src/templates/presets/python-web.ts`
- Delete: `src/templates/presets/typescript-fullstack.ts`
- Delete: `src/templates/presets/data-ml.ts`

- [ ] **Step 1: Delete the 4 preset files**

```bash
git rm src/templates/presets/security-hardened.ts
git rm src/templates/presets/python-web.ts
git rm src/templates/presets/typescript-fullstack.ts
git rm src/templates/presets/data-ml.ts
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

### Task 6: Update unit tests — registry

**Files:**
- Modify: `tests/unit/templates/presets/registry.test.ts`

- [ ] **Step 1: Update ALL_PRESET_NAMES and count**

Change the preset name array to list all 6 presets and update the `.toHaveLength()` assertion from 9 to 6:

```typescript
const ALL_PRESET_NAMES = [
  prefixedName("minimal"),
  prefixedName("balanced"),
  prefixedName("strict"),
  prefixedName("fullstack"),
  `${PROJECT_NAME}-dev`,
  prefixedName("power-user"),
] as const;
```

Update the length check:
```typescript
expect(presetNames).toHaveLength(6);
```

- [ ] **Step 2: Replace preset-specific tests**

Remove the tests for `python-web` (enforced type_checking) and `security-hardened` (locked flags). Replace with tests for the new/modified presets:

```typescript
it("strict preset has locked security flags (absorbed from security-hardened)", () => {
  const def = getBuiltinPresetDefinition(prefixedName("strict"));
  expect(def).toBeDefined();
  expect(def!.flags["security_scan"]!.locked).toBe(true);
  expect(def!.flags["allow_shell_commands"]!.locked).toBe(true);
  expect(def!.flags["allow_file_deletion"]!.locked).toBe(true);
  expect(def!.flags["allow_force_push"]!.locked).toBe(true);
});

it("fullstack preset has enforced type checking and security scan", () => {
  const def = getBuiltinPresetDefinition(prefixedName("fullstack"));
  expect(def).toBeDefined();
  expect(def!.flags["type_checking"]!.mode).toBe("enforced");
  expect(def!.flags["security_scan"]!.mode).toBe("enforced");
  expect(def!.flags["require_tests"]!.value).toBe(true);
});
```

- [ ] **Step 3: Run registry tests**

Run: `npx vitest run tests/unit/templates/presets/registry.test.ts`
Expected: All tests pass

---

### Task 7: Update unit tests — preset-builtin

**Files:**
- Modify: `tests/unit/core/preset/preset-builtin.test.ts`

- [ ] **Step 1: Remove deleted preset assertions**

Remove any `isBuiltinPreset()` assertions for:
- `prefixedName("python-web")`
- `prefixedName("typescript-fullstack")`
- `prefixedName("security-hardened")`
- `prefixedName("data-ml")`

Add assertion for fullstack:
```typescript
expect(isBuiltinPreset(prefixedName("fullstack"))).toBe(true);
```

- [ ] **Step 2: Remove materializeBuiltinPreset tests for deleted presets**

Delete the entire test blocks for `python-web` and `security-hardened` materialize tests. Add a fullstack materialize test:

```typescript
it("materializes fullstack preset with 7 rules", async () => {
  const result = await materializeBuiltinPreset(prefixedName("fullstack"), tmpDir);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.data.rules.length).toBe(7);
  }
});
```

- [ ] **Step 3: Run preset-builtin tests**

Run: `npx vitest run tests/unit/core/preset/preset-builtin.test.ts`
Expected: All tests pass

---

### Task 8: Update unit tests — init-wizard

**Files:**
- Modify: `tests/unit/cli/init-wizard.test.ts`

- [ ] **Step 1: Remove python-web test block**

Find and delete the test block that uses `prefixedName("python-web")` for mockFlagEditing (around lines 235-266). This test validated flag editing with the python-web preset. Replace with a reference to fullstack if the same test pattern is needed:

```typescript
// If a flag-editing test existed for python-web, replace the preset name:
// prefixedName("python-web") → prefixedName("fullstack")
```

- [ ] **Step 2: Run init-wizard tests**

Run: `npx vitest run tests/unit/cli/init-wizard.test.ts`
Expected: All tests pass

---

### Task 9: Run full test suite

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass. Integration tests use dynamic `getBuiltinPresetNames()` so they auto-adapt to the 6-preset list.

- [ ] **Step 2: Fix any snapshot mismatches**

If snapshot tests fail due to changed preset output, update them:
```bash
npx vitest run --update
```

Review snapshot diffs to ensure they only reflect expected preset changes.

---

### Task 10: Update documentation

**Files:**
- Modify: `docs/presets.md`
- Modify: `docs/features.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update docs/presets.md**

Replace the preset count ("9 presets" → "6 presets") and update the preset table to show only the 6 remaining presets. Add the fullstack preset entry:

```markdown
| `codi-fullstack` | fullstack | Comprehensive web/app development — broad rules, testing, and security. Language-agnostic. |
```

Remove rows for: codi-python-web, codi-typescript-fullstack, codi-security-hardened, codi-data-ml.

Add a "Language Customization" section explaining how to add language-specific rules to any preset:
```bash
codi add rule python --template python
codi add rule django --template django
```

- [ ] **Step 2: Update docs/features.md**

Change the preset count from 9 to 6 in the Preset System section. Update the preset table.

- [ ] **Step 3: Add breaking change to CHANGELOG.md**

Under `[Unreleased]` → `### Changed`, add:

```markdown
- **Preset system restructured (breaking)** — 9 presets reduced to 6:
  - `codi-security-hardened` merged into `codi-strict` (locked flags absorbed)
  - `codi-python-web` and `codi-typescript-fullstack` replaced by `codi-fullstack` (language-agnostic)
  - `codi-data-ml` removed (use any preset + `codi add agent` for domain agents)
  - New `codi-fullstack` preset: broad rules + testing + security for any web/app project
  - `codi-power-user` trimmed to focus on workflow tooling (removed duplicate quality rules)
  - **Migration**: See `docs/superpowers/specs/2026-03-30-preset-restructuring-design.md` for migration guide
```

- [ ] **Step 4: Sync generated sections**

Run: `npx codi docs-update`
This updates the generated preset table in README.md.

---

### Task 11: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Type check**

Run: `npm run lint`
Expected: No type errors

- [ ] **Step 4: Validate Codi config**

Run: `npx codi validate`
Expected: Configuration valid

- [ ] **Step 5: Generate with each preset**

```bash
# In a temporary directory, test each preset
for preset in minimal balanced strict fullstack power-user; do
  echo "Testing codi-$preset..."
  npx codi init --agents claude-code --preset $preset --force
  npx codi generate
  npx codi status
  echo "---"
done
```

Expected: Each preset generates valid output without errors.

- [ ] **Step 6: Verify removed presets give clear error**

```bash
npx codi init --agents claude-code --preset python-web --force
```

Expected: Error message indicating the preset doesn't exist. Ideally suggests alternatives.
