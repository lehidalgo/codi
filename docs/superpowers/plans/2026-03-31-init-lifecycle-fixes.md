# Init & Preset Lifecycle Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 bugs discovered during QA audit of the preset lifecycle, so that `codi init` correctly installs built-in presets (both interactive and non-interactive), generates agent config files, and `codi preset install` rejects built-in names with a helpful error.

**Architecture:** Targeted fixes in existing files — no new modules needed. All building blocks (`materializeBuiltinPreset`, `applyPresetArtifacts`, `resolveConflicts`, `generate`) already exist.

**Tech Stack:** TypeScript, Vitest

---

## Bug Summary

| # | Bug | Severity | File | Root Cause |
|---|-----|----------|------|------------|
| B1 | `codi init` non-interactive skips all artifact scaffolding | HIGH | `src/cli/init.ts:254-315` | Non-interactive path never populates `ruleTemplates`, `skillTemplates`, etc. from preset definition |
| B2 | `codi init` `generate()` always fails — no CLAUDE.md produced | HIGH | `src/cli/init.ts:641` | Manifest `name` taken from `path.basename()` without lowercasing → schema rejects uppercase chars |
| B3 | `codi init` doesn't write `preset-lock.json` | MEDIUM | `src/cli/init.ts` (entire handler) | No lock file write anywhere in the init flow |
| B4 | `codi preset install codi-balanced` crashes with git clone | LOW | `src/cli/preset-handlers.ts:221` | No `builtin` branch in `presetInstallUnifiedHandler` |

---

## Task 1: Fix manifest name sanitization (B2)

**Why first:** This blocks `generate()` in ALL init modes. Without this fix, no agent config files (CLAUDE.md, etc.) are ever produced.

**Files:**
- Modify: `src/cli/init.ts:641`
- Test: `tests/unit/cli/init.test.ts` (if exists, else `tests/unit/cli/init-name.test.ts`)

### Root Cause

`src/cli/init.ts:641`:
```typescript
name: path.basename(path.dirname(configDir)),
```

Takes the directory name raw. If the directory has uppercase letters (e.g., `MyProject`, `codi-qa-s1h-QUNizm`), the `name` field in `codi.yaml` violates the manifest schema at `src/schemas/manifest.ts:9`:
```typescript
name: z.string().regex(NAME_PATTERN).max(MAX_NAME_LENGTH)  // NAME_PATTERN = /^[a-z0-9-]+$/
```

Then `resolveConfig()` → `scanProjectDir()` → `parseManifest()` fails schema validation → `generate()` never runs.

### Fix

`src/cli/init.ts:641` — sanitize the directory name to match `NAME_PATTERN`:

```typescript
// Before
name: path.basename(path.dirname(configDir)),

// After
name: path.basename(path.dirname(configDir))
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "-")
  .replace(/^-+|-+$/g, "")
  .replace(/-{2,}/g, "-") || "project",
```

This:
1. Lowercases all characters
2. Replaces invalid chars with `-`
3. Trims leading/trailing dashes
4. Collapses consecutive dashes
5. Falls back to `"project"` if the result is empty

---

- [ ] **Step 1: Write failing test**

```typescript
// In init test file
it("sanitizes uppercase directory names in manifest", async () => {
  const badName = "MyProject-ABC";
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), badName));
  // run init non-interactively
  const result = await initHandler(tmpDir, {
    preset: "codi-balanced",
    agents: ["claude-code"],
    force: false,
  });
  expect(result.success).toBe(true);

  // Read manifest and verify name is lowercase
  const manifest = await fs.readFile(
    path.join(tmpDir, ".codi", "codi.yaml"), "utf-8"
  );
  expect(manifest).toContain("name: myproject-abc");
});
```

- [ ] **Step 2: Run test — expect FAIL** (name will be `MyProject-ABC`)

- [ ] **Step 3: Apply the fix** at `src/cli/init.ts:641`

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Verify `codi generate` works after init**

```bash
TMPDIR=$(mktemp -d /tmp/codi-fix-b2-XXXXXX) && cd $TMPDIR && git init && \
  echo '{"name":"test"}' > package.json && \
  node /path/to/codi/dist/cli.js init --preset codi-balanced --agents claude-code && \
  node /path/to/codi/dist/cli.js generate
```

Expected: `generated: true`, CLAUDE.md exists

- [ ] **Step 6: Commit**

```bash
git add src/cli/init.ts tests/...
git commit -m "fix(init): sanitize manifest name to match NAME_PATTERN schema"
```

---

## Task 2: Fix non-interactive artifact scaffolding (B1)

**Why second:** Once B2 is fixed, `generate()` works but non-interactive init still produces zero artifacts.

**Files:**
- Modify: `src/cli/init.ts:254-316` (non-interactive path)
- Test: existing init tests + new test

### Root Cause

`src/cli/init.ts:139-143`:
```typescript
let ruleTemplates: string[] = [];
let skillTemplates: string[] = [];
let agentTemplates: string[] = [];
let commandTemplates: string[] = [];
let mcpServerTemplates: string[] = [];
```

The interactive wizard populates these at lines 196-200. The non-interactive path (254-315) validates the preset name and agent IDs but **never loads the preset's artifact list**.

### Fix

After line 315 (`await createProjectStructure(...)`) in the non-interactive branch, add:

```typescript
// Non-interactive: load artifact list from preset definition
const presetDef = getBuiltinPresetDefinition(presetName);
if (presetDef) {
  ruleTemplates = [...presetDef.rules];
  skillTemplates = [...presetDef.skills];
  agentTemplates = [...presetDef.agents];
  commandTemplates = [...presetDef.commands];
  // mcpServerTemplates stay empty — preset MCP is handled separately
}
```

`getBuiltinPresetDefinition` is already imported (used at line 654 in `createProjectStructure`).

### Verify

Check that `BuiltinPresetDefinition` actually has `rules`, `skills`, `agents`, `commands` as `string[]` fields:

```typescript
// src/templates/presets/types.ts
interface BuiltinPresetDefinition {
  name: string;
  rules: string[];
  skills: string[];
  agents: string[];
  commands: string[];
  // ...
}
```

---

- [ ] **Step 1: Write failing test**

```typescript
it("scaffolds preset artifacts in non-interactive mode", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-b1-"));
  // Simulate non-interactive init
  const result = await initHandler(tmpDir, {
    preset: "codi-balanced",
    agents: ["claude-code"],
  });
  expect(result.success).toBe(true);
  expect(result.data.rules.length).toBeGreaterThan(0);

  // Verify at least one rule file exists
  const rules = await fs.readdir(path.join(tmpDir, ".codi", "rules"));
  expect(rules.filter(f => f.endsWith(".md")).length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test — expect FAIL** (rules: [])

- [ ] **Step 3: Apply the fix** after line 315 in non-interactive branch

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Full smoke test**

```bash
TMPDIR=$(mktemp -d /tmp/codi-fix-b1-XXXXXX) && cd $TMPDIR && git init && \
  echo '{"name":"test"}' > package.json && \
  node /path/to/codi/dist/cli.js init --preset codi-balanced --agents claude-code
```

Expected: rules in `.codi/rules/`, skills in `.codi/skills/`, `generated: true`, CLAUDE.md exists

- [ ] **Step 6: Commit**

```bash
git commit -m "fix(init): populate artifact templates from preset in non-interactive mode"
```

---

## Task 3: Write preset-lock.json during init (B3)

**Files:**
- Modify: `src/cli/init.ts` (after artifact scaffolding, before generate)
- Test: add to existing init test

### Root Cause

The init handler never writes `preset-lock.json`. The `readLockFile`/`writeLockFile` utilities exist in `src/core/preset/preset-registry.ts` but are never called from init.

### Fix

After the state tracking block (line ~443) and before `generate()` (line 445), add:

```typescript
// Record installed preset in lock file
try {
  const { readLockFile, writeLockFile } = await import("../core/preset/preset-registry.js");
  const lock = await readLockFile(configDir);
  lock.presets[presetName] = {
    version: "builtin",
    source: presetName,
    sourceType: "builtin",
    installedAt: new Date().toISOString(),
  };
  await writeLockFile(configDir, lock);
} catch {
  log.warn("Failed to write preset lock file; this is non-critical.");
}
```

Use dynamic import to avoid circular dependencies (init.ts → preset-registry.ts). Alternatively, add a static import at the top if no circular dep exists.

---

- [ ] **Step 1: Write failing test**

```typescript
it("writes preset-lock.json with sourceType builtin", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-b3-"));
  await initHandler(tmpDir, { preset: "codi-balanced", agents: ["claude-code"] });

  const lockPath = path.join(tmpDir, ".codi", "preset-lock.json");
  const lock = JSON.parse(await fs.readFile(lockPath, "utf-8"));
  expect(lock.presets["codi-balanced"]).toBeDefined();
  expect(lock.presets["codi-balanced"].sourceType).toBe("builtin");
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Apply the fix**

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(init): write preset-lock.json during initialization"
```

---

## Task 4: Reject builtin names in `preset install` (B4)

**Files:**
- Modify: `src/cli/preset-handlers.ts:211-221`
- Test: `tests/unit/cli/preset-handlers.test.ts`

### Root Cause

`presetInstallUnifiedHandler` handles `zip` and `github` descriptor types but has no `builtin` case. Falls through to legacy `presetInstallHandler` which git-clones the name as a URL.

### Fix

Add before the fallback at line 221:

```typescript
if (descriptor.type === "builtin") {
  return createCommandResult({
    success: false,
    command: "preset install",
    data: { action: "install", name: descriptor.identifier },
    errors: [
      {
        code: "E_BUILTIN_NOT_INSTALLABLE",
        message: `"${descriptor.identifier}" is a built-in preset.`,
        hint: `Use \`${PROJECT_CLI} init --preset ${descriptor.identifier}\` to install built-in presets.`,
        severity: "error",
        context: {},
      },
    ],
    exitCode: EXIT_CODES.GENERAL_ERROR,
  });
}
```

---

- [ ] **Step 1: Write failing test**

```typescript
it("rejects builtin preset names with helpful error", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-b4-"));
  const result = await presetInstallUnifiedHandler(tmpDir, "codi-balanced", { force: true });

  expect(result.success).toBe(false);
  expect(result.errors![0]!.code).toBe("E_BUILTIN_NOT_INSTALLABLE");
  expect(result.errors![0]!.hint).toContain("codi init");
});
```

- [ ] **Step 2: Run test — expect FAIL** (crashes with git clone)

- [ ] **Step 3: Apply the fix**

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(preset): reject builtin names in preset install with helpful hint"
```

---

## Task 5: Full regression + smoke test

- [ ] **Step 1: Run full unit test suite**

```bash
npx vitest run tests/unit 2>&1 | tail -20
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Non-interactive smoke test**

```bash
TMPDIR=$(mktemp -d /tmp/codi-final-XXXXXX) && cd $TMPDIR && git init && \
  echo '{"name":"test"}' > package.json && \
  node /path/to/codi/dist/cli.js init --preset codi-balanced --agents claude-code
```

Verify:
- `generated: true`
- `rules: [...]` has entries
- `.codi/rules/` populated
- `.codi/preset-lock.json` exists with `sourceType: "builtin"`
- `CLAUDE.md` exists in project root

- [ ] **Step 4: Interactive smoke test (HUMAN)**

User runs `codi init` in a fresh dir and verifies same results.

- [ ] **Step 5: Reject test**

```bash
node dist/cli.js preset install codi-balanced 2>&1
```

Expected: Error with "Use `codi init --preset codi-balanced`" hint

---

## Execution Order

```
Task 1 (B2: name sanitization) — unblocks generate() for ALL modes
  ↓
Task 2 (B1: non-interactive artifacts) — depends on Task 1 for generate() to work
  ↓
Task 3 (B3: preset-lock.json) — independent but logical after artifacts work
  ↓
Task 4 (B4: reject builtin in install) — independent, smallest change
  ↓
Task 5 (regression + smoke) — validates all 4 fixes together
```
