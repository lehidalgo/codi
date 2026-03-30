# Getting Started

A hands-on tutorial to set up Codi in a project in under 5 minutes.

## What You Will Do

1. Install Codi
2. Initialize configuration in your project
3. Generate agent config files
4. Customize a rule and a skill
5. Commit everything to version control

By the end, your project will have a `.codi/` directory (source of truth) and generated config files (`CLAUDE.md`, `.cursorrules`, etc.) ready for your AI agents.

---

## Prerequisites

- **Node.js >= 20** (check with `node -v`)
- **npm** (comes with Node.js)
- **A project directory** (new or existing)

---

## Step 1: Install

Pick one of three options:

```bash
# Global (recommended) — puts `codi` on your PATH
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
2. **AI agents** -- select the ones your team uses (Claude Code, Cursor, Codex, Windsurf, Cline).
3. **Config mode** -- start with **preset** and select **balanced** (recommended). This gives you sensible defaults for security, typing, and git workflow.

### Non-Interactive Alternative

Skip the wizard entirely:

```bash
codi init --agents claude-code cursor --preset balanced
```

---

## Step 3: Explore What Was Created

After initialization, your project has a new `.codi/` directory:

```
.codi/
  codi.yaml          # Project manifest — agents, preset, languages
  flags.yaml         # 18 behavioral switches (file limits, security, etc.)
  rules/
    managed/         # Rules pulled from your preset (read-only)
    custom/          # Your own rules (editable)
  skills/            # Reusable workflows agents can invoke
  agents/            # Subagent definitions (code reviewer, test generator, etc.)
  commands/          # Slash commands (/commit, /review, etc.)
  state.json         # File tracking — auto-managed, do not edit
```

Here is what each piece does:

| Directory / File | Purpose |
|:-----------------|:--------|
| `codi.yaml` | Declares which agents to generate for, which preset to use, and project metadata |
| `flags.yaml` | Controls agent behavior: max file length, force push policy, security scanning, etc. |
| `rules/managed/` | Rules from your preset. Updated automatically when you run `codi update` |
| `rules/custom/` | Your project-specific rules. These always take priority over managed rules |
| `skills/` | Step-by-step workflows agents can follow (code review, commit, testing, etc.) |
| `agents/` | Specialized subagent roles with focused responsibilities |
| `commands/` | Slash commands your team can invoke inside the agent |
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

Codi reads `.codi/`, resolves all layers (preset, flags, rules, skills, agents, commands), and produces the native config file for each agent you selected.

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

This creates `.codi/rules/custom/my-conventions.md` with a starter template. Open it and add your project-specific instructions:

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
vim .codi/rules/custom/my-conventions.md

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
| Understand rules, skills, agents, commands | [Artifacts Guide](artifacts.md) |
| Choose a different preset | [Presets Guide](presets.md) |
| Configure flags and layers | [Configuration](configuration.md) |
| Set up CI/CD integration | [Workflows](workflows.md) |
| Migrate from an existing config | [Migration Guide](migration.md) |
| Troubleshoot common issues | [Troubleshooting](troubleshooting.md) |
| Understand the architecture | [Architecture](architecture.md) |
