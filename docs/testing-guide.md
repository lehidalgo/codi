# Codi E2E Testing Guide
**Date**: 2026-03-23
**Document**: testing-guide.md

This guide provides a comprehensive step-by-step procedure for validating a codi installation end-to-end. Each step is labeled with an action type:

- **[SYSTEM]** — automated CLI command (can be run by a testing skill or human)
- **[HUMAN]** — requires manual human interaction (wizard prompts, opening an IDE, visual verification)
- **[CODING AGENT]** — requires an AI coding agent to perform and observe

---

## Prerequisites

Before starting, ensure the following are installed:

| Requirement | Minimum Version | Check Command |
|-------------|----------------|---------------|
| Node.js | 20.x | `node --version` |
| npm | 9.x | `npm --version` |
| Git | 2.x | `git --version` |
| codi-cli | latest | `npx codi --version` or local build |

---

## Suite 1: Project Setup

### Step 1.1 — Create a fresh test project
**[SYSTEM]**
```bash
mkdir /tmp/codi-e2e-test && cd /tmp/codi-e2e-test
git init
echo '{}' > package.json
echo 'node_modules/' > .gitignore
```
**Expected**: Empty git repository with a minimal `package.json`.

### Step 1.2 — Install codi locally
**[SYSTEM]**
```bash
npm install --save-dev <path-to-codi-repo-or-npm-package>
```
**Expected**: `codi` appears in `devDependencies`. `npx codi --version` prints a version string.

### Step 1.3 — Verify CLI is accessible
**[SYSTEM]**
```bash
npx codi --help
```
**Expected**: Help output listing available commands: `init`, `generate`, `validate`, `status`, `add`, `verify`, `doctor`, `update`, `clean`, `compliance`, `watch`, `ci`, `revert`, `marketplace`, `preset`.

---

## Suite 2: Initialization

### Step 2.1 — Non-interactive init with flags
**[SYSTEM]**
```bash
npx codi init --agents claude-code,cursor --preset balanced
```
**Expected**:
- `.codi/` directory created with `config.json`
- Config contains `agents: ["claude-code", "cursor"]` and `preset: "balanced"`
- Default rules are scaffolded into `.codi/rules/`

### Step 2.2 — Verify config file structure
**[SYSTEM]**
```bash
cat .codi/config.json
```
**Expected**: Valid JSON with keys: `agents`, `rules`, `skills`, `preset`, `version`.

### Step 2.3 — Clean and test interactive wizard
**[SYSTEM]**
```bash
npx codi clean --all
```
**[HUMAN]**
```bash
npx codi init
```
**Expected**: Interactive wizard prompts for:
1. Agent selection (with auto-detection)
2. Rule selection (all selected by default)
3. Skill selection
4. Preset choice (balanced/minimal/strict)
5. Version pinning toggle

Select at least one agent, a few rules, and confirm. Verify `.codi/config.json` matches your selections.

---

## Suite 3: Artifact Management

### Step 3.1 — Add a rule from template
**[SYSTEM]**
```bash
npx codi add rule security --template security
```
**Expected**:
- File created at `.codi/rules/security.md`
- Frontmatter contains `managed_by: codi`
- Content matches the security rule template

### Step 3.2 — Add a rule without template (custom)
**[SYSTEM]**
```bash
npx codi add rule my-custom-rule
```
**Expected**:
- File created at `.codi/rules/custom/my-custom-rule.md`
- Frontmatter contains `managed_by: user`
- Body is a blank scaffold ready for editing

### Step 3.3 — Add all rules
**[SYSTEM]**
```bash
npx codi add rule --all
```
**Expected**: All available template rules are created in `.codi/rules/`. Each has `managed_by: codi`.

### Step 3.4 — Add a skill from template
**[SYSTEM]**
```bash
npx codi add skill codi-operations --template codi-operations
```
**Expected**:
- File created in `.codi/skills/`
- Frontmatter contains `managed_by: codi`

### Step 3.5 — Add a skill without template
**[SYSTEM]**
```bash
npx codi add skill my-custom-skill
```
**Expected**:
- File created with `managed_by: user`
- Blank scaffold content

### Step 3.6 — Add an agent
**[SYSTEM]**
```bash
npx codi add agent code-reviewer --template code-reviewer
```
**Expected**:
- File created in `.codi/agents/`
- Frontmatter contains `managed_by: codi`

### Step 3.7 — Add a command from template
**[SYSTEM]**
```bash
npx codi add command review --template review
```
**Expected**:
- File created in `.codi/commands/review.md`
- Frontmatter contains `managed_by: codi`

### Step 3.8 — Add all commands
**[SYSTEM]**
```bash
npx codi add command --all
```
**Expected**: All available command templates created (review, test-run).

### Step 3.9 — Verify managed_by distinction
**[SYSTEM]**
```bash
grep -r 'managed_by' .codi/rules/ .codi/skills/ .codi/agents/ .codi/commands/
```
**Expected**: Template-based artifacts show `managed_by: codi`, custom artifacts show `managed_by: user`.

---

## Suite 4: Generation & Output Verification

### Step 4.1 — Generate all adapter configs
**[SYSTEM]**
```bash
npx codi generate
```
**Expected**: Output lists each adapter file generated. No errors.

### Step 4.2 — Verify Claude Code output
**[SYSTEM]**
```bash
cat CLAUDE.md
```
**Expected**:
- Contains `## Permissions` section
- Contains `## Configuration` section listing rules, skills, agents
- Contains `## Codi Verification` section with a verification token
- Rules content is embedded

### Step 4.3 — Verify Cursor output
**[SYSTEM]**
```bash
cat .cursorrules
ls .cursor/rules/
```
**Expected**:
- `.cursorrules` file exists with project instructions
- `.cursor/rules/` contains individual rule files if applicable

### Step 4.4 — Verify Codex output (if configured)
**[SYSTEM]**
```bash
cat AGENTS.md
```
**Expected**: Contains agent instructions and rule content formatted for Codex.

### Step 4.5 — Test drift detection
**[SYSTEM]**
```bash
echo "# Modified" >> CLAUDE.md
npx codi status
```
**Expected**: Status output reports drift detected for `CLAUDE.md`. File hash does not match expected.

### Step 4.6 — Regenerate after drift
**[SYSTEM]**
```bash
npx codi generate
npx codi status
```
**Expected**: After regeneration, status reports no drift. All files are in sync.

---

## Suite 5: Verification & Compliance

### Step 5.1 — Verify in show mode
**[SYSTEM]**
```bash
npx codi verify
```
**Expected**: Displays verification token, lists rules, skills, and agents. Token is exactly 12 hex characters prefixed with `codi-`.

### Step 5.2 — Verify token is deterministic
**[SYSTEM]**
```bash
TOKEN1=$(npx codi verify --json | grep -o '"token":"[^"]*"')
TOKEN2=$(npx codi verify --json | grep -o '"token":"[^"]*"')
[ "$TOKEN1" = "$TOKEN2" ] && echo "PASS: Token is deterministic" || echo "FAIL: Token changed"
```
**Expected**: `PASS: Token is deterministic`.

### Step 5.3 — Verify in check mode
**[SYSTEM]**
```bash
npx codi verify --check
```
**Expected**: Exit code 0. Output confirms all verification checks pass.

### Step 5.4 — Compliance report
**[SYSTEM]**
```bash
npx codi compliance
```
**Expected**: Outputs a compliance summary listing all rules and their adoption status.

### Step 5.5 — Doctor diagnostics
**[SYSTEM]**
```bash
npx codi doctor
```
**Expected**: All checks pass (config valid, files exist, no orphaned artifacts).

### Step 5.6 — Verify token format
**[CODING AGENT]**
Ask the coding agent: "verify codi"
**Expected**: Agent responds with the verification token from CLAUDE.md and lists the configured rules, skills, and agents.

---

## Suite 6: Update & Presets

### Step 6.1 — Switch preset from balanced to strict
**[SYSTEM]**
```bash
npx codi update --preset strict
npx codi generate
```
**Expected**: Config updated to `preset: "strict"`. Regenerated files reflect strict preset flags.

### Step 6.2 — Switch preset back to balanced
**[SYSTEM]**
```bash
npx codi update --preset balanced
npx codi generate
```
**Expected**: Config reverts to `preset: "balanced"`.

### Step 6.3 — Refresh rules from templates
**[SYSTEM]**
```bash
npx codi update --rules
```
**Expected**: All `managed_by: codi` rules are refreshed to latest template content. `managed_by: user` rules are untouched.

### Step 6.4 — Verify user artifacts are preserved
**[SYSTEM]**
```bash
cat .codi/rules/custom/my-custom-rule.md
```
**Expected**: Custom rule content is unchanged after update. `managed_by: user` is still set.

### Step 6.5 — Refresh skills and agents
**[SYSTEM]**
```bash
npx codi update --skills --agents
```
**Expected**: Template-managed skills and agents are refreshed. User-managed ones are preserved.

---

## Suite 7: Clean & Reinstall

### Step 7.1 — Clean generated files only
**[SYSTEM]**
```bash
npx codi clean
```
**Expected**:
- Generated adapter files removed (CLAUDE.md, .cursorrules, AGENTS.md, etc.)
- `.codi/` directory and config preserved

### Step 7.2 — Verify config is preserved
**[SYSTEM]**
```bash
cat .codi/config.json
```
**Expected**: Config file still exists with previous settings.

### Step 7.3 — Regenerate after clean
**[SYSTEM]**
```bash
npx codi generate
```
**Expected**: All adapter files regenerated successfully.

### Step 7.4 — Full uninstall
**[SYSTEM]**
```bash
npx codi clean --all
```
**Expected**:
- All generated files removed
- `.codi/` directory removed entirely
- No codi artifacts remain in the project

### Step 7.5 — Verify full removal
**[SYSTEM]**
```bash
ls -la .codi/ 2>&1
ls CLAUDE.md .cursorrules AGENTS.md 2>&1
```
**Expected**: All paths report "No such file or directory".

### Step 7.6 — Reinstall from scratch
**[SYSTEM]**
```bash
npx codi init --agents claude-code --preset balanced
npx codi generate
```
**Expected**: Fresh installation succeeds. All files generated correctly.

---

## Suite 8: Agent Integration

### Step 8.1 — Claude Code loads config
**[HUMAN]**
1. Open the test project in a terminal with Claude Code
2. Ask Claude Code: "verify codi"
3. Verify it responds with the verification token and lists rules/skills/agents

**Expected**: Claude Code reads CLAUDE.md and responds with correct verification data.

### Step 8.2 — Cursor loads rules
**[HUMAN]**
1. Open the test project in Cursor IDE
2. Start a new chat session
3. Ask: "What coding rules are configured for this project?"

**Expected**: Cursor references the rules from `.cursorrules` or `.cursor/rules/`.

### Step 8.3 — Codex loads agents
**[HUMAN]**
1. Run Codex CLI in the test project directory
2. Ask: "What agents are available in this project?"

**Expected**: Codex reads AGENTS.md and references the configured agents.

### Step 8.4 — Windsurf loads config
**[HUMAN]**
1. Open the test project in Windsurf (if configured)
2. Verify `.windsurfrules` is recognized

**Expected**: Windsurf loads the rules file and applies configured rules.

---

## Validation Checkpoints

| Suite | Key Validation | Pass Criteria |
|-------|---------------|---------------|
| 1. Setup | CLI accessible | `codi --help` prints usage |
| 2. Init | Config created | `.codi/config.json` is valid JSON with correct structure |
| 3. Artifacts | Files created with correct managed_by | Template = `codi`, custom = `user` |
| 4. Generate | All adapter files created, no drift | `codi status` reports clean |
| 5. Verify | Token correct, compliance passes | Token is `codi-` + 12 hex chars, deterministic |
| 6. Update | Preset switch works, user artifacts safe | Config updates, custom rules unchanged |
| 7. Clean | Full removal and reinstall works | No artifacts after `--all`, clean reinstall |
| 8. Integration | Agents load config | Each agent responds with verification data |

---

## Failure Signals

The following indicate something is broken:

### Critical Failures
- `codi init` crashes or produces invalid JSON config
- `codi generate` produces empty or malformed adapter files
- Verification token changes between runs (not deterministic)
- `codi clean --all` leaves orphaned files

### Functional Failures
- `managed_by: user` artifacts are overwritten by `codi update`
- Drift detection does not catch manually modified files
- Preset switch does not change generated output
- `codi doctor` reports errors on a clean installation

### Integration Failures
- Claude Code cannot find or parse CLAUDE.md
- Cursor does not load `.cursorrules`
- Agent responds with wrong or missing verification token

### Recovery Steps
1. Run `codi doctor` to identify configuration issues
2. Run `codi status` to check for drift
3. Run `codi generate` to regenerate all files
4. If persistent, run `codi clean --all` and reinitialize
