# Troubleshooting

Common issues and their solutions when working with Codi.

## Installation Issues

### Node.js version too old

**Error**: Codi requires Node >= 20.

**Fix**:

```bash
nvm install 20
nvm use 20
```

### `codi` command not found

**Fix**: Use npx or install globally:

```bash
# Via npx (no global install needed)
npx codi --version

# Or install globally
npm install -g codi-cli
```

If installed as a dev dependency, use `npx codi` or add a script to `package.json`.

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

### Pre-commit hooks not running

Hooks are installed automatically by `codi init` and `codi generate`. If they're not running:

1. Check if hooks exist: `ls .git/hooks/pre-commit`
2. Reinstall: `codi generate`
3. If using Husky: verify `.husky/pre-commit` exists

### Hook tool not found ("command not found")

Pre-commit hooks require language-specific tools. Install them for your stack:

| Language | Tools | Install |
|----------|-------|---------|
| TypeScript/JS | eslint, prettier, tsc | `npm install -D eslint prettier typescript` |
| Python | ruff, pyright | `pip install ruff pyright` |
| Go | golangci-lint, gofmt | `go install github.com/golangci-lint/golangci-lint/cmd/golangci-lint@latest` |
| Rust | clippy, rustfmt | `rustup component add clippy rustfmt` |
| Java | google-java-format | `brew install google-java-format` |
| Kotlin | ktfmt, detekt | `brew install ktfmt detekt` |
| Swift | swiftformat, swiftlint | `brew install swiftformat swiftlint` |

Run `codi doctor` to check which tools are missing.

### Commit message rejected

The commit-msg hook enforces conventional commits format. Valid format:

```
type(scope): description
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`

First line must be ≤72 characters. Use imperative mood: "add feature" not "added feature".

### Disabling hooks temporarily

Use `--no-verify` only in emergencies. Codi strongly discourages bypassing hooks — fix the underlying issue instead.

## Debug Tips

- Use `--verbose` flag for detailed logging on any command
- Use `--json` flag for machine-readable output
- Check `.codi/operations-ledger.json` for event history (generate, update, clean, init)
- Use `codi compliance` for a comprehensive health report
- Use `codi revert --list` to see available backups if generation went wrong
