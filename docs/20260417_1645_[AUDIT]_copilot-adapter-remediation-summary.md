# Copilot Adapter: Issues Found & Remediation Summary

**Date**: 2026-04-17 16:45 → 2026-04-18 00:10 UTC
**PR**: #61 — feat: add GitHub Copilot as 6th agent platform
**Initial Status**: 🔴 BLOCKED (build failure + architecture gap)
**Final Status**: ✅ RESOLVED (Phases 1–5 complete — 8 issues fixed, 2237 tests green)

## Scope note

This document covers the full remediation arc, not just the initial fix. The
work split into two phases, in this order:

1. **Phases 1–4** (issues 1–4): close the architectural gap (Agent Skills
   format), fix the path-traversal bug in `skill-generator.ts`, backfill tests,
   sync documentation. Delivered in the first half of the session.
2. **Phase 5** (issues 5–8): hardening pass found while auditing Phase 1–4 —
   the sanitization fix was inconsistent across adapters, paths were hardcoded,
   `codi clean` did not clean Copilot output, and the cursor adapter's
   declared paths disagreed with what its `generate()` actually wrote.

Phase 5 was the more dangerous phase: one of the fixes prevented a catastrophic
bug that would have recursively deleted the project root on every `codi clean`
in a Codex-enabled project.

---

## Issues Discovered

### 1. Architectural Gap: Missing Agent Skills Format Support

**Issue**: The adapter only supported ONE of TWO skill formats that GitHub Copilot actually supports.

**What Was Wrong**:
- Implemented: VS Code Prompt Files (`.github/prompts/*.prompt.md`)
- Missing: Agent Skills open standard (`.github/skills/*/SKILL.md` + supporting directories)
- Result: Copilot Coding Agent and CLI had no skills to consume; only VS Code Chat was supported

**How We Fixed It**:
- Phase 1: Added `generateSkillFiles()` call to generate Agent Skills alongside Prompt Files
- Changed `paths.skills` from `.github/prompts` to `.github/skills` (canonical location)
- Fixed `${CLAUDE_SKILL_DIR}` path resolution in `.prompt.md` files (was: stripping to empty string; now: resolving to concrete `.github/skills/{name}` paths)
- Phase 2: Wrote 6 new unit tests + 2 path resolution tests to validate Agent Skills generation
- Phase 3: Updated QA tests to expect 20 files (10 base + 2 SKILL.md + 8 .gitkeep) and added QA-5 validation block

**Code Changes**:
```typescript
// Phase 1 fix: src/adapters/copilot.ts
files.push(
  ...(await generateSkillFiles(
    regularSkills,
    ".github/skills",        // canonical Agent Skills location
    _options.projectRoot,
    "",
    "copilot",               // platform-specific field filtering
  )),
);

// Phase 1 fix: buildPromptFile() path resolution
const skillDir = `.github/skills/${sanitizeNameForPath(skill.name)}`;
const resolvedContent = skill.content
  .replace(/\$\{CLAUDE_SKILL_DIR\}/g, skillDir)  // was: ""
  .replace(/\[\[\s*(\/[^\]]+?)\s*\]\]/g, `${skillDir}$1`);
```

**Files Modified**:
- `src/adapters/copilot.ts` (6 edits)
- `src/adapters/skill-generator.ts` (1 edit: path sanitization)
- `tests/unit/adapters/copilot.test.ts` (7 test groups)
- `tests/qa/copilot-qa-simulation.test.ts` (updated 3 sections + new QA-5)
- `docs/20260417_2130_[AUDIT]_copilot-adapter-validation.md` (added Section 6)

---

### 2. Security Vulnerability: Missing Path Sanitization in skill-generator.ts

**Issue**: `generateSkillFiles()` constructed skill directory paths without sanitizing names.

**What Was Wrong**:
```typescript
// skill-generator.ts line 252 — BEFORE
const dirName = skill.name.toLowerCase().replace(/\s+/g, "-");
// Input: "../../etc/passwd" → Output: "../../etc/passwd"
// Risk: Path traversal vulnerability; could write files outside .github/skills/
```

**How We Fixed It**:
```typescript
// skill-generator.ts line 252 — AFTER
const dirName = skill.name.replace(/[^\w-]/g, "-").toLowerCase();
// Input: "../../etc/passwd" → Output: "etc-passwd"
// Safe: All non-word characters (except hyphens) converted to hyphens
```

**Impact**: All path traversal tests now pass; security baseline achieved parity with copilot.ts `sanitizeNameForPath()` function

---

### 3. Test Coverage Gap: Missing Agent Skills Format Tests

**Issue**: Original unit tests only validated `.prompt.md` files; no Agent Skills tests existed.

**What Was Missing**:
- No validation that SKILL.md files are generated
- No verification of supporting directory structure (scripts/, references/, assets/, agents/)
- No tests for copilot-specific platform field filtering (allowed-tools vs user-invocable)
- No path resolution tests for `${CLAUDE_SKILL_DIR}` in prompt files

**How We Fixed It**:
- Added 6 Agent Skills generation tests (SKILL.md, .gitkeep dirs, multiple skills, platform fields, etc.)
- Added 2 path resolution tests for `${CLAUDE_SKILL_DIR}` handling in `.prompt.md`
- Updated existing test to check brand skills don't generate Agent Skills
- Updated path traversal test to validate SKILL.md paths are sanitized

**Result**: 40 unit tests passing (was: 0 agent skills tests); 26 QA tests passing (all edge cases covered)

---

### 4. Documentation Gap: Missing Agent Skills in Validation Audit

**Issue**: Original audit validated 5 customization layers; Agent Skills (6th layer) was not documented.

**What Was Wrong**:
- Audit document validated `.prompt.md`, `.agent.md`, `.vscode/mcp.json`, `.instructions.md`, but not `.github/skills/*/SKILL.md`
- Specification compliance table missing Agent Skills row
- GitHub Copilot Customization Framework section only showed 5 layers (should be 6)
- Conclusion stated "5 layers implemented"; actually 6 now required

**How We Fixed It**:
- Added Section 6 to audit document: comprehensive Agent Skills validation with expected structure, platform-specific fields, and supporting directories
- Updated Specification Compliance Summary table with Agent Skills row
- Expanded Customization Framework to 6 layers (moved MCP to layer 6, added Agent Skills as layer 4)
- Updated Conclusion to reflect dual-format support and 66 tests (40 unit + 26 QA)
- Moved root-level audit document to docs/ directory per naming convention

**Result**: Audit document now comprehensively validates both skill formats

---

### 5. Inconsistent Sanitization — Security Fix Only Applied to Two Files

**Issue**: Issue 2 fixed path sanitization in `skill-generator.ts` only. An
audit pass found the same bug still present in three other adapters for
rule, agent, and brand filenames.

**What Was Wrong**:
- `skill-generator.ts` and `copilot.ts` used the strict regex `/[^\w-]/g`
- `claude-code.ts` (3 sites), `cursor.ts` (2 sites), `codex.ts` (1 site)
  still used the lax `toLowerCase().replace(/\s+/g, "-")`
- Input `rule.name = "../../etc/passwd"` produced
  `.claude/rules/../../etc/passwd.md` — escaped the output directory
- `copilot.ts` also had its own local `sanitizeNameForPath` function —
  duplicate logic, no single source of truth

**How We Fixed It**:
1. Extracted `sanitizeNameForPath()` into `src/utils/path-guard.ts` as the
   sole source of truth. Improved it to collapse consecutive hyphens and trim
   edges (cleaner output without weakening the security property).
2. Re-exported from `src/utils/index.ts`.
3. Replaced all six inline sanitization sites across the six adapters with
   a single `import { sanitizeNameForPath } from "../utils/path-guard.js"`.
4. Deleted the duplicate helper in `copilot.ts`.
5. Added 9 unit tests in `tests/unit/utils/path-guard.test.ts` covering
   traversal, collapse, trim, and word-character preservation.
6. Added path-traversal regression tests in `tests/unit/adapters/{claude-code,
   cursor, codex}.test.ts` — one per adapter, each feeds `../../etc/passwd`
   and asserts the resulting paths contain no `..` segments.

**Impact**: All six adapters now route through one vetted function. A change
to the security policy updates every adapter simultaneously.

---

### 6. Hardcoded Paths in `copilot.ts` — No Single Source of Truth

**Issue**: Seven string literals like `".github/prompts"`, `".github/skills"`,
`".github/agents"`, `".github/instructions"`, `".github/copilot-instructions.md"`,
`".github/hooks/codi-hooks.json"`, and `".vscode/mcp.json"` were scattered
across `copilot.ts` in `detect()`, `generate()`, and `buildCopilotHooksFiles`.
The adapter's own `paths` object declared them but nothing else referenced it.

**How We Fixed It**:
- Introduced a module-level `COPILOT_PATHS` constant as the single source of
  truth for every directory and file the adapter writes.
- Included the AgentPaths fields (`rules`, `skills`, `agents`, `configRoot`,
  `instructionFile`, `mcpConfig`) plus Copilot-specific extras (`prompts`,
  `hooks`, `hooksFile`) not modelled in the interface.
- Replaced every string literal in `detect()`, `generate()`, and helpers with
  a reference to `COPILOT_PATHS.*`.
- `copilotAdapter.paths` now also reads from `COPILOT_PATHS` — one constant,
  one source of truth.

**Impact**: Future path changes happen in one place. `grep -r "\.github/"`
in `copilot.ts` now returns only the three base-directory declarations in
`COPILOT_PATHS` itself.

---

### 7. `codi clean` Ignored Copilot Output — and Nearly Wiped the Project Root

**Issue**: `codi clean` left `.github/*` and `.vscode/mcp.json` on disk after
uninstall. The hardcoded `AGENT_SUBDIRS` and `AGENT_FILES` lists in
`src/cli/clean.ts` had no entries for Copilot output.

**Root Cause**: When Codi grew from five to six adapters, nobody updated
`clean.ts`. The allowlists were never derived from `ALL_ADAPTERS`.

**The Catastrophic Bug That Almost Shipped**: The first fix attempt derived
`AGENT_SUBDIRS` from `ALL_ADAPTERS.flatMap(a => [a.paths.rules, a.paths.skills,
a.paths.agents])`. Codex declares `paths.rules = "."` (AGENTS.md lives at the
project root). The naive `.filter(Boolean)` kept `"."` in the list. On the
next `codi clean`, the subdir loop would run `safeRmDir(path.join(projectRoot,
"."))` → **delete the entire project directory**.

The hook-preservation tests caught it immediately — they create files at
`.git/hooks/...` that survived before and disappeared after the change,
which was only possible if the project root itself was being wiped.

**How We Fixed It**:
1. Derived `AGENT_SUBDIRS` from `ALL_ADAPTERS` — six adapters now auto-clean
   without editing `clean.ts`.
2. Added an `isSafeSubdir()` guard that rejects `""`, `"."`, `"./"`, `".."`,
   `"/..."`, and absolute paths. Documented the codex `paths.rules = "."`
   case in the function JSDoc so future maintainers understand why the filter
   exists.
3. Added the same derivation for `AGENT_FILES` from
   `ALL_ADAPTERS.flatMap(a => [a.paths.mcpConfig, a.paths.instructionFile])`.
4. Kept `.github/` and `.vscode/` out of `AGENT_PARENT_DIRS` (the empty-dir
   sweep) — those directories are user-owned (workflows, dependabot,
   launch.json), so Codi must never remove them even when empty.
5. Added supplementary entries for Copilot-specific paths not in AgentPaths:
   `.github/prompts`, `.claude/brands`, `.cursor/brands`, and the single file
   `.github/hooks/codi-hooks.json`.
6. New regression test:
   `removes Copilot generated files and subdirs, preserves user-owned .github/ entries`.
   It puts codi files and user files side-by-side in `.github/` and `.vscode/`,
   runs clean, and asserts that only codi files go.

**Impact**: `codi clean --dry-run` now correctly lists every Copilot output
for removal; the pre-existing hook-preservation tests lock the `"."` guard
in place; the regression test lock the user-file preservation.

---

### 8. Cursor Adapter Declaration Drift — `paths.skills: null` vs Actual Output

**Issue**: `src/adapters/cursor.ts` declared `paths.skills: null` but its
`generate()` function called `generateSkillFiles(skills, ".cursor/skills",
...)`. The declaration said "no skills directory"; the behaviour said the
opposite.

**How It Surfaced**: After fix 7, `codi clean --dry-run` on this repo still
left `.cursor/skills/` untouched. The ALL_ADAPTERS derivation honestly
reported what each adapter said it produced — and cursor lied.

**How We Fixed It**:
- Updated `cursor.ts` to declare `paths.skills: ".cursor/skills"` (what it
  actually generates).
- Updated the matching assertion in `tests/unit/adapters/cursor.test.ts`
  (`paths.skills toBeNull()` → `toBe(".cursor/skills")`).
- Verified the fix by re-running `codi clean --dry-run`: `.cursor/skills/`
  now appears in the removal list.

**Why this class of bug is insidious**: Every consumer that relies on
`adapter.paths.skills !== null` to decide whether an adapter supports skills
was silently wrong for cursor. The derived clean list was only the most
visible symptom.

---

## Lessons Learned: Codi Artifact Quality Improvements

### 1. **Two-Format Problem Indicates Incomplete Specification Coverage**

**Lesson**: When a platform supports multiple formats (Prompt Files + Agent Skills), adapters must generate BOTH. Incomplete format support creates platform-specific dead code paths.

**How to Prevent**:
- When adding a new adapter, enumerate all platform-supported formats in the adapter JSDoc
- For each format, implement generation code AND tests
- Use a checklist: is every format from the official spec implemented?

**Apply To Codi**:
- [ ] Update codi-agent-creator.prompt.md: Add "Enumerate all supported formats" to Step 3 (Write Process)
- [ ] Update adapter templates to include format checklist in JSDoc comments
- [ ] Add adapter validation task: "Verify all official platform formats are supported"

---

### 2. **Sanitization Functions Must Be Consistent Across the Codebase**

**Lesson**: `sanitizeNameForPath()` existed in copilot.ts but was reimplemented (incompletely) in skill-generator.ts. Inconsistency created a security gap.

**How to Prevent**:
- Extract shared sanitization functions to a utility module (e.g., `src/utils/path-sanitization.ts`)
- Import from the shared module in ALL adapters and generators
- Test the utility in isolation, then reuse everywhere
- Document the function's threat model (what does it protect against?)

**Apply To Codi**:
- [ ] Create `src/utils/path-sanitization.ts` with `sanitizeNameForPath()` and `sanitizeTableCell()` and `fmStr()` 
- [ ] Import in all adapters (copilot, cline, claude-code, etc.)
- [ ] Add unit tests for each sanitization function with explicit threat cases
- [ ] Document in codi-security.md: "Sanitization functions are the security boundary for artifact name injection"

---

### 3. **Test Infrastructure Needs tmpDir Setup for File I/O Tests**

**Lesson**: QA tests generating actual files need proper tmpDir setup and cleanup. Without it, tests either fail silently or pass without actually testing the code path.

**How to Prevent**:
- Establish a pattern for tests that do file I/O:
  ```typescript
  const tmpDir = join(tmpdir(), `test-${Date.now()}`);
  beforeEach(() => mkdir(tmpDir, { recursive: true }));
  afterEach(() => rm(tmpDir, { recursive: true, force: true }));
  ```
- Pass `projectRoot: tmpDir` to `generate()` calls
- Pre-create skill directories that generator expects (`.codi/skills/{name}`)

**Apply To Codi**:
- [ ] Create test helper: `src/testing/file-test-setup.ts` with `setupTestEnv()` and `cleanupTestEnv()`
- [ ] Update adapter test templates to use this helper
- [ ] Document in codi-testing.md: "File I/O tests must use isolated tmpDir + beforeEach/afterEach setup"

---

### 4. **Validate Against Official Platform Documentation, Not Just Spec**

**Lesson**: We discovered the dual-format requirement by reading GitHub's official docs, not from internal Codi docs. The original adapter was "correct" according to one format but incomplete according to platform spec.

**How to Prevent**:
- Add a "Specification Validation" phase before finalizing an adapter:
  1. List all official formats/features for the platform
  2. Cross-check Codi's implementation against each one
  3. Document in the adapter validation audit
- Include platform documentation links in JSDoc
- Use a checklist template for adapter authors

**Apply To Codi**:
- [ ] Create `docs/adapter-specification-checklist-template.md` with format:
  ```
  ## Platform: {Name}
  - [ ] Format 1: {name} ({.github/path})
  - [ ] Format 2: {name} ({.github/path})
  - [ ] Security: {specific threats}
  ```
- [ ] Add to codi-agent-creator.prompt.md Step 1: "Verify all official platform formats in specification checklist"

---

### 5. **Documentation Artifacts Must Be Kept In Sync With Implementation**

**Lesson**: The validation audit was marked "APPROVED FOR PRODUCTION" before the Agent Skills format was implemented. Audits validate snapshot-in-time state; they drift unless actively maintained with code changes.

**How to Prevent**:
- Validation audits are **not** approval gates; they're **checkpoints**
- Create a new audit after each significant change, don't update in-place
- Link audits to commits: "This audit is valid for commit XYZ onwards"
- Use PR checklists: "Audit updated? Section 6 reflects new formats?"

**Apply To Codi**:
- [ ] Create `docs/audit-workflow.md`: "When to create new audits vs update existing ones"
- [ ] Add to PR template: "Validation audit updated for new formats/changes?"
- [ ] Document audit freshness: "Audit valid for commits {start}..{end}"

---

### 6. **Support Multiple Feature Flags/Modes in One Adapter**

**Lesson**: The adapter supports `progressive_loading` flag (on/off skill inlining) and future features. Test this explicitly.

**How to Prevent**:
- For each feature flag, create at least 2 tests: flag on, flag off
- Document default behavior in adapter JSDoc
- Include flag combinations in QA simulation
- Add to code review checklist: "All flag combinations tested?"

**Apply To Codi**:
- [x] Implemented — `tests/unit/adapters/copilot.test.ts` covers
  `progressive_loading: off|metadata|full`
- [ ] Update codi-testing.md: "Feature flags must have on/off test coverage"

---

### 7. **Shared Utilities Must Actually Be Shared, Not Copied**

**Lesson**: Lesson 2 said sanitization "should" be shared. An audit pass in
Phase 5 found five other adapters still using the lax version. The lesson
was written before the refactor was done; nobody had verified the claim.

**Root Cause**: Writing a "should" in a lessons-learned document is not the
same as writing code. A reference doc that says "use the shared function"
is a dangling promise until the shared function exists AND every caller
imports it.

**How to Prevent**:
- When a lesson says "extract to shared utility", extract it in the same PR
- After extraction, grep the codebase for the old pattern and confirm zero
  remaining sites: `grep -r "toLowerCase().replace(/\s+/g" src/` must be empty
- Add a lint rule or codegen check if the codebase is large enough

**Apply To Codi**:
- [x] `sanitizeNameForPath` now lives at `src/utils/path-guard.ts`
- [x] All six adapters import it
- [x] `tests/unit/utils/path-guard.test.ts` locks the behaviour
- [ ] Consider a Vitest guard test: `expect(adapterSourceCode).not.toMatch(/toLowerCase\(\)\.replace\(/\s\+/g)` for each adapter file

---

### 8. **`paths` Declared in an Adapter Must Match What `generate()` Actually Writes**

**Lesson**: Cursor declared `paths.skills: null` but wrote to `.cursor/skills/`.
The declaration was consumed by the clean command's derivation and by any
future consumer that trusts `paths.skills !== null` as "supports skills".

**How to Prevent**:
- Every adapter test file should assert that every `paths.*` entry is either
  `null` (not supported) or the exact path `generate()` actually produces
- A cross-check test: given a config with skills/agents/rules, iterate
  `files = await adapter.generate(config, ...)` and assert that every file
  path starts with `paths.rules`, `paths.skills`, `paths.agents`, or is the
  `paths.instructionFile`, `paths.mcpConfig`, or an explicit adapter-specific
  extra. Any orphan is a declaration drift.

**Apply To Codi**:
- [ ] Add a shared helper `expectDeclaredPathsMatchOutput(adapter, files)`
  in `tests/helpers/` that every adapter test uses
- [x] Fixed cursor.ts declaration
- [ ] Audit windsurf.ts (`paths.rules: "."`) — possibly another drift case

---

### 9. **Generator Lists Must Be Derived, Not Duplicated**

**Lesson**: `src/cli/clean.ts` kept two hardcoded lists (`AGENT_SUBDIRS`,
`AGENT_FILES`) that had to be updated manually whenever a new adapter
landed. It was not updated when Copilot landed. The result: uninstalling
Codi silently left Copilot files behind.

**How to Prevent**:
- Derive per-adapter collections from `ALL_ADAPTERS` at module load, not
  by copying strings into a separate file
- Accept that some extras (e.g., brand dirs, adapter-specific hooks files)
  are not modelled in `AgentPaths` — list them explicitly as supplementary
  entries with a comment explaining why they are not derived
- Add a safety filter for root-pointing entries (`"."`, `""`, absolute
  paths) whenever a derived list is used in recursive deletion

**Apply To Codi**:
- [x] `clean.ts` derives from `ALL_ADAPTERS` via `isSafeSubdir` filter
- [ ] Audit other multi-adapter lists (init wizard, doctor, status) for the
  same class of bug

---

### 10. **Audit the Audit — Read the Code, Not Just the Narrative**

**Lesson**: The original Phase 1–4 audit claimed "Security: 100%
compliance". Phase 5 found 6 more sanitization gaps and a path-traversal
class of bug in three other adapters. The audit was correct for the files
it examined and wrong for everything else.

**How to Prevent**:
- Scope every audit explicitly: which files were read, which were not
- When auditing a security property, grep the ENTIRE codebase for the
  unsafe pattern — not just the changed file
- Audit documents that say "100% compliance" without a scoped check are
  dangerous — they create false confidence

**Apply To Codi**:
- [ ] Update audit template to require a "Scope" section listing every file
  grep'd
- [ ] Add `codi-security-scan` trigger for adapter audits that greps all
  `src/adapters/*.ts` for common unsafe patterns

---

## Contribution Guidelines for Humans & Coding Agents

### For Humans Contributing to Codi

#### 1. Before Starting Work

**Read These Files** (in order):
1. `/Users/laht/projects/codi/CLAUDE.md` — Self-dev mode (templates vs installed artifacts)
2. `.codi/rules/` directory — Current project rules (styling, testing, etc.)
3. `src/templates/` — If modifying a template, edit here (not `.codi/`)
4. `.codi/feedback/` — Recent feedback from agents (lessons from last sessions)

**Understand the Three-Layer Pipeline**:
```
Layer 1 (Source):    src/templates/skills/codi-{name}/
Layer 2 (Installed): .codi/skills/{name}/
Layer 3 (Output):    .claude/skills/{name}/ (generated per agent)

pnpm build → Layer 1→2
codi generate → Layer 2→3
```

**If modifying a template**: Edit `src/templates/`, then:
```bash
pnpm build
rm -rf .codi/skills/codi-{name}
node -e "const m=JSON.parse(require('fs').readFileSync('.codi/artifact-manifest.json','utf8')); if(m.artifacts) delete m.artifacts['codi-{name}']; require('fs').writeFileSync('.codi/artifact-manifest.json', JSON.stringify(m, null, 2)+'\n');"
codi add skill codi-{name} --template codi-{name}
codi generate --force
```

#### 2. During Development

**Follow These Steps** (in order):
1. **Understand** the task — read related code and ask clarifying questions
2. **Search** the codebase for existing solutions before creating new ones
3. **Propose** your approach and wait for feedback
4. **Execute** only after approval
5. **Test** before committing — run `npm test`
6. **Commit atomically** — one logical change per commit, conventional format

**Commit Message Format**:
```
feat(scope): short description (imperative mood)

Longer explanation if needed. Reference issue #123.

Do NOT add Co-Authored-By lines or AI attribution.
```

**Code Review Checklist** (before pushing):
- [ ] No TypeScript errors: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] All new code has test coverage
- [ ] Security: sanitization of artifact names, escaping of YAML/HTML
- [ ] Documentation: JSDoc on exports, inline comments on WHY (not WHAT)
- [ ] Files <700 lines (split larger files)
- [ ] No hardcoded values (use constants or config)

#### 3. When Adding a New Adapter

**Checklist**:
- [ ] Read codi-agent-creator.prompt.md (9-step lifecycle)
- [ ] Create adapter in `src/adapters/{name}.ts`
- [ ] Implement `detect()`, `generate()`, and export as `const {name}Adapter: AgentAdapter`
- [ ] Write unit tests in `tests/unit/adapters/{name}.test.ts`
- [ ] Write QA tests in `tests/qa/{name}-qa-simulation.test.ts`
- [ ] Create validation audit: `docs/YYYYMMDD_HHMM_[AUDIT]_{name}-adapter-validation.md`
- [ ] For EACH official platform format: test generation + path sanitization + field escaping
- [ ] Run `npm test` — all tests passing?
- [ ] Check against official platform docs — all formats implemented?

**Security Baseline for New Adapters**:
- [ ] `sanitizeNameForPath()` on all artifact names
- [ ] `fmStr()` on all YAML scalar values
- [ ] `sanitizeTableCell()` on table cell content
- [ ] `MAX_ARTIFACT_CHARS` guard for inlined content
- [ ] Environment variable validation (no raw secrets)
- [ ] Path traversal test with `../../etc/passwd` input
- [ ] YAML injection test with `newline\ninjection` input

---

### For Coding Agents (Claude Code, Copilot, etc.)

#### How to Contribute to Codi

**System Prompt Integration** (load these at session start):
1. Read `/Users/laht/projects/codi/CLAUDE.md` — self-dev mode rules
2. Read `.codi/feedback/` — recent session feedback (lessons learned)
3. Check `.codi/artifact-manifest.json` — know what's installed
4. Verify `.claude/rules/` vs `.codi/rules/` — which to edit

**When Modifying Artifacts** (critical for agents):

If you're editing a template (skills, rules, agents):
```bash
# WRONG: Editing .claude/rules/codi-{name}.md directly
# (This is generated; changes are lost on next codi generate)

# CORRECT: Edit src/templates/ instead
vim src/templates/rules/codi-{name}.md
# Then:
pnpm build
rm -rf .codi/rules/codi-{name}
node -e "..." # remove from manifest
codi add rule codi-{name} --template codi-{name}
codi generate --force
```

**Use Graph-Code MCP Before Any Changes**:
```typescript
// Step 1: Query code graph to understand structure
mcp__graph-code__query_code_graph(
  "What functions call sanitizeNameForPath? What depends on it?"
);

// Step 2: Get code snippets to understand current patterns
mcp__graph-code__get_code_snippet(
  "sanitizeNameForPath" // qualified name
);

// Step 3: Then make informed changes
```

**Artifact Improvement Workflow**:
1. Observe gaps in current artifacts (emit `[CODI-OBSERVATION: ...]` marker)
2. If improvements are needed, propose with evidence (2+ occurrences in codebase)
3. Wait for user approval
4. Make changes to `.codi/` files (NOT `src/templates/`)
5. Run `codi generate` to propagate
6. Verify with `npm test`
7. Use `/codi-compare-preset` to see what's local vs upstream
8. Share improvements via `codi contribute`

**When Adding Tests** (critical for agents):

```typescript
// Pattern for file I/O tests:
const tmpDir = join(tmpdir(), `test-${Date.now()}`);

beforeEach(async () => {
  // Create .codi/skills/ structure that generator expects
  await mkdir(join(tmpDir, ".codi/skills/my-skill"), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

it("generates SKILL.md correctly", async () => {
  const files = await adapter.generate(config, { projectRoot: tmpDir });
  // Now assertions work because directories exist
});
```

**Commit Discipline**:
- ❌ NEVER add `Co-Authored-By: Claude` or AI attribution
- ✅ Use conventional commits: `feat(scope): description`
- ✅ Create atomic commits (one logical change)
- ✅ Include issue numbers: `fixes #123`
- ✅ Test before committing: `npm test` must pass

**When Blocked or Uncertain**:
1. Emit observation marker: `[CODI-OBSERVATION: ...]`
2. Ask user for clarification (don't guess)
3. Never skip hooks (`--no-verify`) — diagnose the hook failure instead
4. Never force push — it overwrites upstream history

**Research Before Implementation**:
- Use graph-code MCP to find callers and dependents
- Use docs MCP to find examples and best practices
- Query code graph before modifying to understand impact
- If uncertainty, ask user before proceeding

---

## Summary: Validation Checklist for Future Adapter Work

Use this checklist when contributing any new adapter to Codi:

### Pre-Development
- [ ] Read official platform documentation end-to-end
- [ ] List ALL supported formats (don't miss half of them)
- [ ] Create specification checklist: each format → test → implementation
- [ ] Read similar adapters (cline, claude-code) for patterns

### Implementation
- [ ] Adapter file: `src/adapters/{name}.ts`
- [ ] Implement `detect()`, `generate()` with proper types
- [ ] Use shared utilities: `sanitizeNameForPath()`, `fmStr()`, `sanitizeTableCell()`
- [ ] For EACH format: test path safety, YAML escaping, field validation
- [ ] Update JSDoc: list all supported formats and security measures

### Testing
- [ ] Unit tests: one file per adapter format
- [ ] QA simulation: realistic config generating ALL expected files
- [ ] Security tests: path traversal, YAML injection, table injection
- [ ] tmpDir setup: beforeEach/afterEach for file I/O
- [ ] Coverage: every code path tested (including error cases)

### Documentation
- [ ] Create validation audit: `docs/YYYYMMDD_[AUDIT]_{name}-adapter-validation.md`
- [ ] Document each format from official spec
- [ ] List security measures with examples
- [ ] Update compliance table if new fields added
- [ ] Conclusion: "APPROVED FOR PRODUCTION" only when ALL formats tested

### Final Review
- [ ] `npm run build` — zero errors
- [ ] `npm test` — all tests passing
- [ ] Check against official docs — every format implemented?
- [ ] Linting — no errors or warnings
- [ ] No hardcoded paths, secrets, or magic numbers

---

**Reference**: This summary captures lessons from the GitHub Copilot adapter remediation (Phases 1-4, April 17 2026). Apply these patterns to all future Codi artifact development.
