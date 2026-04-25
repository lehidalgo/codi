# Getting Started

A hands-on tutorial to set up Codi in a project in under 5 minutes.

## What You Will Do

1. Install Codi
2. Initialize configuration in your project
3. Generate agent config files
4. Customize a rule and a skill
5. Commit everything to version control

> **Prefer an AI-guided setup?** Skip steps 2-4 and run `codi onboard` instead. Your coding agent reads the output, explores your project, recommends the right artifacts, and runs all the setup commands for you. See [Step 2](#step-2-initialize-your-project) for details.

By the end, your project will have a `.codi/` directory (source of truth) and generated config files (`CLAUDE.md`, `.cursorrules`, etc.) ready for your AI agents.

---

## Prerequisites

- **Node.js >= 24** (check with `node -v`)
- **npm** (comes with Node.js)
- **A project directory** (new or existing)

If your system Node is older or installed under `/usr/local` (root-owned), the curl installer in Step 1 will set up nvm + Node 24 for you.

---

## Step 1: Install

### Quick install (recommended)

```bash
curl -fsSL https://lehidalgo.github.io/codi/install.sh | bash
```

This detects your environment and:

- Installs nvm + Node 24 if missing or too old (under `~/.nvm`, no sudo)
- Refuses to touch a root-owned npm prefix unless you explicitly opt in
- Runs `npm install -g codi-cli` and verifies the result

Override with `CODI_VERSION=2.x.y`, `CODI_INSTALL_NVM=0`, or `CODI_DRY_RUN=1`. Verify the script before piping it to bash:

```bash
curl -fsSL https://lehidalgo.github.io/codi/install.sh -o install.sh
curl -fsSL https://lehidalgo.github.io/codi/install.sh.sha256 -o install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
```

### Manual install

If you already manage Node 24+ yourself, install directly via npm:

```bash
# Global — puts `codi` on your PATH
npm install -g codi-cli

# Without installing — good for one-off use
npx codi-cli <command>

# As a dev dependency — best for CI and team lockfiles
npm install -D codi-cli
```

When installed as a dev dependency, `codi` is not on your PATH. Prefix all commands with `npx codi` or add scripts to your `package.json`:

```json
{
  "scripts": {
    "codi:generate": "codi generate",
    "codi:status": "codi status"
  }
}
```

All examples below use `codi` directly (global install).

---

## Step 2: Initialize Your Project

Navigate to your project root and run:

```bash
cd your-project
codi init
```

The interactive wizard walks you through three choices:

1. **Languages** -- auto-detected from your project files. Confirm or adjust.
2. **AI agents** -- select the ones your team uses (Claude Code, Cursor, Codex, Windsurf, Cline, GitHub Copilot).
3. **Config mode** -- start with **preset** and select **balanced** (recommended). This gives you sensible defaults for security, typing, and git workflow.

### Non-Interactive Alternative

Skip the wizard entirely:

```bash
codi init --agents claude-code cursor --preset balanced
```

### AI-Guided Alternative

Let your coding agent do the thinking. Tell it to run:

```bash
codi onboard
```

The command prints a full guide to stdout — artifact catalog, preset reference, and a step-by-step playbook. Your agent reads the output, explores the codebase, proposes the best preset and artifact selection with per-artifact rationale, iterates with you until approved, then runs all the setup commands automatically. At the end it creates a `docs/YYYYMMDD_HHMMSS_[PLAN]_codi-init.md` summary documenting what was installed and why.

---

## Step 3: Explore What Was Created

After initialization, your project has a new `.codi/` directory:

```
.codi/
  codi.yaml          # Project manifest — agents, preset, languages
  flags.yaml         # 16 behavioral switches (security, testing, permissions, etc.)
  rules/             # All rules (preset-managed and custom)
  skills/            # Reusable workflows agents can invoke
  agents/            # Subagent definitions (code reviewer, test generator, etc.)
  state.json         # File tracking — auto-managed, do not edit
```

Here is what each piece does:

| Directory / File | Purpose |
|:-----------------|:--------|
| `codi.yaml` | Declares which agents to generate for, which preset to use, and project metadata |
| `flags.yaml` | Controls agent behavior: max file length, force push policy, security scanning, etc. |
| `rules/` | All rules — preset-managed rules (`managed_by: codi`) are updated by `codi update`; custom rules (`managed_by: user`) are never overwritten |
| `skills/` | Step-by-step workflows agents can follow (code review, commit, testing, etc.) |
| `agents/` | Specialized subagent roles with focused responsibilities |
| `state.json` | Tracks generated file hashes for drift detection. Auto-managed |

---

## Step 4: Generate Agent Configs

Run the generator:

```bash
codi generate
```

You will see output like:

```
 Generated CLAUDE.md
 Generated .cursorrules
 2 agents processed, 14 files generated
```

Codi reads `.codi/`, resolves all layers (preset, flags, rules, skills, agents), and produces the native config file for each agent you selected.

Important: built-in templates are only used when scaffolding `.codi/` during commands like `init` and `add`. Once your project is initialized, edit `.codi/` directly — `generate` does not read from `src/templates/`.

The generated files are ready to use immediately. Open your AI agent and it will pick up the new configuration.

---

## Step 5: Verify Everything Works

Two commands to confirm things are healthy:

```bash
# Check that generated files match .codi/ source
codi status
```

If everything is in sync, you will see:

```
 All generated files are in sync
```

For a deeper health check:

```bash
codi doctor
```

This validates your manifest, flags, rules, skills, and agent configs. Fix any warnings it reports before continuing.

---

## Step 6: Customize a Rule

Preset rules cover common conventions, but every project has its own standards. Add a custom rule:

```bash
codi add rule my-conventions
```

This creates `.codi/rules/my-conventions.md` with a starter template. Open it and add your project-specific instructions:

```markdown
# (codi-rule) my-conventions

# My Project Conventions

## Naming
- Use kebab-case for all file names
- Prefix test files with the module name: `user.test.ts`, not `test-user.ts`

## Imports
- Always use path aliases (`@/`) instead of relative imports beyond one level
```

Then regenerate and verify:

```bash
codi generate
codi status   # should show "in sync"
```

Your custom rule now appears in every generated agent config.

---

## Step 7: Add a Skill

Skills are reusable workflows that agents can invoke. Add one from the built-in templates:

```bash
codi add skill code-review --template code-review
```

This creates a skill directory at `.codi/skills/code-review/` with a `SKILL.md` and supporting files. Regenerate to include it:

```bash
codi generate
```

Your agents now have access to a structured code review workflow.

To see all available templates:

```bash
codi add skill --all
```

---

## Step 8: Commit Your Configuration

Both the source (`.codi/`) and the generated files need to be in version control. Agents read the generated files directly from the repo.

```bash
git add .codi/ CLAUDE.md .cursorrules
git commit -m "chore: add codi configuration"
```

Why commit generated files? AI agents like Claude Code read `CLAUDE.md` directly from your repository. If the generated files are not committed, the agents will not see your configuration. The `.codi/` directory is the source of truth; the generated files are the delivery mechanism.

---

## Day-to-Day Workflow

Once set up, the typical workflow is:

```bash
# Edit rules, skills, or flags in .codi/
vim .codi/rules/my-conventions.md

# Regenerate
codi generate

# Verify nothing drifted
codi status

# Commit both source and generated files
git add .codi/ CLAUDE.md .cursorrules
git commit -m "chore: update codi rules"
```

If someone on your team changes `.codi/` and you pull their changes, just run `codi generate` to update your local generated files.

---

## What's Next?

| Want to... | Read... |
|:-----------|:--------|
| See all CLI commands and options | [CLI Reference](cli-reference.md) |
| Understand rules, skills, agents | [Artifacts Guide](artifacts.md) |
| Choose a different preset | [Presets Guide](presets.md) |
| Configure flags and layers | [Configuration](configuration.md) |
| Set up CI/CD integration | [Workflows](workflows.md) |
| Migrate from an existing config | [Migration Guide](migration.md) |
| Troubleshoot common issues | [Troubleshooting](troubleshooting.md) |
| Understand the architecture | [Architecture](architecture.md) |
