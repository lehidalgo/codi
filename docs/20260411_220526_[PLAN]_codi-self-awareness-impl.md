# Codi Self-Awareness Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Claude aware when it is working on the Codi source repo vs. a consumer project, via a custom rule (Layer A), auto-injected CLAUDE.md section (Layer B), and a general `project_context` manifest field (Layer C).

**Architecture:** Layer A is a `managed_by: user` rule that always loads. Layer B auto-injects a warning section into CLAUDE.md when `manifest.name === "codi"`. Layer C adds a `project_context` field to `codi.yaml` whose value is injected verbatim into CLAUDE.md as a `## Project Context` section.

**Tech Stack:** TypeScript, Zod (schema validation), Vitest (tests)

**Spec:** `docs/20260411_220211_[PLAN]_codi-self-awareness.md`

---

- [ ] Task 1: Create Layer A custom rule
- [ ] Task 2: Add `project_context` to Zod schema and TypeScript type
- [ ] Task 3: Test and implement `buildProjectContext()`
- [ ] Task 4: Test and implement `buildSelfDevWarning()`
- [ ] Task 5: Wire both section builders into the claude-code adapter
- [ ] Task 6: Add `project_context` to `MANIFEST_DESCRIPTIONS`
- [ ] Task 7: Update `.codi/codi.yaml` and regenerate

---

### Task 1: Create Layer A custom rule

**Files**: `.codi/rules/codi-dev-context.md`
**Est**: 2 minutes

**Steps**:

1. - [ ] Create `.codi/rules/codi-dev-context.md`:

```markdown
---
name: codi-dev-context
description: Clarifies source vs generated file boundaries when working on the Codi source repo
priority: high
alwaysApply: true
managed_by: user
version: 1
---

# Codi Self-Development Context

## You Are Working on the Codi Source Code

This project IS Codi — not a project that merely uses Codi. The source of truth for
all rule, skill, and agent templates shipped to users is `src/templates/`, not `.codi/`.

## Source vs Generated File Map

| To change | Edit this | NEVER edit this |
|-----------|-----------|-----------------|
| A rule template shipped to users | `src/templates/rules/<name>.md` | `.claude/rules/<name>.md` |
| A skill template shipped to users | `src/templates/skills/<name>/template.ts` | `.claude/skills/<name>/SKILL.md` |
| An agent template shipped to users | `src/templates/agents/<name>.md` | `.claude/agents/<name>.md` |
| A rule for this project only | `.codi/rules/<name>.md` | `.claude/rules/` (generated output) |

## The `.claude/` Directory Is Always Generated

Every file under `.claude/` is produced by `codi generate` from the sources above.
Any manual edit there is silently overwritten on the next `codi generate` run.

## Test Loop for Template Changes

1. Edit `src/templates/rules/` or `src/templates/skills/` or `src/templates/agents/`
2. Run `pnpm build` to compile TypeScript
3. Run `codi generate` inside a separate test project to see the output
4. Bump the `version:` field in the template frontmatter whenever content changes meaningfully

## Artifact Version Bumping

The pre-commit hook runs a version baseline check. If you change template content without
bumping `version:` in its frontmatter, the hook will auto-bump and re-stage the file.
To avoid surprises, bump the version manually before committing.
```

2. - [ ] Verify the rule parses by running:
   ```bash
   pnpm codi validate
   ```
   Expected: no validation errors.

3. - [ ] Commit:
   ```bash
   git add .codi/rules/codi-dev-context.md
   git commit -m "feat(rules): add codi-dev-context rule for self-development guidance"
   ```

---

### Task 2: Add `project_context` to Zod schema and TypeScript type

**Files**: `src/schemas/manifest.ts`, `src/types/config.ts`
**Est**: 3 minutes

**Steps**:

1. - [ ] Write a failing test in `tests/unit/schemas.test.ts` (add a new `describe` block at the end of the file):

```typescript
describe("ProjectManifestSchema — project_context", () => {
  it("accepts a manifest with project_context", () => {
    const result = ProjectManifestSchema.safeParse({
      name: "my-project",
      version: "1",
      project_context: "## Context\n\nSome guidance here.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.project_context).toBe("## Context\n\nSome guidance here.");
    }
  });

  it("accepts a manifest without project_context", () => {
    const result = ProjectManifestSchema.safeParse({
      name: "my-project",
      version: "1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.project_context).toBeUndefined();
    }
  });

  it("rejects project_context that is not a string", () => {
    const result = ProjectManifestSchema.safeParse({
      name: "my-project",
      version: "1",
      project_context: 42,
    });
    expect(result.success).toBe(false);
  });
});
```

You will need to add this import at the top of `tests/unit/schemas.test.ts`:
```typescript
import { ProjectManifestSchema } from "#src/schemas/manifest.js";
```

2. - [ ] Verify the test fails:
   ```bash
   pnpm test tests/unit/schemas.test.ts
   ```
   Expected: the three new tests fail (field does not exist yet).

3. - [ ] Add the `project_context` field to `src/schemas/manifest.ts` after the `description` field (line 23):

```typescript
  project_context: z
    .string()
    .optional()
    .describe(
      "Free-form markdown injected into the AI instruction file as a 'Project Context' section. " +
        "Use for project-specific AI guidance that does not belong in any rule or skill.",
    ),
```

4. - [ ] Fix pre-existing type drift: in `src/types/config.ts`, the `layers` block inside `ProjectManifest` is missing the `context` field that already exists in the Zod schema. Update the `layers?` block (around line 37):

```typescript
  layers?: {
    /** Whether to generate rule files. Defaults to `true`. */
    rules?: boolean;
    /** Whether to generate skill files. Defaults to `true`. */
    skills?: boolean;
    /** Whether to generate agent files. Defaults to `true`. */
    agents?: boolean;
    /** Whether to generate context files. Defaults to `true`. */
    context?: boolean;
  };
```

5. - [ ] Add the `project_context` field to the `ProjectManifest` interface in `src/types/config.ts` after `description?` (line 25):

```typescript
  /** Free-form markdown injected verbatim into the AI instruction file. */
  project_context?: string;
```

6. - [ ] Verify the tests pass:
   ```bash
   pnpm test tests/unit/schemas.test.ts
   ```
   Expected: all three new tests pass.

7. - [ ] Commit:
   ```bash
   git add src/schemas/manifest.ts src/types/config.ts tests/unit/schemas.test.ts
   git commit -m "feat(schema): add project_context field to codi.yaml manifest"
   ```

---

### Task 3: Test and implement `buildProjectContext()`

**Files**: `tests/unit/adapters/section-builder.test.ts`, `src/adapters/section-builder.ts`
**Est**: 3 minutes

**Steps**:

1. - [ ] Add a failing test block at the end of `tests/unit/adapters/section-builder.test.ts`:

```typescript
describe("buildProjectContext", () => {
  it("returns null when project_context is absent", () => {
    const config = createMockConfig();
    expect(buildProjectContext(config)).toBeNull();
  });

  it("returns null when project_context is empty string", () => {
    const config = createMockConfig({
      manifest: { name: "test-project", version: "1", project_context: "   " },
    });
    expect(buildProjectContext(config)).toBeNull();
  });

  it("wraps project_context in a ## Project Context section", () => {
    const config = createMockConfig({
      manifest: { name: "test-project", version: "1", project_context: "Some guidance here." },
    });
    const result = buildProjectContext(config);
    expect(result).toContain("## Project Context");
    expect(result).toContain("Some guidance here.");
  });

  it("trims leading and trailing whitespace from content", () => {
    const config = createMockConfig({
      manifest: { name: "test-project", version: "1", project_context: "  trimmed  " },
    });
    const result = buildProjectContext(config)!;
    expect(result).toBe("## Project Context\n\ntrimmed");
  });
});
```

Add `buildProjectContext` to the import at the top of the test file:
```typescript
import {
  buildProjectOverview,
  buildArchitectureSummary,
  buildAgentsTable,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  getEnabledMcpServers,
  collectMcpEnvVars,
  buildMcpEnvExample,
  buildProjectContext,
} from "#src/adapters/section-builder.js";
```

2. - [ ] Verify the tests fail:
   ```bash
   pnpm test tests/unit/adapters/section-builder.test.ts
   ```
   Expected: 4 new tests fail (function does not exist yet).

3. - [ ] Add the `buildProjectContext` function to `src/adapters/section-builder.ts` (append at the end of the file):

```typescript
/** Build a project context section from the manifest's project_context field. */
export function buildProjectContext(config: NormalizedConfig): string | null {
  const ctx = config.manifest.project_context;
  if (!ctx?.trim()) return null;
  return `## Project Context\n\n${ctx.trim()}`;
}
```

4. - [ ] Verify all tests pass:
   ```bash
   pnpm test tests/unit/adapters/section-builder.test.ts
   ```
   Expected: all tests in the file pass.

5. - [ ] Commit:
   ```bash
   git add src/adapters/section-builder.ts tests/unit/adapters/section-builder.test.ts
   git commit -m "feat(adapters): add buildProjectContext section builder"
   ```

---

### Task 4: Test and implement `buildSelfDevWarning()`

**Files**: `tests/unit/adapters/section-builder.test.ts`, `src/adapters/section-builder.ts`
**Est**: 3 minutes

**Steps**:

1. - [ ] Add a failing test block at the end of `tests/unit/adapters/section-builder.test.ts`:

```typescript
describe("buildSelfDevWarning", () => {
  it("returns null when project name is not 'codi'", () => {
    const config = createMockConfig({ manifest: { name: "my-app", version: "1" } });
    expect(buildSelfDevWarning(config)).toBeNull();
  });

  it("returns a warning section when project name is 'codi'", () => {
    const config = createMockConfig({ manifest: { name: "codi", version: "1" } });
    const result = buildSelfDevWarning(config);
    expect(result).not.toBeNull();
    expect(result).toContain("## Self-Development Mode");
  });

  it("includes the source/output file map table", () => {
    const config = createMockConfig({ manifest: { name: "codi", version: "1" } });
    const result = buildSelfDevWarning(config)!;
    expect(result).toContain("src/templates/rules/");
    expect(result).toContain("src/templates/skills/");
    expect(result).toContain("src/templates/agents/");
    expect(result).toContain(".claude/rules/");
  });

  it("uses PROJECT_NAME constant for detection — not a hardcoded string", () => {
    // Confirms the check uses the imported constant, not a magic "codi" string.
    // If PROJECT_NAME ever changes, this test catches it.
    const config = createMockConfig({ manifest: { name: PROJECT_NAME, version: "1" } });
    expect(buildSelfDevWarning(config)).not.toBeNull();
  });
});
```

Add `buildSelfDevWarning` to the import:
```typescript
import {
  buildProjectOverview,
  buildArchitectureSummary,
  buildAgentsTable,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  getEnabledMcpServers,
  collectMcpEnvVars,
  buildMcpEnvExample,
  buildProjectContext,
  buildSelfDevWarning,
} from "#src/adapters/section-builder.js";
```

Update the constants import at the top of `tests/unit/adapters/section-builder.test.ts`. The current line reads:
```typescript
import { MANIFEST_FILENAME } from "#src/constants.js";
```
Change it to:
```typescript
import { PROJECT_NAME, MANIFEST_FILENAME } from "#src/constants.js";
```

2. - [ ] Verify the tests fail:
   ```bash
   pnpm test tests/unit/adapters/section-builder.test.ts
   ```
   Expected: 4 new tests fail.

3. - [ ] First, add `PROJECT_NAME` to the import in `src/adapters/section-builder.ts`. The current import line reads:
   ```typescript
   import { PROJECT_NAME_DISPLAY, PROJECT_URL, BRAND_CATEGORY } from "../constants.js";
   ```
   Change it to:
   ```typescript
   import { PROJECT_NAME, PROJECT_NAME_DISPLAY, PROJECT_URL, BRAND_CATEGORY } from "../constants.js";
   ```

5. - [ ] Add the `buildSelfDevWarning` function to `src/adapters/section-builder.ts` (append after `buildProjectContext`):

```typescript
/** Inject a self-development warning when working inside the Codi source repo. */
export function buildSelfDevWarning(config: NormalizedConfig): string | null {
  if (config.manifest.name !== PROJECT_NAME) return null;
  return [
    "## Self-Development Mode",
    "",
    "> You are working on the **Codi source code** — not a consumer project.",
    "> The source of truth for templates shipped to users is `src/templates/`, not `.codi/`.",
    "",
    "| To change | Edit | Never edit |",
    "|-----------|------|------------|",
    "| A rule template | `src/templates/rules/<name>.md` | `.claude/rules/` (generated) |",
    "| A skill template | `src/templates/skills/<name>/template.ts` | `.claude/skills/` (generated) |",
    "| An agent template | `src/templates/agents/<name>.md` | `.claude/agents/` (generated) |",
    "| This project's own rules | `.codi/rules/<name>.md` | `.claude/rules/` (generated) |",
    "",
    "Run `pnpm build && codi generate` in a test project to verify template changes.",
    "Bump `version:` in template frontmatter whenever content changes.",
  ].join("\n");
}
```

4. - [ ] Verify all tests pass:
   ```bash
   pnpm test tests/unit/adapters/section-builder.test.ts
   ```
   Expected: all tests in the file pass.

5. - [ ] Commit:
   ```bash
   git add src/adapters/section-builder.ts tests/unit/adapters/section-builder.test.ts
   git commit -m "feat(adapters): add buildSelfDevWarning section builder"
   ```

---

### Task 5: Wire both section builders into the claude-code adapter

**Files**: `src/adapters/claude-code.ts`, `tests/unit/adapters/claude-code.test.ts`
**Est**: 4 minutes

**Steps**:

1. - [ ] Add failing tests to `tests/unit/adapters/claude-code.test.ts` inside the existing `describe("generate() — CLAUDE.md", ...)` block:

```typescript
it("injects self-dev warning section when manifest name is 'codi'", async () => {
  const config = createMockConfig({ manifest: { name: "codi", version: "1" } });
  const files = await claudeCodeAdapter.generate(config, {});
  const mainFile = files.find((f) => f.path === "CLAUDE.md")!;
  expect(mainFile.content).toContain("## Self-Development Mode");
  expect(mainFile.content).toContain("src/templates/rules/");
});

it("does not inject self-dev warning for non-codi projects", async () => {
  const config = createMockConfig({ manifest: { name: "other-project", version: "1" } });
  const files = await claudeCodeAdapter.generate(config, {});
  const mainFile = files.find((f) => f.path === "CLAUDE.md")!;
  expect(mainFile.content).not.toContain("## Self-Development Mode");
});

it("injects project_context section when field is set", async () => {
  const config = createMockConfig({
    manifest: {
      name: "test-project",
      version: "1",
      project_context: "## Custom Guidance\n\nAlways do X before Y.",
    },
  });
  const files = await claudeCodeAdapter.generate(config, {});
  const mainFile = files.find((f) => f.path === "CLAUDE.md")!;
  expect(mainFile.content).toContain("## Project Context");
  expect(mainFile.content).toContain("## Custom Guidance");
  expect(mainFile.content).toContain("Always do X before Y.");
});

it("does not inject project_context section when field is absent", async () => {
  const config = createMockConfig({ manifest: { name: "test-project", version: "1" } });
  const files = await claudeCodeAdapter.generate(config, {});
  const mainFile = files.find((f) => f.path === "CLAUDE.md")!;
  expect(mainFile.content).not.toContain("## Project Context");
});

it("places self-dev warning before project_context before permissions", async () => {
  const config = createMockConfig({
    manifest: {
      name: "codi",
      version: "1",
      project_context: "Some context.",
    },
  });
  const files = await claudeCodeAdapter.generate(config, {});
  const content = files.find((f) => f.path === "CLAUDE.md")!.content;
  const selfDevPos = content.indexOf("## Self-Development Mode");
  const contextPos = content.indexOf("## Project Context");
  const permissionsPos = content.indexOf("## Permissions");
  expect(selfDevPos).toBeLessThan(contextPos);
  expect(contextPos).toBeLessThan(permissionsPos);
});
```

2. - [ ] Verify the tests fail:
   ```bash
   pnpm test tests/unit/adapters/claude-code.test.ts
   ```
   Expected: 5 new tests fail.

3. - [ ] Update the imports in `src/adapters/claude-code.ts`. Add `buildProjectContext` and `buildSelfDevWarning` to the import from `./section-builder.js`:

```typescript
import {
  buildProjectOverview,
  buildAgentsTable,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  getEnabledMcpServers,
  buildMcpEnvExample,
  buildProjectContext,
  buildSelfDevWarning,
} from "./section-builder.js";
```

4. - [ ] Update the `generate()` method in `src/adapters/claude-code.ts`. After the `buildProjectOverview` call (around line 101), insert:

```typescript
    // Project overview from manifest
    const overview = buildProjectOverview(config);
    if (overview) sections.push(overview);

    // Self-development warning — only when working on the Codi source repo
    const selfDevWarning = buildSelfDevWarning(config);
    if (selfDevWarning) sections.push(selfDevWarning);

    // Free-form project context from manifest
    const projectContext = buildProjectContext(config);
    if (projectContext) sections.push(projectContext);

    if (flagText) {
      sections.push("## Permissions\n\n" + flagText);
    }
```

5. - [ ] Verify all tests pass:
   ```bash
   pnpm test tests/unit/adapters/claude-code.test.ts
   ```
   Expected: all tests pass.

6. - [ ] Run the full test suite to catch regressions:
   ```bash
   pnpm test
   ```
   Expected: all tests pass. Note: snapshot tests may need updating if CLAUDE.md output changed — run `pnpm test -- --update-snapshots` if snapshots fail.

7. - [ ] Commit:
   ```bash
   git add src/adapters/claude-code.ts tests/unit/adapters/claude-code.test.ts
   git commit -m "feat(adapters): wire buildSelfDevWarning and buildProjectContext into claude-code adapter"
   ```

---

### Task 6: Add `project_context` to `MANIFEST_DESCRIPTIONS`

**Files**: `src/core/docs/renderers/schema-renderers.ts`
**Est**: 2 minutes

**Steps**:

1. - [ ] In `src/core/docs/renderers/schema-renderers.ts`, add `"project_context"` to the `MANIFEST_DESCRIPTIONS` map after the `"description"` entry (around line 272):

```typescript
const MANIFEST_DESCRIPTIONS: Record<string, string> = {
  name: "Project name (alphanumeric + hyphens)",
  version: "Manifest version (always `1`)",
  description: "Project description",
  project_context: "Free-form markdown injected into the AI instruction file as a Project Context section",
  agents: "Agent IDs to generate for",
  // ... rest unchanged
};
```

2. - [ ] Verify the docs generation still works:
   ```bash
   pnpm build && node dist/cli.js docs --validate
   ```
   Expected: no errors.

3. - [ ] Commit:
   ```bash
   git add src/core/docs/renderers/schema-renderers.ts
   git commit -m "docs(schema): document project_context field in manifest schema reference"
   ```

---

### Task 7: Update `.codi/codi.yaml` and regenerate

**Files**: `.codi/codi.yaml`
**Est**: 3 minutes

**Steps**:

1. - [ ] Update `.codi/codi.yaml` to add the `project_context` block:

```yaml
name: codi
version: "1"
agents:
  - claude-code
project_context: |
  ## You Are Working on the Codi Source Code

  This project IS Codi. The source of truth for all rule, skill, and agent
  templates shipped to users is `src/templates/`, not `.codi/`.

  | To change | Edit | Never edit |
  |-----------|------|------------|
  | A rule template | `src/templates/rules/<name>.md` | `.claude/rules/` (generated) |
  | A skill template | `src/templates/skills/<name>/template.ts` | `.claude/skills/` (generated) |
  | An agent template | `src/templates/agents/<name>.md` | `.claude/agents/` (generated) |
  | This project's own rules | `.codi/rules/<name>.md` | `.claude/rules/` (generated) |

  Run `pnpm build && codi generate` in a test project to verify template changes.
  Bump `version:` in template frontmatter whenever content changes.
```

2. - [ ] Build and regenerate to materialize all changes into CLAUDE.md:
   ```bash
   pnpm build && codi generate
   ```
   Expected: `codi generate` succeeds. CLAUDE.md now contains both `## Self-Development Mode` (from Layer B) and `## Project Context` (from Layer C).

3. - [ ] Verify the new sections appear in CLAUDE.md:
   ```bash
   grep -n "## Self-Development Mode\|## Project Context\|## Permissions" CLAUDE.md
   ```
   Expected output (lines will vary, but order must be Self-Development → Project Context → Permissions):
   ```
   N: ## Self-Development Mode
   M: ## Project Context
   P: ## Permissions
   ```

4. - [ ] Commit:
   ```bash
   git add .codi/codi.yaml CLAUDE.md
   git commit -m "feat(config): add project_context to codi.yaml; regenerate CLAUDE.md with self-awareness sections"
   ```

---

## Verification

After all tasks complete, run the full suite:

```bash
pnpm test
```

Expected: all tests pass. CLAUDE.md contains three new sections in order:
1. `## Self-Development Mode` (Layer B — auto-injected because `name === "codi"`)
2. `## Project Context` (Layer C — from `project_context` in `codi.yaml`)
3. `## Permissions` (existing — unchanged)

And `.claude/rules/codi-dev-context.md` exists as a generated rule from Layer A.
