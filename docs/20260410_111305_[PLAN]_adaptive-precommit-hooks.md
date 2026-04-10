# Adaptive Pre-commit Hook System

- **Date**: 2026-04-10 11:13
- **Document**: 20260410_111305_[PLAN]_adaptive-precommit-hooks.md
- **Category**: PLAN

---

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make codi-installed pre-commit hooks adaptive to the project's language stack, enforce a universal 5-category Hook Contract across all 14 supported languages, block commits when required tools are missing (with exact install instructions), and add a `codi hooks doctor` command for diagnosing and repairing hook health in any project.

**Architecture:** Three existing files change (`hook-registry.ts`, `hook-dependency-checker.ts`, `hook-installer.ts`) and one new CLI command is added (`src/cli/hooks.ts`). All changes are additive — no hook runner detection logic changes. Gitleaks becomes a universal security hook that runs before language-specific hooks on every commit.

**Tech Stack:** TypeScript, Node.js, `execFileSync`, existing hook runner abstractions (husky / pre-commit framework / lefthook / standalone)

---

## Hook Contract

Every language maps to 5 categories. A slot marked `n/a` means no viable tool exists for that language — it is explicit, not a silent skip.

| Category | Blocks commit when tool missing | Re-stages files |
|----------|---------------------------------|-----------------|
| `format` | No — warns and skips | Yes |
| `lint` | Yes | No |
| `type-check` | Yes (if language has static types) | No |
| `security` | Yes | No |
| `test` | Controlled by `test_before_commit` flag | No |

Gitleaks runs as a universal security hook before all language-specific hooks. The existing regex secret-scan stays as a fallback only when gitleaks is not installed (with a warning, not a block).

---

## Updated Hook Registry (gaps filled)

| Language | Format | Lint | Type-check | Security | Test |
|----------|--------|------|------------|----------|------|
| TypeScript | prettier | eslint | tsc | gitleaks + npm audit | npm test |
| JavaScript | prettier | eslint | n/a | gitleaks + npm audit | npm test |
| Python | ruff format | ruff check | pyright | gitleaks + bandit | pytest |
| Go | gofmt | golangci-lint | n/a (compiler) | gitleaks + gosec | go test ./... |
| Rust | cargo fmt | cargo clippy | n/a (compiler) | gitleaks | cargo test |
| Java | google-java-format | checkstyle | n/a (compiler) | gitleaks + spotbugs | mvn test -q |
| Kotlin | ktfmt | detekt | n/a (compiler) | gitleaks + detekt-security | gradle test |
| Swift | swiftformat | swiftlint | n/a (compiler) | gitleaks | swift test |
| C# | dotnet format | dotnet format analyzers | n/a (compiler) | gitleaks | dotnet test |
| C++ | clang-format | clang-tidy | n/a (compiler) | gitleaks + cppcheck | ctest |
| PHP | php-cs-fixer | phpcs | phpstan | gitleaks | phpunit |
| Ruby | rubocop -a | rubocop | steep check (`required: false`) | gitleaks + brakeman | bundle exec rspec |
| Dart | dart format | dart analyze | n/a (compiler) | gitleaks + dart pub audit | dart test |
| Shell | shfmt -w | shellcheck | n/a | gitleaks | n/a |

---

## New TypeScript Interfaces

### HookEntry (extended)

```typescript
interface InstallHint {
  npm?: string;       // e.g. "npm install -D eslint"
  pip?: string;       // e.g. "pip install ruff"
  brew?: string;      // e.g. "brew install gitleaks"
  go?: string;        // e.g. "go install github.com/securego/gosec/v2/cmd/gosec@latest"
  cargo?: string;     // e.g. "cargo install cargo-audit"
  apt?: string;       // e.g. "apt-get install clang-format"
  docs?: string;      // fallback URL
}

interface HookEntry {
  name: string;
  command: string;
  stagedFilter: string;
  category: 'format' | 'lint' | 'type-check' | 'security' | 'test';
  required: boolean;           // false = warn only, true = block on missing tool
  passFiles?: boolean;
  modifiesFiles?: boolean;
  language?: string;
  shell?: boolean;
  installHint: InstallHint;    // always present — no entry without install guidance
}
```

### DependencyDiagnostic (new)

`checkHookDependencies` returns ALL entries (found and not found) to support the `codi hooks doctor` health table. The previous behavior of returning only missing tools is replaced.

```typescript
interface DependencyDiagnostic {
  tool: string;
  language: string;
  category: 'format' | 'lint' | 'type-check' | 'security' | 'test';
  severity: 'error' | 'warning';
  installHint: InstallHint;
  found: boolean;         // true = ✓, false = ✗
  resolvedPath?: string;  // present when found = true
}
```

---

## Missing Tool Error Format

Generated into every hook script for required tools:

```bash
if ! command -v ruff &>/dev/null && ! npx --no -- ruff --version &>/dev/null 2>&1; then
  echo ""
  echo "[codi] ✗  ruff not found"
  echo "   Required for:  Python lint"
  echo "   Install:       pip install ruff"
  echo "   Fix all:       codi hooks doctor --fix"
  echo ""
  exit 1
fi
```

For `format` category (non-blocking) — `hook-installer.ts` must generate this explicit warning block. The existing ENOENT silent-skip in `RUNNER_TEMPLATE` is NOT sufficient; the generated script must emit a visible message:

```bash
if ! command -v shfmt &>/dev/null; then
  echo "[codi] ⚠  shfmt not found — skipping Shell format (install: brew install shfmt)"
else
  # run shfmt
fi
```

---

## codi hooks doctor — Output Format

```
codi hooks doctor

  Detected stack:  TypeScript, Python
  Hook runner:     husky v9.1.4

  Universal
  ✓ security    gitleaks   (/usr/local/bin/gitleaks)

  TypeScript
  ✓ format      prettier   (node_modules/.bin/prettier)
  ✓ lint        eslint     (node_modules/.bin/eslint)
  ✓ type-check  tsc        (node_modules/.bin/tsc)
  ✓ security    npm audit  (npm)
  ✓ test        npm test

  Python
  ✓ format      ruff       (/usr/local/bin/ruff)
  ✗ lint        ruff       → pip install ruff          [ERROR]
  ✓ type-check  pyright    (node_modules/.bin/pyright)
  ✗ security    bandit     → pip install bandit        [ERROR]
  ✗ test        pytest     → pip install pytest        [WARNING]

  2 errors · 1 warning
  Run: codi hooks doctor --fix
```

With `--fix`:
- Runs each install command interactively with `stdio: 'inherit'` so prompts (sudo, brew) are visible
- Re-checks after install
- Exits 0 if all required tools now present

`codi hooks reinstall` re-runs the full hook generation + installation for the current detected stack without changing any configuration.

---

## Files Changed

| File | Change type |
|------|-------------|
| `src/core/hooks/hook-registry.ts` | Extend `HookEntry` interface, fill gaps for all 14 languages, add `installHint` to every entry |
| `src/core/hooks/hook-dependency-checker.ts` | Return `DependencyDiagnostic[]` instead of string[], add severity, add resolvedPath |
| `src/core/hooks/hook-installer.ts` | Generate tool-presence checks into hook scripts (blocking for required, warning for format) |
| `src/core/hooks/hook-templates.ts` | Add `GITLEAKS_CHECK_TEMPLATE` as universal security hook; retire regex secret-scan as primary |
| `src/core/hooks/hook-registry.ts` | Add `GLOBAL_HOOKS` export — an ordered array of `HookEntry` items that run before all language hooks. Gitleaks is the first entry. `generateHooksConfig` in `hook-config-generator.ts` inserts `GLOBAL_HOOKS` at Stage 2 before language-specific entries. |
| `src/cli/hooks.ts` | New file: `codi hooks doctor [--fix]` and `codi hooks reinstall` commands |
| `src/cli.ts` | Register `hooks` subcommand using `registerHooksCommand` pattern (matches existing `registerDoctorCommand` pattern) |
| `src/core/hooks/hook-config-generator.ts` | Insert gitleaks hook at Stage 1 before language hooks; wire new `required` field |

---

## Execution Order After Change

```
git commit
  └── pre-commit hook
        Stage 1: junk-check, file-size, import-depth, doc-naming   (fast rejects)
        Stage 2: gitleaks (universal security)                       ← NEW position
        Stage 3: secret-scan fallback (warn if gitleaks missing)     ← demoted
        Stage 4: skill/artifact validation                           (codi-internal)
        Stage 5: language hooks — format → lint → type-check → security
                   missing required tool → block with install hint   ← NEW behavior
                   missing format tool   → warn, skip, continue      ← NEW behavior
        Stage 6: tests (if test_before_commit enabled)
  └── commit-msg hook (conventional commit format)

git push
  └── pre-push hook (doc-stamp check on protected branches)
```

---

## Testing Approach

- Unit tests in `tests/unit/hooks/` covering:
  - `HookEntry` contract completeness — assert every language has all 5 categories defined
  - `DependencyDiagnostic` severity mapping — required tools map to `error`, format to `warning`
  - Generated hook script contains tool-presence check for each required tool
  - `installHint` is non-empty for every registry entry
- Integration test: run generated hook script in a temp dir with a missing tool, assert exit code 1 and correct error message
- Existing 1804 tests must continue to pass
