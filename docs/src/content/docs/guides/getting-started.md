---
title: Getting Started
description: Install Codi and generate your first agent configuration in under 5 minutes
sidebar:
  order: 1
---

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

1. **Languages** — auto-detected from your project files. Confirm or adjust.
2. **AI agents** — select the ones your team uses (Claude Code, Cursor, Codex, Windsurf, Cline, GitHub Copilot).
3. **Config mode** — start with **preset** and select **balanced** (recommended). This gives you sensible defaults for security, typing, and git workflow.

### Non-Interactive Alternative

```bash
codi init --agents claude-code cursor --preset balanced
```

### AI-Guided Alternative

```bash
codi onboard
```

The command prints a full guide to stdout — artifact catalog, preset reference, and a step-by-step playbook. Your agent reads the output, explores the codebase, proposes the best preset and artifact selection with per-artifact rationale, iterates with you until approved, then runs all the setup commands automatically.

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

---

## Step 4: Generate Agent Configs

```bash
codi generate
```

Codi reads `.codi/`, resolves all layers (preset, flags, rules, skills, agents), and produces the native config file for each agent you selected.

---

## Step 5: Verify Everything Works

```bash
codi status   # Check that generated files match .codi/ source
codi doctor   # Deep health check — validates manifest, flags, rules, skills
```

---

## Step 6: Customize a Rule

```bash
codi add rule my-conventions
```

This creates `.codi/rules/my-conventions.md`. Open it and add your project-specific instructions. Then regenerate:

```bash
codi generate
codi status
```

---

## Step 7: Add a Skill

```bash
codi add skill code-review --template code-review
codi generate
```

---

## Step 8: Commit Your Configuration

```bash
git add .codi/ CLAUDE.md .cursorrules
git commit -m "chore: add codi configuration"
```

Both the source (`.codi/`) and generated files must be committed — agents read the generated files directly from the repo.

---

## Day-to-Day Workflow

```bash
# Edit rules, skills, or flags in .codi/
vim .codi/rules/my-conventions.md

# Regenerate and verify
codi generate
codi status

# Commit both source and generated files
git add .codi/ CLAUDE.md .cursorrules
git commit -m "chore: update codi rules"
```

---

## What's Next?

| Want to... | Read... |
|:-----------|:--------|
| See all CLI commands | [CLI Reference](/codi/docs/reference/cli-reference/) |
| Configure flags and layers | [Configuration](/codi/docs/reference/configuration/) |
| Browse the API reference | [API Reference](/codi/docs/api/) |
