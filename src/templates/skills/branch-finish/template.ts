import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Development branch completion. Use when implementation is complete and the branch
  needs to be merged, submitted as a PR, kept, or discarded. Verifies tests, presents
  four deterministic options, and cleans up worktrees.
category: Developer Workflow
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}}

**Announce at start:** "I'm using ${PROJECT_NAME}-branch-finish to complete this work."

## When to Activate

- After ${PROJECT_NAME}-subagent-dev or ${PROJECT_NAME}-plan-executor completes all tasks
- User says implementation is done and wants to merge or submit
- User wants to clean up a worktree after development
- User used a simple branch (via ${PROJECT_NAME}-worktrees Path A) and is ready to merge or submit

## Hard Gate: Tests Must Pass

Before presenting any options, run the full test suite:

\\\`\\\`\\\`bash
pnpm test   # or appropriate test command for this project
\\\`\\\`\\\`

Use ${PROJECT_NAME}-verification: read the full output, confirm all tests pass.

If tests fail: "Cannot proceed. Tests are failing: <list failing tests>. Fix the failures before finishing the branch."
Do NOT offer merge or PR options with failing tests.

## Determine Base Branch

Before presenting options, identify the base branch this feature branched from:

\\\`\\\`\\\`bash
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
\\\`\\\`\\\`

If ambiguous, ask: "This branch split from main - is that correct?"

## The Four Options

After tests pass, present EXACTLY these four options to the user — no others:

\\\`\\\`\\\`
Tests passing. How would you like to finish this branch?

1. Merge locally — integrate into <base-branch> and delete the feature branch
2. Create PR — push branch and open a pull request for review
3. Keep as-is — preserve the branch and worktree for later
4. Discard — permanently delete the branch and all changes
\\\`\\\`\\\`

Wait for the user's choice. Do not proceed until a choice is made.

## Option 1: Merge Locally

\\\`\\\`\\\`bash
git checkout <base-branch>
git merge --no-ff <feature-branch> -m "feat(scope): description"
git branch -d <feature-branch>
\\\`\\\`\\\`

Then remove the worktree:

\\\`\\\`\\\`bash
git worktree remove <worktree-path>
\\\`\\\`\\\`

Invoke ${PROJECT_NAME}-commit if the merge message needs refinement. Report: "Merged into <base-branch>. Worktree cleaned up."

## Option 2: Create PR

\\\`\\\`\\\`bash
git push origin <feature-branch>
gh pr create --title "<title>" --body "<body>"
\\\`\\\`\\\`

Follow ${PROJECT_NAME}-git-workflow conventions for PR title (conventional commit format, under 70 chars).
Body should include: Summary (3 bullet points), Test plan (checklist), and relevant design spec link.
Do NOT remove the worktree (user may need to continue work after review feedback).
Report: PR URL.

## Option 3: Keep As-Is

No git operations. Do NOT remove the worktree.
Report: "Branch <name> preserved at <worktree-path>."

## Option 4: Discard

This is destructive and irreversible. Require explicit confirmation:

> "This will permanently delete the branch and all changes. Type 'discard' to confirm."

Wait for the user to type "discard" (exact word). If they type anything else: "Aborted. Branch preserved."

Only after "discard" confirmation:

\\\`\\\`\\\`bash
git checkout <base-branch>  # if currently on feature branch
git worktree remove <worktree-path>
git branch -D <feature-branch>
\\\`\\\`\\\`

Report: "Branch discarded. All changes deleted."

## Quick Reference

| Option | Merge | Push | Keep Worktree | Delete Branch |
|--------|-------|------|---------------|---------------|
| 1. Merge locally | yes | - | - | yes (soft delete) |
| 2. Create PR | - | yes | yes | - |
| 3. Keep as-is | - | - | yes | - |
| 4. Discard | - | - | - | yes (force delete) |

## Common Mistakes

**Skipping test verification**
- Problem: merging broken code or creating a failing PR
- Fix: always run the full test suite before offering any option

**Open-ended questions**
- Problem: "What should I do next?" is ambiguous and unhelpful
- Fix: present exactly the four structured options above

**Automatic worktree cleanup for PR/keep**
- Problem: removing the worktree when the user may need it for review feedback
- Fix: only clean up the worktree for Options 1 and 4

**No confirmation for discard**
- Problem: accidentally deleting irreversible work
- Fix: require the user to type "discard" exactly before proceeding

## Red Flags

**Never:**
- Proceed with failing tests
- Merge without re-verifying tests on the merged result
- Delete work without typed confirmation
- Force-push without explicit user request

**Always:**
- Verify tests before offering options
- Present exactly four options - no others
- Get typed "discard" confirmation for Option 4
- Clean up worktree for Options 1 and 4 only

## Integration

- Called by: ${PROJECT_NAME}-subagent-dev, ${PROJECT_NAME}-plan-executor
- Uses: ${PROJECT_NAME}-verification (test gate), ${PROJECT_NAME}-commit (merge commit refinement)
- ${PROJECT_NAME}-git-workflow rule governs branch naming and PR conventions
`;
