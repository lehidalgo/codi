import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Migrate the project's git hooks setup from Husky / Lefthook / pre-commit-framework to codi's git-native \`core.hooksPath\` standard. Auto-injected via UserPromptSubmit when codi detects a conflicting hook runner in the project. Safe, idempotent, preserves the user's existing hook scripts as a legacy directory for manual review. Use when codi-default is the active preset AND another hook runner is configured.
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 1
maintainers: ["@lehidalgo"]
---

# Migrate Hooks to codi's \`core.hooksPath\` standard

codi-default ships its git hook integration via the git-native
\`core.hooksPath\` mechanism — versioned, language-agnostic, zero npm
deps, single source of truth. Husky / Lefthook / pre-commit-framework
do the same thing through their own wrappers. They cannot coexist with
codi's setup on the same repo without one silently overriding the
other.

This skill performs a safe migration: it preserves the user's existing
hook scripts (so any custom logic can be reviewed and ported manually
if desired), then sets up codi's standard.

## When to activate

- The user invokes \`/${PROJECT_NAME}-dev-migrate-hooks\` explicitly.
- The user accepts the auto-prompt that codi's UserPromptSubmit hook
  injects when it detects \`.husky/\`, \`lefthook.yml\`, or
  \`.pre-commit-config.yaml\` in a codi-default project.

## Detection summary (already done by codi at session start)

| Runner detected | Marker file |
|---|---|
| Husky | \`.husky/\` directory |
| Lefthook | \`lefthook.yml\` or \`lefthook.yaml\` |
| pre-commit framework | \`.pre-commit-config.yaml\` |

If none of these exist AND \`core.hooksPath\` is already set to
\`.githooks/\`, the migration is a no-op — codi is already canonical.

## Migration procedure

### 1. Verify the current state

\`\`\`bash
git config --get core.hooksPath || echo "unset"
ls -la .husky/ 2>/dev/null
ls -la lefthook.yml lefthook.yaml .pre-commit-config.yaml 2>/dev/null
\`\`\`

Confirm with the user which runner is active and that they want to
proceed. Show the conflicting files; they may want to keep some
custom logic.

### 2. Preserve the existing runner config

For each runner that is present, rename its config to a legacy
location so the content survives but is no longer active:

| Runner | Action |
|---|---|
| Husky | \`mv .husky .husky.legacy\` |
| Lefthook | \`mv lefthook.yml lefthook.yml.legacy\` (and \`.yaml\` variant) |
| pre-commit | \`mv .pre-commit-config.yaml .pre-commit-config.yaml.legacy\` |

Add \`*.legacy\` and \`.husky.legacy/\` to \`.gitignore\` if not already
ignored, OR commit the legacy files for one cycle as a paper trail —
ask the user which they prefer.

### 3. Remove Husky devDependency (Node projects only)

If \`package.json::devDependencies::husky\` is present:

\`\`\`bash
npm uninstall husky
# also strip the "prepare": "husky" script from package.json if present
\`\`\`

Lefthook and pre-commit are usually installed via their own package
managers (Go binary, Python pip) — not removed automatically by this
skill. Tell the user the binary stays installed on their system; the
config is what was active.

### 4. Set up codi's \`core.hooksPath\`

\`\`\`bash
mkdir -p .githooks
cat > .githooks/pre-commit <<'EOF'
#!/bin/sh
exec ${PROJECT_NAME} hook git-pre-commit "\$@"
EOF
cat > .githooks/commit-msg <<'EOF'
#!/bin/sh
exec ${PROJECT_NAME} hook git-commit-msg "\$@"
EOF
cat > .githooks/pre-push <<'EOF'
#!/bin/sh
exec ${PROJECT_NAME} hook git-pre-push "\$@"
EOF
chmod +x .githooks/pre-commit .githooks/commit-msg .githooks/pre-push
git config core.hooksPath .githooks/
git add .githooks/
\`\`\`

### 5. Surface preserved logic for review

Read the legacy hook scripts and summarize what they were doing for
the user. Examples of logic the user may want to preserve via codi's
flag system or as a custom hook check:

- \`npx lint-staged\` invocations → already covered by codi's
  \`auto-format\` check (detects prettier/biome in package.json).
- \`npm test\` invocations on pre-commit → already covered if the
  preset has the test_before_commit flag.
- \`commitlint\` invocations → covered by codi's commit-msg-validator.
- Custom project-specific scripts (e.g. updating a CHANGELOG) → no
  built-in equivalent. Tell the user to add the logic as a new check
  module under \`src/runtime/hooks/git/\` if shipping it via codi, or
  as a separate \`.githooks/pre-commit\` block if just for this repo.

### 6. Verify the new setup

\`\`\`bash
git config --get core.hooksPath
# expected: .githooks/

ls -la .githooks/
# expected: pre-commit, commit-msg, pre-push (all executable)

echo "test" > /tmp/codi-migrate-verify.txt
${PROJECT_NAME} hook git-pre-commit < /dev/null
# expected: exit 0 with no stderr blocks (clean tree, nothing to check)
\`\`\`

### 7. Report

Confirm to the user:
- Which runner was migrated
- Where its config was preserved
- What logic the user might want to manually port forward
- That \`git commit\` and \`git push\` now route through \`codi hook
  git-pre-commit\` / \`git-pre-push\` / \`git-commit-msg\`

## Anti-patterns

- **Do not silently delete \`.husky/\`** — always rename to
  \`.husky.legacy/\` so the user can review what they had.
- **Do not auto-install npm packages** unless the user explicitly
  confirms — \`npm install\` triggers postinstall hooks that may have
  side effects beyond Husky.
- **Do not modify CI workflow files** (\`.github/workflows/*.yml\`) —
  those typically don't depend on Husky postinstall; only flag if
  you see explicit references to Husky in a workflow.
- **Do not run the migration when \`core.hooksPath\` is already set to
  \`.githooks/\`** — that's the no-op case; just report "already
  canonical" and exit.

## Skip when

- The project is not a codi-default project (different preset, no
  flag for hook integration).
- The user explicitly opts out of codi-managed hooks.
- The user is mid-rebase or mid-merge (hooks paths can get confusing
  during rebases; wait for clean state).
`;
