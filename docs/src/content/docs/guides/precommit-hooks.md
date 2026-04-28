---
title: Pre-commit hooks
description: How Codi installs pre-commit hooks for multi-language projects
---

Codi installs a pre-commit hook configuration on `codi init`. The runner is auto-detected based on signals in your project root:

| Signal | Runner |
|---|---|
| `.husky/` directory exists | husky |
| `.pre-commit-config.yaml` exists | pre-commit framework |
| `lefthook.yml` or `.lefthook.yml` exists | lefthook |
| none of the above | standalone (`.git/hooks/pre-commit`) |

For polyglot repos that mix Python with JavaScript/TypeScript, the **pre-commit framework** is recommended — it gives you isolated tool environments, `pre-commit autoupdate` compatibility, and pinned `rev:` per upstream repo.

## Tooling defaults

Four flags control which tools Codi wires into the hook config. All default to `auto` and are resolved from project signals at `codi init` / `codi generate` time.

| Flag | Values | Auto picks |
|---|---|---|
| `python_type_checker` | `auto`, `mypy`, `basedpyright`, `pyright`, `off` | mypy when `[tool.mypy]` / mypy.ini / Django / SQLAlchemy is present; basedpyright for FastAPI / pydantic / SQLModel; basedpyright for codebases >20k python LOC; basedpyright as fallback. |
| `js_format_lint` | `auto`, `eslint-prettier`, `biome`, `off` | biome when `biome.json` / `biome.jsonc` exists; eslint-prettier when `.eslintrc*` / `eslint.config.*` / `.prettierrc*` exists; eslint-prettier as fallback. Biome uses `biomejs/pre-commit` v0.6.1 with `additionalDependencies: ["@biomejs/biome@2.3.0"]`. |
| `commit_type_check` | `auto`, `on`, `off` | always `off` — type-checking is deferred to `pre-push`. Set to `on` to run `tsc` / `mypy` / `basedpyright` on every commit (slower commits). |
| `commit_test_run` | `auto`, `on`, `off` | always `off` — industry consensus rejects full test suites on every commit. Set to `on` to override. |

To override the auto-resolved values, edit `.codi/flags.yaml`:

```yaml
python_type_checker:
  mode: enabled
  value: mypy
js_format_lint:
  mode: enabled
  value: eslint-prettier
```

## What the pre-commit framework config looks like

For a polyglot TypeScript + Python project with default flags, `codi init` produces:

```yaml
default_install_hook_types: [pre-commit, commit-msg, pre-push]
default_language_version:
  python: python3.12
  node: '22'
minimum_pre_commit_version: 3.5.0
exclude: ^(node_modules|\.venv|venv|dist|build|coverage|\.next|\.codi)/

repos:
  - repo: https://github.com/pre-commit/mirrors-prettier  # managed by codi
    rev: v4.0.0-alpha.8
    hooks:
      - id: prettier

  - repo: https://github.com/astral-sh/ruff-pre-commit  # managed by codi
    rev: v0.15.12
    hooks:
      - id: ruff-check
        args: [--fix]

  - repo: https://github.com/astral-sh/ruff-pre-commit  # managed by codi
    rev: v0.15.12
    hooks:
      - id: ruff-format

  - repo: https://github.com/PyCQA/bandit  # managed by codi
    rev: 1.8.0
    hooks:
      - id: bandit
        args: [-c, pyproject.toml, -lll]
        additional_dependencies: [bandit[toml]]

  - repo: https://github.com/gitleaks/gitleaks  # managed by codi
    rev: v8.21.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/alessandrojcm/commitlint-pre-commit-hook  # managed by codi
    rev: v9.23.0
    hooks:
      - id: commitlint
        stages: [commit-msg]
        additional_dependencies: ['@commitlint/config-conventional']

  - repo: local  # managed by codi
    hooks:
      - id: codi-staged-junk-check
        name: codi-staged-junk-check
        entry: node .git/hooks/codi-staged-junk-check.mjs
        language: system
        always_run: true
```

Type-checkers (`basedpyright` here, `tsc` / `mypy` for TS / Python projects respectively) are emitted with `stages: [pre-push]` so they run on `git push` rather than every commit.

## User-edited `rev:` pins are preserved

If you run `pre-commit autoupdate` (or manually pin a different `rev:`) on a Codi-managed entry, Codi will preserve your `rev:` value across regenerations. Codi only owns structural fields (`id`, `args`, `additional_dependencies`) on its own marked entries; the `rev:` is yours after first write.

## What if my `.pre-commit-config.yaml` is malformed?

If the file fails YAML parsing on regeneration, Codi writes the broken content to `.pre-commit-config.yaml.codi-backup` and regenerates from scratch. You can recover any lost user content from the backup.

## Adding your own repos alongside Codi's

Add any non-Codi `- repo:` entries to `repos:` — Codi only touches entries with the `# managed by codi` marker. Your additions pass through untouched on every `codi generate`.
