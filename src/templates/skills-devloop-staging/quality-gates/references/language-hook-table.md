# Per-language hook table

5-category Hook Contract. Each language maps to all five categories. `n/a` is explicit, not silent.

## Hook Contract recap

| Category   | Pre-commit (≤5s)     | Pre-push (≤30s)    | CI                 |
| ---------- | -------------------- | ------------------ | ------------------ |
| format     | auto-fix + re-stage  | —                  | block PR if drift  |
| lint       | block on error       | full lint          | full lint          |
| type-check | (skip — too slow)    | full type-check    | full type-check    |
| security   | gitleaks + per-stack | full security scan | full security scan |
| test       | (skip — too slow)    | full test suite    | full test suite    |

## Per-language commands

| Language   | Format             | Lint                             | Type-check            | Security                                        | Test            |
| ---------- | ------------------ | -------------------------------- | --------------------- | ----------------------------------------------- | --------------- |
| TypeScript | `prettier --write` | `eslint --fix`                   | `tsc --noEmit`        | `gitleaks` + `pnpm audit`                       | `pnpm test`     |
| JavaScript | `prettier --write` | `eslint --fix`                   | n/a                   | `gitleaks` + `pnpm audit`                       | `pnpm test`     |
| Python     | `ruff format`      | `ruff check --fix`               | `pyright` (or `mypy`) | `gitleaks` + `bandit -c pyproject.toml -lll -r` | `uv run pytest` |
| Go         | `gofmt -w`         | `golangci-lint run --fix`        | n/a (compiler)        | `gitleaks` + `gosec ./...`                      | `go test ./...` |
| Rust       | `cargo fmt`        | `cargo clippy --fix`             | n/a (compiler)        | `gitleaks` + `cargo audit`                      | `cargo test`    |
| Shell      | `shfmt -w`         | `shellcheck`                     | n/a                   | `gitleaks`                                      | n/a             |
| YAML       | `prettier --write` | `yamllint`                       | n/a                   | `gitleaks`                                      | n/a             |
| JSON       | `prettier --write` | `jq -e . > /dev/null` (validity) | n/a                   | `gitleaks`                                      | n/a             |
| Dockerfile | n/a                | `hadolint`                       | n/a                   | `gitleaks` + `trivy config`                     | n/a             |

## Required-flag policy

For each (language × category), an `InstallHint` covers how to install the missing tool, plus a `required` flag:

```typescript
interface HookEntry {
  language: string;
  category: "format" | "lint" | "type-check" | "security" | "test";
  command: string;
  required: boolean; // true = block commit if missing; false = warn and skip
  install: { brew?: string; npm?: string; pip?: string; go?: string; docs?: string };
}
```

Examples:

- `gitleaks` security: `required: true` (universal). Missing → block, print install hint.
- `prettier` format: `required: false` (auto-fix). Missing → warn and skip; commit proceeds.
- `eslint` lint: `required: true`. Missing → block.
- `tsc` type-check (pre-push): `required: true` for TS repos. Missing → block.

## Universal hooks (run regardless of stack)

| Hook                                                     | When       | Action on fail                                  |
| -------------------------------------------------------- | ---------- | ----------------------------------------------- |
| gitleaks (secret scan)                                   | pre-commit | block                                           |
| file-size check (>1 MB warn, >10 MB block)               | pre-commit | warn or block                                   |
| conflict-marker check                                    | pre-commit | block                                           |
| branch-name validator (`<github-user>/<type>/<slug>`)    | pre-commit | block (post-convention) or warn (grandfathered) |
| commit-msg conventional-commit + 72-char                 | commit-msg | block                                           |
| no-commit-to-branch (main/master)                        | pre-commit | block                                           |
| archive-protection (devloop-specific, preserve existing) | pre-push   | block                                           |

Universal hooks run BEFORE language-specific hooks. Fail fast on universal violations.

## Hook ordering (within pre-commit)

Top-to-bottom = fast-to-slow:

1. File fixers (instant): trailing-whitespace, end-of-file-fixer, mixed-line-ending
2. Universal security: gitleaks
3. Branch / commit guards: branch-name validator, no-commit-to-branch
4. Per-language linters: eslint, ruff check, golangci-lint
5. Per-language formatters (auto-fix): prettier, ruff format, gofmt
6. Per-language security: bandit, gosec, cargo audit

If any fails, the commit is blocked. Auto-fixers re-stage the modified files.

## Devloop-specific hooks (extends the universal set)

- `[PLAN]` doc naming validator — runs on `docs/*.md` to enforce `YYYYMMDD_HHMMSS_[CATEGORY]_*.md` format.
- Skill yaml validator — runs on `skills/*/SKILL.md` to enforce frontmatter limits.
- Skill resource check — verifies `[[/path]]` references in SKILL.md resolve to real files.

These are devloop's equivalent of codi's `codi-skill-yaml-validate` / `codi-skill-resource-check`. Implementation in `scripts/setup.sh` writes the validator commands into the pre-commit config.
