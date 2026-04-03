# Pre-commit Hooks Reference

## Installation

```bash
# Install pre-commit (Python tool)
pip install pre-commit
# or with uv:
uv add --dev pre-commit

# Install hooks into .git/hooks
pre-commit install

# If config is in a non-default location:
pre-commit install -c ../.pre-commit-config.yaml
```

## Hook Ordering — Fast to Slow

Hooks run top-to-bottom. Order by speed and criticality:

| Priority | Category | Speed | Action on fail |
|----------|----------|-------|----------------|
| 1 | File fixers | Instant | Auto-fix, re-stage |
| 2 | Security scanners | Fast | Block commit |
| 3 | Linters | Medium | Block commit |
| 4 | Formatters | Medium | Block or auto-fix |
| 5 | Type checkers | Slow | Block commit |
| 6 | Tests | Slowest | Block commit |

**Why:** If a security scan fails, don't waste time running mypy/pytest. Fail fast.

## Full-Stack Config Template

```yaml
# .pre-commit-config.yaml
repos:
  # ── File Fixers (instant) ──
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: mixed-line-ending
        args: ["--fix=lf"]
      - id: end-of-file-fixer
      - id: trailing-whitespace
      - id: check-merge-conflict
      - id: check-yaml
      - id: check-json

  # ── Security (fast) ──
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.30.1
    hooks:
      - id: gitleaks

  # ── Python Linting + Security ──
  - repo: local
    hooks:
      - id: bandit
        name: bandit (security)
        entry: bandit -r app/ -c .bandit.yaml -ll -q
        language: system
        types: [python]
        pass_filenames: false

      - id: ruff-check
        name: ruff check (lint)
        entry: ruff check app/
        language: system
        types: [python]
        pass_filenames: false

      - id: ruff-format
        name: ruff format (verify)
        entry: ruff format --check app/
        language: system
        types: [python]
        pass_filenames: false

      - id: mypy
        name: mypy (type check)
        entry: mypy app
        language: system
        types: [python]
        pass_filenames: false

      - id: pytest-unit
        name: pytest (unit tests)
        entry: pytest tests/unit -m unit -x -q
        language: system
        types: [python]
        pass_filenames: false

  # ── Frontend (TypeScript/React) ──
  - repo: local
    hooks:
      - id: prettier
        name: prettier (format check)
        entry: npx --prefix frontend prettier --check "frontend/src/**/*.{ts,tsx,js,jsx,json,css}"
        language: system
        pass_filenames: false
        files: ^frontend/

      - id: eslint
        name: eslint (lint)
        entry: npx --prefix frontend eslint frontend/src/
        language: system
        pass_filenames: false
        files: ^frontend/

      - id: vitest
        name: vitest (unit tests)
        entry: npx --prefix frontend vitest run
        language: system
        pass_filenames: false
        files: ^frontend/

      - id: tsc
        name: tsc (type check)
        entry: npx --prefix frontend tsc --noEmit
        language: system
        pass_filenames: false
        files: ^frontend/
```

## Python-Only Config (no frontend)

Use the full config above but remove the "Frontend" section.

## Node-Only Config (no Python)

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: mixed-line-ending
        args: ["--fix=lf"]
      - id: end-of-file-fixer
      - id: trailing-whitespace

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.30.1
    hooks:
      - id: gitleaks

  - repo: local
    hooks:
      - id: prettier
        name: prettier
        entry: npx prettier --check "src/**/*.{ts,tsx,js,jsx,json,css}"
        language: system
        pass_filenames: false

      - id: eslint
        name: eslint
        entry: npx eslint src/
        language: system
        pass_filenames: false

      - id: vitest
        name: vitest
        entry: npx vitest run
        language: system
        pass_filenames: false

      - id: tsc
        name: tsc
        entry: npx tsc --noEmit
        language: system
        pass_filenames: false
```

## Running Manually

```bash
# All hooks on all files
pre-commit run --all-files

# Specific hook
pre-commit run gitleaks --all-files

# With non-default config location
pre-commit run --all-files -c ../.pre-commit-config.yaml
```

## Hook Types

- **`repo:` hooks** — Download their own environment. Pinned by `rev:`. Update with `pre-commit autoupdate`.
- **`local` hooks** — Use `language: system`, run what's already installed. You manage versions.

## When Hooks Fail

- **Auto-fix hooks** (line endings, whitespace): Files are fixed automatically. Just `git add` again and retry.
- **Blocking hooks** (lint, type check, tests): Fix the issue, `git add`, retry commit.
- **Emergency bypass** (not recommended): `git commit --no-verify` — CI will catch it.

## Tips

- Use `pass_filenames: false` for tools that lint entire directories (ruff, eslint)
- Use `types: [python]` to only trigger on Python file changes
- Use `files: ^frontend/` to scope hooks to subdirectories
- After adding new hooks: `pre-commit clean` to clear cache if needed
- To update external hooks: `pre-commit autoupdate`

## Automated Weekly Autoupdate (GitHub Actions)

Keeps external hook versions (`rev:`) up to date automatically. Runs every Tuesday, opens a PR if there are changes.

### .github/workflows/pre-commit-autoupdate.yml

```yaml
name: Pre-commit Autoupdate

on:
  schedule:
    - cron: "0 9 * * 2"  # Every Tuesday at 09:00 UTC
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  autoupdate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.13"

      - name: Install pre-commit
        run: pip install pre-commit

      - name: Run pre-commit autoupdate
        run: pre-commit autoupdate

      - name: Check for changes
        id: diff
        run: |
          git diff --quiet .pre-commit-config.yaml && echo "changed=false" >> "$GITHUB_OUTPUT" || echo "changed=true" >> "$GITHUB_OUTPUT"

      - name: Create Pull Request
        if: steps.diff.outputs.changed == 'true'
        uses: peter-evans/create-pull-request@v7
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          branch: chore/pre-commit-autoupdate
          commit-message: "chore(deps): auto-update pre-commit hooks"
          title: "chore(deps): auto-update pre-commit hooks"
          body: |
            Automated `pre-commit autoupdate` — updates external hook versions.
            Run `pre-commit run --all-files` locally to verify.
          labels: dependencies
          delete-branch: true
```

**What it updates:** Only `repo:` hooks with `rev:` (e.g., gitleaks, pre-commit-hooks). `local` hooks use system tools — those update via your package manager (uv/npm).

**Why a PR and not auto-merge:** Hook updates can break things (new rules, stricter checks). Review the diff before merging.
