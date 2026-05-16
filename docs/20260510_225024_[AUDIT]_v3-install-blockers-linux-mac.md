# Codi v3 Install Blockers — Linux & non-primary Mac users

- **Date**: 2026-05-10 22:50
- **Document**: 20260510*225024*[AUDIT]\_v3-install-blockers-linux-mac.md
- **Category**: AUDIT
- **Status**: research-only, no code changes

## Executive Summary

Users installing codi v3 on Linux (and Macs without prior Codi cache) hit four
independent defects that combine into a hard failure of the brain capture
pipeline. Each is a real bug with a concrete root cause cited below; each has
an industry-standard fix. None require workarounds in user repos — every fix
lands in the codi source tree.

| #   | Defect                                                                                        | Severity | Root cause file:line                                                 |
| --- | --------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| 1   | `codi brain ui` reports `[OK]` even when child crashes                                        | HIGH     | `src/cli/brain.ts:128-133`                                           |
| 2   | pnpm 11 skips native postinstall for `playwright`                                             | MEDIUM   | `package.json` `pnpm.onlyBuiltDependencies` missing entry            |
| 3   | `codi init` does not deep-merge into existing `.claude/settings.json` — Stop hook never wired | CRITICAL | `src/runtime/agents/claude-code.ts:343-485` + `generator.ts:149-190` |
| 4   | 56 binary skill assets reported as drifted forever                                            | MEDIUM   | `src/runtime/skills/skill-generator.ts:299, 356-360`                 |

The defect chain explains the original symptom: brain UI runs (issue 1
silently masks issue 2 if bindings missing), but the `captures` table stays
at zero rows because the Stop hook (issue 3) was never installed. Issue 4 is
unrelated noise in `codi doctor` that erodes trust in the diagnostics.

---

## Defect 1 — Brain UI launcher: foreground spawn has no readiness probe

### Symptom

`codi brain ui --foreground` prints `[OK] brain ui` and exits 0 even when
the spawned child crashes immediately (e.g. missing better-sqlite3 native
binding throws inside `openBrain()`).

### Evidence

- CLI handler: `src/cli/brain.ts:108-133`
- Brain server entry: `src/runtime/brain-ui/cli-server.ts:47`
- DB binding load: `src/runtime/brain/db.ts:18, 164` — `better-sqlite3` is
  imported and instantiated **inside the child**, so binding failures never
  propagate to the parent launcher.
- Background path **does** probe `/healthz` for 5000 ms:
  `src/cli/brain.ts:144-152` calls `probeHealthz()` defined at
  `src/runtime/brain-ui/lifecycle.ts:64-86`.
- Foreground path returns success immediately after `spawn()`:
  `src/cli/brain.ts:128-133` — no probe, no exit-code wait, no stderr scrape.

### Root cause

The readiness probe was added only to the background branch
(`detached: true, stdio=["ignore","ignore","pipe"]`). The foreground branch
(`stdio: "inherit"`) was assumed to expose errors via the inherited tty, but
the parent still issues `[OK]` before the child has bound to the port.

### Minimal fix

Insert a 1 s readiness probe in the foreground branch before
`createCommandResult({ success: true, ... })`:

```ts
// src/cli/brain.ts — inside isForeground === true branch, before line 128
const FG_READY_DEADLINE_MS = 1000;
const POLL_MS = 50;
const deadline = Date.now() + FG_READY_DEADLINE_MS;
while (Date.now() < deadline) {
  if (child.exitCode !== null) {
    return foregroundFailure("child exited before binding port");
  }
  const probe = await probeHealthz(port, 100);
  if (probe?.ok) break;
  await new Promise((r) => setTimeout(r, POLL_MS));
}
if (Date.now() >= deadline) {
  return foregroundFailure("brain ui failed to start within 1s");
}
```

Reuse the existing `probeHealthz()` helper. Failure path returns
`E_BRAIN_UI_FOREGROUND_SPAWN_FAILED` and exit code from
`EXIT_CODES.GENERAL_ERROR`.

---

## Defect 2 — pnpm 11 skips postinstall builds for `playwright`

### Symptom

On a fresh `pnpm install`, native postinstall for `playwright` (browser
binaries) is skipped. pnpm 11 blocks postinstall scripts by default for
security; only packages declared in `pnpm.onlyBuiltDependencies` run.

### Evidence

- `package.json` `pnpm.onlyBuiltDependencies` declares: `better-sqlite3`,
  `esbuild` ✓.
- Missing: `playwright@^1.59.1` (devDependencies) requires a postinstall
  download/build of browser engines.
- Install docs (`docs/src/content/docs/guides/getting-started.md`) do not
  mention `pnpm approve-builds` or `onlyBuiltDependencies`.
- `codi doctor` **does** detect missing better-sqlite3 bindings via
  `checkNativeBindings()` at `src/cli/doctor.ts:54-64`. The error message at
  `src/runtime/brain/db.ts:136-149` correctly tells the user to run
  `pnpm approve-builds && pnpm rebuild better-sqlite3`. So the doctor path
  is fine — the gap is the install-time pnpm config.

### Root cause

Source `package.json` does not declare every native dep in
`onlyBuiltDependencies`. pnpm 11 default is `--only-built-dependencies` =
allowlist mode, so any native package not listed is silently skipped.

### Minimal fix

Add `playwright` to the allowlist:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["better-sqlite3", "esbuild", "playwright"]
  }
}
```

Optionally extend `codi doctor` to surface a hint mentioning
`onlyBuiltDependencies` when `checkNativeBindings()` fails.

---

## Defect 3 — `codi init` does NOT merge into existing `.claude/settings.json`

### Symptom — most user-facing of the four

User has a pre-existing `.claude/settings.json` (e.g. from a FastAPI
template) with `PreToolUse` + `PostToolUse` only. Runs `codi init`. Init
reports success. But the runtime `Stop` / `UserPromptSubmit` hooks are never
wired. Result: `|TYPE: "..."|` markers emitted by Claude are dropped on the
floor. `captures` table stays at 0 rows. brain UI shows nothing.

`codi hooks list` cheerfully reports `[runtime] capture-markers` as
currently enabled (it IS enabled in `.codi/state/state.json`) — but that
state is never propagated into `.claude/settings.json`.

### Evidence

- Init flow: `applyConfigurationWithBackup` at
  `src/runtime/init/init-helpers.ts:511` → `applyConfiguration` at
  `src/runtime/generator.ts:64` → adapter `generate()` at
  `src/runtime/agents/claude-code.ts:313-320`.
- `buildSettingsJson()` at `src/runtime/agents/claude-code.ts:343-485` always
  builds a full settings.json from scratch.
- Conflict resolver at `src/runtime/generator.ts:149-190` is **line-based
  union merge with git-style markers** (`<<<<<< / ======= / >>>>>>>`). For
  JSON this produces invalid syntax.
- Result: when user's settings.json differs from the generated payload,
  conflict resolution writes a malformed JSON or keeps the user's file —
  either way the runtime hooks never reach disk.
- `codi hooks add runtime capture-markers` only writes to
  `.codi/state/state.json` (`src/cli/commands/hooks-add.ts:18-54`); it does
  NOT regenerate settings.json (`src/runtime/agents/claude-code.ts:69-81`
  reads state for generation, but generation must be re-triggered).
- `codi generate` re-runs `applyConfiguration` and hits the same conflict
  path; the git hooks installer at `src/runtime/generator.ts:124-216` only
  touches `.git/hooks/` and `.husky/`, not `.claude/settings.json`.

### Root cause

There is no schema-aware deep-merge for `.claude/settings.json`. The
adapter assumes greenfield. As soon as a file exists with different shape,
the generator falls back to line-based union merge that breaks JSON.

### Minimal fix

Add a `mergeSettingsJson(existing, generated)` helper in
`src/runtime/agents/claude-code.ts` that:

1. Reads existing `.claude/settings.json` if present.
2. Deep-merges by hook event key (`PreToolUse`, `PostToolUse`, `Stop`,
   `UserPromptSubmit`, `SubagentStop`, `SessionStart`).
3. Within each event, dedupes by `(matcher, command)` tuple. Codi-managed
   entries get a stable marker (e.g. `_managedBy: "codi"`) so subsequent
   regenerations can refresh codi entries while preserving user entries.
4. Returns the merged payload to the caller; the generator writes this
   directly without invoking the union-merge conflict resolver.

This single change unblocks every user with a non-codi `settings.json`.

### Secondary fix

Extend `codi doctor` with a check that compares `state.json.selectedHooks`
against `.claude/settings.json` event keys and reports any missing event
hooks with a `Run \`codi generate\` to sync` actionable message.

---

## Defect 4 — Binary skill assets reported as drifted on every `codi status`

### Symptom

`codi doctor` and `codi status` consistently report 56 binary files in
`.claude/skills/` as drifted (53 .ttf fonts, 1 .tar.gz, 1 .pdf), even on a
fresh clean install. Running `codi generate --force` does not converge.

### Evidence

- Drift detection reads actual file bytes:
  `src/runtime/state.ts:452-453`:
  ```ts
  const bytes = await fs.readFile(fullPath);
  const currentHash = hashBuffer(bytes);
  ```
- Skill generator marks binary files but discards content:
  `src/runtime/skills/skill-generator.ts:356-360`:
  ```ts
  if (BINARY_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
    results.push({ relativePath, content: "", binarySrc: fullPath });
  }
  ```
- Hash is computed from the empty string at
  `src/runtime/skills/skill-generator.ts:299`:
  ```ts
  hash: hashContent(sf.content),  // sf.content === "" → EMPTY_INPUT_SHA256
  ```
- Files are copied correctly with `fs.copyFile` at
  `src/runtime/generator.ts:161-162` — the bytes on disk are byte-identical
  to the source. The bug is only in the recorded hash.

### Root cause

False positive. Files are byte-correct on disk, but the persisted hash is
SHA256 of the empty string (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4...`).
Drift detection then compares the empty-string hash to the real file hash
and reports drift on every check.

### Minimal fix

In `src/runtime/skills/skill-generator.ts`, compute the real binary hash
when marking the entry:

```ts
if (BINARY_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
  const bytes = await fs.readFile(fullPath);
  results.push({
    relativePath,
    content: "",
    binarySrc: fullPath,
    binaryHash: hashBuffer(bytes),
  });
}
```

Then at line 299:

```ts
hash: sf.binaryHash ?? hashContent(sf.content),
```

This requires extending the skill-file type with an optional `binaryHash`
field. No drift-detection logic changes needed — `hashBuffer(bytes)` will
match.

---

## Recommended fix order (lowest risk first)

1. **Defect 4** (binary hash) — pure additive change in skill generator,
   no merge logic involved. Clears the noise in `codi doctor`.
2. **Defect 1** (brain ui foreground probe) — small localised change in
   `src/cli/brain.ts`, reuses existing `probeHealthz()` helper.
3. **Defect 2** (`onlyBuiltDependencies`) — single-line `package.json`
   edit. Bumps install reliability for new pnpm 11 users.
4. **Defect 3** (settings.json deep merge) — biggest change but highest
   user impact. Needs new merge helper + tests covering: greenfield write,
   merge into FastAPI-style settings, idempotent re-run, preservation of
   user-added hooks on unrelated event keys.

## Out of scope for this audit

- Fonts canvas-design vs codi-canvas-design naming drift — separate concern.
- The 20+ `W_CONTENT_SIZE` warnings on skills exceeding 6000 chars — content
  guideline, not a runtime defect.
- The `codi list` "too many arguments" error in the user's transcript — needs
  its own reproduction.

## Citations summary

| Concern                                 | File                                    | Lines                        |
| --------------------------------------- | --------------------------------------- | ---------------------------- |
| Brain UI foreground exit-0              | `src/cli/brain.ts`                      | 108-133                      |
| Brain UI background probe (reference)   | `src/cli/brain.ts`                      | 144-152                      |
| `probeHealthz` helper                   | `src/runtime/brain-ui/lifecycle.ts`     | 64-86                        |
| sqlite binding load                     | `src/runtime/brain/db.ts`               | 18, 164                      |
| `package.json` allowlist                | `package.json`                          | `pnpm.onlyBuiltDependencies` |
| Native bindings doctor check            | `src/cli/doctor.ts`                     | 54-64                        |
| settings.json builder                   | `src/runtime/agents/claude-code.ts`     | 343-485                      |
| Generator conflict resolver             | `src/runtime/generator.ts`              | 149-190                      |
| `codi hooks add` writes only state.json | `src/cli/commands/hooks-add.ts`         | 18-54                        |
| Binary skill hash bug                   | `src/runtime/skills/skill-generator.ts` | 299, 356-360                 |
| Drift detection hashBuffer              | `src/runtime/state.ts`                  | 452-453                      |
| Generator binary copy (correct)         | `src/runtime/generator.ts`              | 161-162                      |
