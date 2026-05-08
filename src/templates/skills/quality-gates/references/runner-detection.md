# Runner detection

The skill supports three hook runners. Auto-detect with documented fallback.

## Decision tree

```
Has lefthook.yml or lefthook.yaml? → use lefthook
Has .pre-commit-config.yaml?       → use pre-commit framework
Has package.json with husky?       → use husky
Has package.json without husky?    → install husky (default for JS/TS)
Has pyproject.toml as primary?     → install pre-commit framework
Otherwise                          → install husky
```

## Detection script (in `scripts/setup.sh`)

```bash
detect_runner() {
  if [ -f lefthook.yml ] || [ -f lefthook.yaml ]; then
    echo "lefthook"
  elif [ -f .pre-commit-config.yaml ]; then
    echo "pre-commit"
  elif [ -f package.json ] && grep -q '"husky"' package.json 2>/dev/null; then
    echo "husky"
  elif [ -f package.json ]; then
    # JS/TS primary — default to husky
    echo "husky"
  elif [ -f pyproject.toml ] || [ -f setup.py ]; then
    # Python primary — default to pre-commit framework
    echo "pre-commit"
  else
    # Polyglot or unknown — default to husky (broadest tool support)
    echo "husky"
  fi
}
```

## Why these defaults

- **husky** for JS/TS — native Node integration, runs lint-staged efficiently, no Python dependency.
- **pre-commit framework** for Python — written in Python, ships its own hook isolation, the de-facto Python standard.
- **lefthook** when explicitly chosen — language-agnostic, fast (Go binary), handles parallel execution well. Preserved when present, not auto-installed.

## Switching runners (out of scope for `setup`)

If a repo has both `package.json` and `pyproject.toml`, the detection picks one based on lock-file recency or asks the user once. Switching runners (e.g., husky → lefthook) is NOT part of `setup` mode — it requires manual migration and is a higher-impact change.

## Anti-patterns

- Installing two runners simultaneously (husky AND pre-commit) — they fight over `.git/hooks/`.
- Overwriting an existing `.pre-commit-config.yaml` with a husky-style config.
- Ignoring `lefthook.yml` when present — the team chose lefthook deliberately.
