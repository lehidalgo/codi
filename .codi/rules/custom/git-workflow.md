---
name: git-workflow
description: Git workflow and commit conventions
priority: medium
alwaysApply: true
managed_by: user
---

# Git Workflow

## Commit Messages
- Use conventional commits format: type(scope): description
- Types: feat, fix, docs, refactor, test, chore, perf, ci
- Write in imperative mood: "add feature" not "added feature"
- First line under 72 characters, details in body

## Commit Practices
- Make atomic commits: one logical change per commit
- Every commit should leave the codebase in a working state
- Review your diff before committing
- Do not commit generated files, build artifacts, or secrets

## Branch Strategy
- Branch from main for all work
- Use descriptive branch names: feature/, fix/, chore/
- Keep branches short-lived and focused
- Delete branches after merging

## Safety
- Never force push to main or shared branches
- Always pull before pushing to avoid unnecessary merge conflicts
- Resolve merge conflicts carefully — understand both sides
- Tag releases with semantic versions (vMAJOR.MINOR.PATCH)
