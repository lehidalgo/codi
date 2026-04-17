import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Git workspace setup for feature development. Use before executing an
  implementation plan, when the user wants a clean workspace, when parallel
  features need isolation, or when dirty local changes must be preserved.
  Also activate for phrases like "git worktree", "new branch for feature",
  "workspace isolation", "parallel feature work", "feature branch setup",
  "before plan-executor", "before subagent-dev", "clean workspace",
  "isolate this feature". Evaluates worktree vs simple branch and sets
  up the chosen option. Do NOT activate for finishing a branch (use
  ${PROJECT_NAME}-branch-finish), committing changes (use
  ${PROJECT_NAME}-commit), executing the plan itself (use
  ${PROJECT_NAME}-plan-executor or ${PROJECT_NAME}-subagent-dev), or
  resolving merge conflicts.
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 6
---

# {{name}} — Worktrees

**Announce at start:** "I'm using ${PROJECT_NAME}-worktrees to choose an isolation strategy."

## When to Activate

- Before ${PROJECT_NAME}-plan-executor and ${PROJECT_NAME}-subagent-dev begin task execution
- User wants to work on a feature without touching the main working tree
- User has multiple features in parallel that need isolation

## Skip When

- User wants to finish or merge a branch — use ${PROJECT_NAME}-branch-finish
- User wants to commit staged changes — use ${PROJECT_NAME}-commit
- User wants to execute the implementation plan — use ${PROJECT_NAME}-plan-executor or ${PROJECT_NAME}-subagent-dev
- User wants to resolve merge conflicts — handle those in the existing tree, not a new workspace
- Change is trivial (typo fix, single-line) and no plan exists — just edit directly

## Step 0: Isolation Strategy Decision

Before setting up any workspace, evaluate whether a **worktree** or a **simple branch** is the right approach. Do not assume worktrees are always needed.

### Gather context

\\\`\\\`\\\`bash
git status --porcelain        # check for uncommitted changes
git worktree list             # check for existing worktrees
\\\`\\\`\\\`

Also assess task scope: is this a small targeted change or a large multi-task plan?

### Decision criteria

**Recommend a simple branch when:**
- The change is small (bug fix, config tweak, single feature with few tasks)
- The working tree is clean and no parallel work is active
- The execution method is ${PROJECT_NAME}-plan-executor (sequential, same working tree is fine)
- No uncommitted experiments need to be preserved in the current tree

**Recommend a worktree when:**
- Multiple features need to run in parallel simultaneously
- The working tree has uncommitted work the user wants to preserve
- The execution method is ${PROJECT_NAME}-subagent-dev (subagents benefit from path isolation)
- The plan has many tasks (roughly 5+) and long-running isolation is valuable
- User explicitly asked for a worktree

### Ask the user

Present your recommendation with one-line reasoning, then ask:

\\\`\\\`\\\`
I recommend a [worktree / simple branch] for this task because [one-line reason].
Proceed with [worktree / branch], or would you prefer the other approach?
\\\`\\\`\\\`

Wait for the user's answer before continuing.

---

## Path A: Simple Branch

If the user chooses a simple branch:

\\\`\\\`\\\`bash
git checkout -b <branch-name>
\\\`\\\`\\\`

Branch naming: follow ${PROJECT_NAME}-git-workflow rule conventions (\\\`feature/\\\`, \\\`fix/\\\`, \\\`chore/\\\` prefix).

Report:

\\\`\\\`\\\`
Branch <branch-name> created. Ready to work.
\\\`\\\`\\\`

Skip Steps 1-5 below. The working tree is already set up.

---

## Path B: Worktree

If the user chooses a worktree, continue with Steps 1-5.

## Step 1: Directory Selection

Check in this priority order:
1. Does \\\`.worktrees/\\\` exist in the project root? Use it (verify it is gitignored first)
2. Does \\\`worktrees/\\\` exist? Use it (verify gitignored)
3. Is there a worktree directory preference in \\\`CLAUDE.md\\\`? Use that
4. Otherwise: ask the user to choose between \\\`.worktrees/<branch>\\\` (project-local, hidden) or \\\`~/.config/worktrees/<project>/<branch>\\\` (global)

## Step 2: Safety Verification

For project-local directories (\\\`.worktrees/\\\`, \\\`worktrees/\\\`):
\\\`\\\`\\\`bash
git check-ignore -q .worktrees 2>/dev/null || echo "NOT IGNORED"
\\\`\\\`\\\`
If NOT ignored: add to \\\`.gitignore\\\` immediately and commit that change before creating the worktree. This prevents worktree artifacts from polluting the repo.

## Step 3: Create the Worktree

\\\`\\\`\\\`bash
git worktree add <path> -b <branch-name>
cd <path>
\\\`\\\`\\\`
Branch naming: follow ${PROJECT_NAME}-git-workflow rule conventions (\\\`feature/\\\`, \\\`fix/\\\`, \\\`chore/\\\` prefix).

## Step 4: Project Setup

Auto-detect and run the project setup command:
\\\`\\\`\\\`bash
# Node.js / pnpm (check pnpm-lock.yaml)
pnpm install

# Node.js / npm (check package-lock.json)
npm install

# Rust
cargo build

# Python / uv (check pyproject.toml)
uv sync

# Python / pip (check requirements.txt)
pip install -r requirements.txt

# Go
go mod download
\\\`\\\`\\\`

## Step 5: Baseline Verification

Run the test suite to confirm a clean starting point:
\\\`\\\`\\\`bash
pnpm test   # or npm test / cargo test / pytest / go test ./...
\\\`\\\`\\\`
Report results. If tests fail:
- Do NOT proceed
- Report failures to the user
- Ask: "The baseline has failing tests. Do you want to fix them first, or proceed knowing the baseline is broken?"

Only proceed if the user explicitly says to continue with a broken baseline.

## Status Report (Path B)

After successful worktree setup:
\\\`\\\`\\\`
Worktree ready at <full-path>
Branch: <branch-name>
Tests: <N> passing, 0 failing
Ready to execute the implementation plan.
\\\`\\\`\\\`

## Cleanup

Worktrees are cleaned up by ${PROJECT_NAME}-branch-finish after work is complete:
- Merge/discard: worktree removed
- Keep branch / create PR: worktree preserved

## Example Workflow

**Path A example (simple branch):**
\\\`\\\`\\\`
You: I'm using ${PROJECT_NAME}-worktrees to choose an isolation strategy.

[git status --porcelain - clean]
[git worktree list - only main]
[Task scope: single bug fix, 2 files]

I recommend a simple branch for this task because it is a small targeted fix
and the working tree is clean.
Proceed with branch, or would you prefer a worktree?

User: branch

git checkout -b fix/null-check
Branch fix/null-check created. Ready to work.
\\\`\\\`\\\`

**Path B example (worktree):**
\\\`\\\`\\\`
You: I'm using ${PROJECT_NAME}-worktrees to choose an isolation strategy.

[git status --porcelain - 3 modified files]
[Task scope: large plan, 8 tasks, ${PROJECT_NAME}-subagent-dev]

I recommend a worktree because the working tree has uncommitted changes and
subagent execution benefits from path isolation.
Proceed with worktree, or would you prefer a simple branch?

User: worktree

[Check .worktrees/ - exists]
[Verify ignored - git check-ignore confirms .worktrees/ is ignored]
[Create worktree: git worktree add .worktrees/auth -b feature/auth]
[Run pnpm install]
[Run pnpm test - 47 passing]

Worktree ready at /path/to/project/.worktrees/auth
Branch: feature/auth
Tests: 47 passing, 0 failing
Ready to execute the implementation plan.
\\\`\\\`\\\`

## Red Flags

**Never:**
- Skip Step 0 and jump straight to worktree creation
- Create a worktree for a single-file change when the working tree is clean
- Create a worktree without verifying it is gitignored (project-local)
- Skip baseline test verification (Path B)
- Proceed with failing tests without asking the user
- Assume directory location when ambiguous
- Skip CLAUDE.md check

**Always:**
- Assess task scope and working tree state before recommending an approach
- Ask the user before proceeding with either path
- Follow directory priority (Path B): existing > CLAUDE.md > ask
- Verify directory is ignored for project-local locations (Path B)
- Auto-detect and run project setup (Path B)
- Verify a clean test baseline before reporting ready (Path B)

## Quick Reference

| Situation | Recommended path |
|-----------|-----------------|
| Small change, clean tree | Simple branch |
| Large plan (5+ tasks) | Worktree |
| ${PROJECT_NAME}-subagent-dev execution | Worktree |
| Uncommitted work to preserve | Worktree |
| User asks for worktree | Worktree |
| \\\`.worktrees/\\\` exists (Path B) | Use it (verify gitignored) |
| \\\`worktrees/\\\` exists (Path B) | Use it (verify gitignored) |
| Both exist (Path B) | Use \\\`.worktrees/\\\` |
| Neither exists (Path B) | Check CLAUDE.md then ask |
| Directory not gitignored (Path B) | Add to .gitignore and commit first |
| Tests fail during baseline (Path B) | Report failures and ask the user |
| No package.json/Cargo.toml (Path B) | Skip dependency install |

## Common Mistakes

- Skipping the decision step and creating a worktree by default (over-engineering)
- Creating a worktree in a directory that is not gitignored (pollutes the repo)
- Skipping baseline test verification on Path B (cannot distinguish new failures from existing ones)
- Hardcoding the setup command (always auto-detect from project files)
`;
