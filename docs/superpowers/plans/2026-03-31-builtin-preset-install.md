# Builtin Preset Install Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `codi preset install codi-balanced` (and all other builtin presets) — currently crashes with a `git clone` error because `presetInstallUnifiedHandler` has no `builtin` branch.

**Architecture:** Add a `builtin` case inside `presetInstallUnifiedHandler` that materializes the preset in-memory via `materializeBuiltinPreset`, applies its artifacts, merges flags, and writes a lock entry with `sourceType: "builtin"`. No new files needed — one import line added, one branch added (~30 lines).

**Tech Stack:** TypeScript, Vitest, Node.js fs

---

## Root Cause Summary

`src/cli/preset-handlers.ts` — `presetInstallUnifiedHandler` (line 104):

```
if (descriptor.type === "zip")    → ✅ handled
if (descriptor.type === "github") → ✅ handled
// "builtin" has NO case         → ⚠️ falls through to legacy git-clone handler
return presetInstallHandler(...)  → 💥 git clone codi-balanced → crash
```

`parsePresetIdentifier("codi-balanced")` correctly returns `{ type: "builtin" }`.
The fix is to intercept that type before the fallback.

---

## Files

| Action | File | Change |
|--------|------|--------|
| Modify | `src/cli/preset-handlers.ts` | Add `materializeBuiltinPreset` import + `builtin` branch (~30 lines) |
| Test | `tests/unit/cli/preset-handlers.test.ts` | Add `describe("presetInstallUnifiedHandler")` block with 3 test cases |

> **LOC note:** `preset-handlers.ts` is currently 763 lines (over the 700-line project limit). This fix adds ~30 lines. A follow-up refactor to split this file is out of scope here but should be tracked.

---

## Task 1: Add `builtin` branch to `presetInstallUnifiedHandler`

**Files:**
- Modify: `src/cli/preset-handlers.ts:29` (add import)
- Modify: `src/cli/preset-handlers.ts:211-221` (add builtin branch before fallback)
- Test: `tests/unit/cli/preset-handlers.test.ts` (new describe block at end of file)

---

### Step 1: Write the failing test

Add this `describe` block at the end of `tests/unit/cli/preset-handlers.test.ts` (before the final closing brace, if any — otherwise just append):

```typescript
import {
  presetValidateHandler,
  presetRemoveHandler,
  presetListEnhancedHandler,
  presetExportHandler,
  presetInstallUnifiedHandler,  // ← add this import
} from "#src/cli/preset-handlers.js";
```

Then append the describe block at the bottom of the file:

```typescript
describe("presetInstallUnifiedHandler — builtin preset", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-ph-install-`),
    );
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("installs a builtin preset, writes lock entry with sourceType builtin", async () => {
    // Act
    const result = await presetInstallUnifiedHandler(
      tmpDir,
      "codi-balanced",
      { force: true },
    );

    // Assert — command succeeded
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.action).toBe("install");
    expect(result.data.name).toBe("codi-balanced");

    // Assert — lock file written with sourceType: "builtin"
    const lockPath = path.join(tmpDir, PROJECT_DIR, PRESET_LOCK_FILENAME);
    const lockRaw = await fs.readFile(lockPath, "utf-8");
    const lock = JSON.parse(lockRaw) as {
      presets: Record<string, { sourceType: string }>;
    };
    expect(lock.presets["codi-balanced"]).toBeDefined();
    expect(lock.presets["codi-balanced"]!.sourceType).toBe("builtin");
  });

  it("applies at least one artifact to the config directory", async () => {
    // Act
    await presetInstallUnifiedHandler(tmpDir, "codi-balanced", { force: true });

    // Assert — at least one rule or agent file was written
    const configDir = path.join(tmpDir, PROJECT_DIR);
    const rulesDir = path.join(configDir, "rules");
    const agentsDir = path.join(configDir, "agents");

    let artifactCount = 0;
    for (const dir of [rulesDir, agentsDir]) {
      try {
        const files = await fs.readdir(dir);
        artifactCount += files.filter((f) => f.endsWith(".md")).length;
      } catch {
        // directory may not exist if preset has no artifacts of that type
      }
    }
    expect(artifactCount).toBeGreaterThan(0);
  });

  it("fails gracefully for an unknown builtin name (falls through to error)", async () => {
    // "codi-nonexistent" is not a builtin and not a valid git URL
    const result = await presetInstallUnifiedHandler(
      tmpDir,
      "codi-nonexistent-xyz",
      { force: true },
    );

    // Should fail, not crash — exit code is GENERAL_ERROR
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });
});
```

- [ ] **Step 1: Write the failing test** — Add `presetInstallUnifiedHandler` to the import and append the `describe` block above to `tests/unit/cli/preset-handlers.test.ts`

---

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npx vitest run tests/unit/cli/preset-handlers.test.ts 2>&1 | tail -30
```

Expected output: The two "builtin preset" tests fail (first with `result.success` being `false`, or the test itself crashing because the install crashes). The third test ("unknown builtin") may accidentally pass.

---

- [ ] **Step 3: Add the `materializeBuiltinPreset` import to `preset-handlers.ts`**

Find the existing builtin-related import at line ~36:

```typescript
import {
  getBuiltinPresetNames,
  BUILTIN_PRESETS,
} from "../templates/presets/index.js";
```

Add `materializeBuiltinPreset` from `preset-builtin.ts` right after it (line ~39):

```typescript
import { materializeBuiltinPreset } from "../core/preset/preset-builtin.js";
```

---

- [ ] **Step 4: Add the `builtin` branch in `presetInstallUnifiedHandler`**

Locate the section in `presetInstallUnifiedHandler` at approximately line 211–221:

```typescript
    if (descriptor.type === "github") {
      return installFromGithub(
        projectRoot,
        descriptor,
        presetsDir,
        installOptions,
      );
    }

    // Fallback: treat as registry --from style
    return presetInstallHandler(projectRoot, descriptor.identifier, source);
```

Insert the following block **between** the `github` branch and the fallback comment:

```typescript
    if (descriptor.type === "builtin") {
      const presetName = descriptor.identifier;
      log.info(`Installing built-in preset "${presetName}"...`);

      const materializeResult = materializeBuiltinPreset(presetName);
      if (!materializeResult.ok) {
        return createCommandResult({
          success: false,
          command: "preset install",
          data: { action: "install", name: presetName },
          errors: materializeResult.errors.map((e) => ({
            code: e.code,
            message: e.message,
            hint: e.hint,
            severity: e.severity as "error",
            context: e.context,
          })),
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
      }

      const loadedPreset = materializeResult.data;
      const applyResult = await applyPresetArtifacts(configDir, loadedPreset, {
        force: installOptions.force,
        json: installOptions.json,
      });
      log.info(
        `Applied: ${applyResult.added.length} added, ${applyResult.overwritten.length} updated, ${applyResult.skipped.length} skipped`,
      );
      await mergePresetFlags(configDir, loadedPreset, log);

      const lock = await readLockFile(configDir);
      lock.presets[presetName] = {
        version: "builtin",
        source: presetName,
        sourceType: "builtin",
        installedAt: new Date().toISOString(),
      };
      await writeLockFile(configDir, lock);
      log.info(`Installed built-in preset "${presetName}".`);

      return createCommandResult({
        success: true,
        command: "preset install",
        data: { action: "install", name: presetName },
        exitCode: EXIT_CODES.SUCCESS,
      });
    }
```

---

- [ ] **Step 5: Run the failing tests — they should now pass**

```bash
npx vitest run tests/unit/cli/preset-handlers.test.ts 2>&1 | tail -30
```

Expected output:
```
✓ presetInstallUnifiedHandler — builtin preset > installs a builtin preset, writes lock entry with sourceType builtin
✓ presetInstallUnifiedHandler — builtin preset > applies at least one artifact to the config directory
✓ presetInstallUnifiedHandler — builtin preset > fails gracefully for an unknown builtin name
```

---

- [ ] **Step 6: Run the full unit test suite to check for regressions**

```bash
npx vitest run tests/unit 2>&1 | tail -20
```

Expected: All previously passing tests continue to pass. Zero new failures.

---

- [ ] **Step 7: Build and smoke-test manually**

```bash
npm run build 2>&1 | tail -5
node dist/cli.js preset install codi-balanced --force 2>&1
```

Expected output (approx):
```
[INF] Installing built-in preset "codi-balanced"...
[INF] Applied: N added, 0 updated, 0 skipped
[OK] preset install
```

Then verify:
```bash
cat .codi/preset-lock.json | python3 -m json.tool | grep -A4 '"codi-balanced"'
```

Expected:
```json
"codi-balanced": {
  "version": "builtin",
  "source": "codi-balanced",
  "sourceType": "builtin",
```

---

- [ ] **Step 8: Commit**

```bash
git add src/cli/preset-handlers.ts tests/unit/cli/preset-handlers.test.ts
git commit -m "fix(preset): handle builtin type in presetInstallUnifiedHandler"
```
