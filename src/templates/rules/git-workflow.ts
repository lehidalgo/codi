import { GIT_COMMIT_FIRST_LINE_LIMIT } from '../../constants.js';

export const template = `---
name: {{name}}
description: Git workflow and commit conventions
priority: medium
alwaysApply: true
managed_by: codi
---

# Git Workflow

## Commit Messages
- Use conventional commits format: type(scope): description — enables automated changelogs and semantic versioning

BAD: \`"fixed stuff"\` or \`"WIP"\`
GOOD: \`feat(auth): add OAuth2 login with Google provider\`

- Types: feat, fix, docs, refactor, test, chore, perf, ci
- Write in imperative mood: "add feature" not "added feature"
- First line under ${GIT_COMMIT_FIRST_LINE_LIMIT} characters, details in body

## Commit Practices
- Make atomic commits: one logical change per commit — simplifies reverts and code review

BAD: One commit with a new feature, a bug fix, and a refactor
GOOD: Three separate commits, each reviewable independently

- Every commit should leave the codebase in a working state — broken commits block bisect and teammates
- Review your diff before committing
- Do not commit generated files, build artifacts, or secrets
- Do not add AI attribution or co-author signatures to commits

## Branch Strategy
- Branch from main for all work
- Use descriptive branch names: feature/, fix/, chore/
- Keep branches short-lived and focused — long-lived branches accumulate merge conflicts
- Delete branches after merging

## Safety
- Never force push to main or shared branches — rewrites shared history and causes data loss
- Always pull before pushing to avoid unnecessary merge conflicts
- Resolve merge conflicts carefully — understand both sides
- Tag releases with semantic versions (vMAJOR.MINOR.PATCH)

## Release Management
- Never publish without a fresh build — stale dist artifacts cause silent regressions
- Use npm lifecycle hooks (preversion, version, prepublishOnly) to enforce build-before-release automatically
- Run tests before every version bump — a broken release is worse than a delayed one
- Verify the built output matches the source before publishing: grep for key changes in dist/
- One atomic command for releases: \`npm version patch\` triggers lint, test, build, commit, and tag in sequence`;
