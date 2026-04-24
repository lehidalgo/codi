# Troubleshooting

Common issues and their solutions when working with Codi.

## Installation Issues

### EACCES: permission denied during `npm install -g codi-cli`

**Error**: `EACCES: permission denied, mkdir '/usr/local/lib/node_modules/codi-cli'`

This happens when system Node is installed under `/usr/local` (root-owned) and `npm install -g` cannot create the package directory without `sudo`.

**Fix (recommended)**: use the curl installer, which sets up nvm + Node 24 under `~/.nvm` (no sudo, no root):

```bash
curl -fsSL https://lehidalgo.github.io/codi/install.sh | bash
```

**Why not `sudo npm install -g`?** It works once but leaves root-owned files in your `~/.npm` cache that break future installs and updates.

### Node.js version too old

**Error**: Codi requires Node >= 24 (npm 11+ for OIDC publish).

**Fix (recommended)** — let the installer handle it:

```bash
curl -fsSL https://lehidalgo.github.io/codi/install.sh | bash
```

**Or manually** with nvm:

```bash
nvm install 24
nvm use 24
nvm alias default 24
```

### `codi` command not found

**Fix**: Use npx, install via the curl installer, or install globally:

```bash
# Via curl installer (handles Node setup if missing)
curl -fsSL https://lehidalgo.github.io/codi/install.sh | bash

# Via npx (no global install needed)
npx codi --version

# Or install globally (requires Node 24+ and a writable npm prefix)
npm install -g codi-cli
```

If installed as a dev dependency, use `npx codi` or add a script to `package.json`.

### Verifying the installer before running it

For security-conscious environments, verify the script's checksum before piping to bash:

```bash
curl -fsSL https://lehidalgo.github.io/codi/install.sh -o install.sh
curl -fsSL https://lehidalgo.github.io/codi/install.sh.sha256 -o install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
```

The installer also supports `CODI_DRY_RUN=1` to preview the actions without executing them.

## Configuration Issues

### `codi validate` fails

Run with JSON output to see specific errors:

```bash
codi validate --json
```

Common causes:
- Missing `name` or `version` in `codi.yaml`
- Invalid flag names in `flags.yaml`
- Malformed YAML syntax

### Unknown flag error

Check spelling in `flags.yaml`. Valid flags are listed in the flag catalog. Run `codi validate` to see which flags are unrecognized.

### Version mismatch

If `codi.requiredVersion` is set in `codi.yaml` and your installed version is too old:

```bash
npm install -D codi-cli@latest
```

## Adding artifacts from external sources

The "Customize codi setup → Add from local directory / ZIP / GitHub repo" workflow installs artifacts into `.codi/` from outside the codi-cli package.

### Source layout requirements

The source must follow the standard codi layout. Codi walks four directories:

- `rules/` — `.md` files with frontmatter
- `agents/` — `.md` files with frontmatter
- `skills/` — sub-directories, each containing a `SKILL.md`
- `mcp-servers/` — `.yaml` files

Missing directories are silently skipped (a source can carry just one type). Files without valid frontmatter or skills missing `SKILL.md` are skipped with a warning.

### Where externally-added artifacts live

Each installed artifact is copied verbatim into the matching `.codi/` subdirectory and recorded in `artifact-manifest.json` with `managedBy: user` plus a `source:` field (e.g. `"github:org/repo@v1"`). The `managedBy: user` flag tells `codi update` to leave the file alone — your imported artifacts will not be overwritten when codi templates change.

### Filename collisions

When an imported artifact has the same name as one already in `.codi/`, codi prompts per artifact:

- **Keep current** — skip the import (default)
- **Overwrite with imported** — replace the existing file
- **Rename imported to `<name>-from-<source>`** — keep both, suffix the new one

After the first prompt, an "apply to remaining" option lets you bulk-resolve the rest with one choice.

### "No codi artifacts found"

The source directory does not contain any of the four standard subdirectories at its root, or all entries failed validation. Verify the source layout matches the requirements above.

### GitHub: "Failed to clone"

The installer uses `git clone --depth 1` and supports public repos only. Private repositories require manual clone + "Add from local directory" instead. Specs can take any of:

- `org/repo`
- `org/repo@v1.2.0`
- `github:org/repo@<sha>`
- `https://github.com/org/repo.git`

## Generation Issues

### Drift detected

`codi status` reports files as "drifted" when generated files have been manually edited.

**Fix**: Regenerate from current config:

```bash
codi generate
```

To see which files drifted:

```bash
codi status --json
```

### Files not updating

Only artifacts with `managed_by: codi` are updated during generation. User-created artifacts (`managed_by: user`) are preserved.

To refresh all managed artifacts:

```bash
codi update --rules --skills --agents --commands
```

### Generated file overwritten manually

If you need persistent changes, edit the source in `.codi/rules/` instead of the generated file. Running `codi generate` always overwrites generated output.

## Verification Issues

### Token mismatch

The token is a hash of your current configuration. If config changed since last generate, the token will not match.

**Fix**: Regenerate first, then verify:

```bash
codi generate
codi verify
```

### Rules not found in `verify --check`

The parser accepts multiple formats for rule listings:
- `Rules (N): rule1, rule2`
- `Rules loaded: rule1, rule2`
- `Rules: rule1, rule2`
- `- Rules: rule1, rule2`

Paste the full agent response including the token line.

## Watch Mode Issues

### Watch not triggering

The `auto_generate_on_change` flag must be enabled in `flags.yaml`:

```yaml
auto_generate_on_change:
  mode: enabled
  value: true
```

Then run:

```bash
codi watch
```

### Watch regenerates too often

The watcher uses debouncing to batch rapid changes. If saving multiple files at once triggers multiple regenerations, this is expected behavior -- only the final debounced run produces output.

## Preset Issues

### Preset not found

Check that the preset directory exists at `.codi/presets/{name}/` with a `preset.yaml` file.

For built-in presets, use one of: `minimal`, `balanced`, `strict`, `fullstack`, `development`, `power-user`.

### Preset install fails

When installing from a remote repo:

```bash
codi preset install name --from org/repo
```

Ensure the repository is accessible and contains a valid preset structure.

## CI Issues

### `codi doctor --ci` exits non-zero

This is expected behavior -- `--ci` mode exits with a non-zero code when any check fails. Review the output to see which checks failed (config validity, version, drift).

### `codi ci` fails in pipeline

`codi ci` runs `validate + doctor --ci`. Make sure generated files are committed and up to date before pushing.

## Hook Issues

Pre-commit hooks are one of Codi's core features. They run automatically on every commit and catch real problems — leaked secrets, broken imports, invalid skill definitions, oversized files — before they enter the repository. When a hook blocks a commit, it means a real issue was found. The right response is always to fix the issue, not to skip the hook.

The sections below cover every common failure mode and how to resolve it. If your situation is not listed, ask the coding agent directly — see [Using the coding agent to fix hook problems](#using-the-coding-agent-to-fix-hook-problems) below.

### Pre-commit hooks not running

Hooks are installed by `codi init` and regenerated by `codi generate`. If they are not running on commit:

1. Check the hook file exists:
   ```bash
   ls -la .git/hooks/pre-commit
   ls -la .husky/pre-commit   # if using Husky
   ```
2. Check the hook is executable:
   ```bash
   chmod +x .git/hooks/pre-commit
   ```
3. Reinstall all hooks:
   ```bash
   codi generate
   ```
4. Run `codi doctor` to check for environment issues.

### Hook tool not found or skipped

Codi skips hooks for tools that are not installed and prints a notice:

```
[python]
  Running ruff-check... skipped (tool not installed)
```

Skipped hooks do not block commits. To activate them, install the missing tool:

| Language | Tool | Install command |
|----------|------|----------------|
| TypeScript/JS | eslint, prettier | `npm install -D eslint prettier` |
| TypeScript/JS | tsc | `npm install -D typescript` |
| Python | ruff | `pip install ruff` or `uv add --dev ruff` |
| Python | pyright | `npm install -D pyright` |
| Python | bandit | `pip install bandit` or `uv add --dev bandit` |
| Python | pytest | `pip install pytest` or `uv add --dev pytest` |
| Go | golangci-lint | `go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest` |
| Go | gofmt | included with Go installation |
| Rust | clippy, rustfmt | `rustup component add clippy rustfmt` |
| Java | google-java-format | `brew install google-java-format` |
| Kotlin | ktfmt, detekt | `brew install ktfmt detekt` |
| Swift | swiftformat, swiftlint | `brew install swiftformat swiftlint` |
| Ruby | rubocop | `gem install rubocop` |
| PHP | php-cs-fixer, phpstan | `composer require --dev friendsofphp/php-cs-fixer phpstan/phpstan` |

After installing, run `codi doctor` to confirm the tool is detected.

### Linting or formatting hook failed

ESLint, Prettier, ruff, and similar formatters run automatically and re-stage fixed files. If the hook reports a failure, the tool found an error it could not auto-fix:

1. Read the full error output — it includes the file path and line number.
2. Open the file and fix the reported issue.
3. Stage the fix and commit again.

For ESLint specifically: if a rule is too strict for your project, disable it in `.eslintrc` or `eslint.config.js` — never use `// eslint-disable` inline unless there is a documented reason.

### Type checking hook failed (tsc / pyright)

A type error was found in staged files. Fix the type error — do not add `@ts-ignore` or `type: ignore` comments to silence it, as those hide real bugs.

If the error is in generated code or a third-party declaration file, suppress it at the source (update the type definition or generator config) rather than in the consuming code.

### Tests failed before commit

The test runner hook caught a regression. Do not bypass it. Fix the failing test first:

1. Run the test suite locally to see the full output:
   ```bash
   npm test         # Node.js projects
   pytest           # Python projects
   go test ./...    # Go projects
   cargo test       # Rust projects
   ```
2. Fix the failing test or the code that broke it.
3. Commit once tests pass.

To run a faster subset of tests on each commit (e.g. unit tests only), add a `test:pre-commit` script to `package.json`:

```json
"scripts": {
  "test:pre-commit": "vitest run tests/unit tests/integration"
}
```

Codi uses `test:pre-commit` automatically when it exists, falling back to the default test command.

### Secret detected in staged files

The secret scanner found a pattern that matches a credential. Inspect the flagged file and line:

1. If it is a real secret: remove it immediately, rotate the credential, and check git history.
2. If it is a false positive (example value, test fixture, env var reference): add it to the `.codi/secret-scan-allowlist` or use a placeholder pattern that the scanner recognises as safe (e.g. `process.env.API_KEY`).

Never commit real credentials. Automated scanners index GitHub within minutes of a push.

### Staged junk files blocked a commit

The staged-junk-check hook found OS noise files or build cache directories in the staged changes. These files should never enter the repository.

**Fix**: Unstage the listed files and add them to `.gitignore`:

```bash
# Unstage the files shown in the hook output
git rm --cached .DS_Store
git rm --cached -r __pycache__

# Add to .gitignore if not already there
echo ".DS_Store" >> .gitignore
echo "__pycache__/" >> .gitignore
```

The hook output includes the exact `git rm --cached` command needed — copy it directly.

Patterns the hook blocks: `.DS_Store`, `Thumbs.db`, `desktop.ini`, `__pycache__/`, `.pyc`, `.pyo`, `.pytest_cache/`, `.mypy_cache/`, `.class`.

### File size check blocked a commit

A staged file exceeds the configured line limit (default: 700 lines). This is intentional — large files signal mixed responsibilities.

Options:
- Split the file into smaller modules.
- If the file is legitimately large (generated code, a data file, a lock file), add its path pattern to the exclusion list in `.codi/flags.yaml`:
  ```yaml
  file_size_check:
    exclude_patterns:
      - "src/generated/**"
  ```
- Regenerate hooks after updating flags: `codi generate`.

### Import depth check blocked a commit

A TypeScript or JavaScript file uses a deep relative import (`../../`). Replace it with a path alias:

```typescript
// Before
import { UserSchema } from "../../schemas/user.js";

// After (with @/* alias configured)
import { UserSchema } from "@/schemas/user.js";
```

Configure aliases in `tsconfig.json` (`paths`) and `package.json` (`imports` for NodeNext resolution).

### Artifact validation failed

The `.codi/` directory contains invalid configuration. Run validation to see the specific errors:

```bash
codi validate
```

Fix the reported errors in the relevant rule, skill, or agent file, then commit again.

### Commit message rejected

The commit-msg hook enforces conventional commit format. Valid format:

```
type(scope): description
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`

Rules:
- First line ≤ 72 characters
- Imperative mood: "add feature" not "added feature"
- No period at the end of the subject line
- Body separated from subject by a blank line (optional)

Example: `feat(auth): add OAuth2 login with Google provider`

### Doc check blocked a push

The pre-push doc check requires documentation to be reviewed and stamped before pushing to a protected branch (`main`, `develop`, `release/*`).

1. Review the documentation in `docs/project/`.
2. Update any outdated sections.
3. Run: `codi docs-stamp`
4. Commit the stamp file and push again.

### Using the coding agent to fix hook problems

If a hook failure is unclear, ask the coding agent. Describe the error output and the agent will diagnose the root cause and propose a fix.

Example prompts:

```
The pre-commit hook is failing with this error: [paste full output].
What is causing this and how do I fix it?
```

```
My commit is blocked by the file-size-check hook. The file is generated
code that should be excluded. How do I configure the exclusion?
```

```
ESLint is reporting an error I don't understand: [paste error].
What does it mean and how do I fix it without disabling the rule?
```

The coding agent will:
1. Read the relevant hook script and configuration files.
2. Trace the exact check that is failing.
3. Propose a fix that addresses the root cause — not a workaround.

**Do not ask the agent to bypass or disable hooks.** The hooks exist to protect code quality. If a hook is producing false positives consistently, the right fix is to improve the hook configuration — the agent can help with that too.

### Disabling hooks temporarily

`--no-verify` skips all hooks. Use it only in genuine emergencies (e.g. you need to push a rollback commit urgently and the tests are broken for an unrelated reason).

```bash
git commit --no-verify -m "chore: emergency rollback"
```

After using `--no-verify`, fix the underlying issue in a follow-up commit. Never make `--no-verify` a habit — it defeats the purpose of the hook system.

## Debug Tips

- Use `--verbose` flag for detailed logging on any command
- Use `--json` flag for machine-readable output
- Check `.codi/operations-ledger.json` for event history (generate, update, clean, init)
- Use `codi compliance` for a comprehensive health report
- Use `codi revert --list` to see available backups if generation went wrong
