# Contributing to Codi

Thank you for your interest in contributing to Codi. This guide covers development setup, code conventions, and how to add new features.

## Development Setup

```bash
git clone https://github.com/lehidalgo/codi.git
cd codi
npm install
npm run build
npm test
```

**Requirements**: Node.js >= 24 (see `.nvmrc`). If your system Node is older, the [curl installer](https://lehidalgo.github.io/codi/install.sh) installs nvm + Node 24 for you.

### Running the Local Build

After cloning, you need to understand which code runs when you type `codi`:

#### How binary resolution works

When you install codi globally (`npm i -g codi-cli`), npm creates a symlink:

```
~/.nvm/.../bin/codi → ~/.nvm/.../lib/node_modules/codi-cli/dist/cli.js
```

This points to the **published npm package**, not your local source code. So even after you `npm run build` locally, `codi` and `npx codi` still execute the published version.

| Command | Executes | Source |
|---------|----------|--------|
| `codi` | Global symlink | Published npm package |
| `npx codi` | Same as above | Published npm package |
| `node dist/cli.js` | Local `dist/cli.js` | Your local build |
| `npm start` | Local `dist/cli.js` | Your local build |

#### Option 1: Use `npm start` (safe, no side effects)

```bash
npm run build          # compile src/ → dist/
npm start              # runs local dist/cli.js (equivalent to "codi")
npm start -- init      # runs "codi init" from local build
npm start -- doctor    # runs "codi doctor" from local build
```

#### Option 2: Use `npm link` (replaces global binary)

`npm link` replaces the global symlink to point at your local checkout:

```bash
npm link               # symlinks global "codi" → your local dist/cli.js
```

After linking:
```
~/.nvm/.../lib/node_modules/codi-cli → /path/to/your/local/codi
```

Now `codi` and `npx codi` run your local build. Every time you `npm run build`, changes are reflected immediately — no reinstall needed.

To revert when done:

```bash
npm unlink -g codi-cli # remove the symlink
npm i -g codi-cli      # reinstall from npm registry
```

#### Version injection

The `VERSION` constant is injected at build time from `package.json` via tsup's `define` option — there is no hardcoded version string in the source. When `npm version` bumps `package.json`, the next `npm run build` picks up the new version automatically.

### Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Run the local CLI build |
| `npm run build` | Build with tsup |
| `npm test` | Run tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run lint` | Type check (`tsc --noEmit`) |
| `npm run dev` | Build in watch mode |

## Project Structure

```
src/
  adapters/           # Agent-specific output formatters (6 agents)
    claude-code.ts    # Claude Code adapter
    cursor.ts         # Cursor adapter
    codex.ts          # Codex (OpenAI) adapter
    windsurf.ts       # Windsurf adapter
    cline.ts          # Cline adapter
    copilot.ts        # GitHub Copilot adapter
    flag-instructions.ts  # Flag-to-instruction mapping
    generated-header.ts   # Traceability headers
    skill-generator.ts    # Skill file generation
  cli/                # CLI command handlers (one file per command)
    init.ts           # codi init
    init-wizard.ts    # Interactive init wizard
    generate.ts       # codi generate
    validate.ts       # codi validate
    status.ts         # codi status
    add.ts            # codi add rule/skill/agent
    verify.ts         # codi verify
    doctor.ts         # codi doctor
    update.ts         # codi update
    clean.ts          # codi clean
    compliance.ts     # codi compliance
    watch.ts          # codi watch
    ci.ts             # codi ci
    revert.ts         # codi revert
    preset.ts         # codi preset
    shared.ts         # Shared CLI utilities
  cli.ts              # Command registration and entry point
  core/               # Business logic
    audit/            # Audit log (append-only JSONL)
    backup/           # Automatic backup before generate
    config/           # Config resolution
    flags/            # Flag catalog, merging, enforcement
    generator/        # Output file generation orchestrator
    hooks/            # Pre-commit hook management
    migration/        # Migration from existing agent configs
    output/           # File writing with hash tracking
    preset/           # Preset management
    scaffolder/       # Directory and file scaffolding
    verify/           # Token generation and response validation
    version/          # Version enforcement (semver)
  schemas/            # Zod schemas for config, flags, artifacts
  templates/          # Built-in templates
    rules/            # 28 rule templates
    skills/           # 65 skill templates
    agents/           # 22 agent templates
    hooks/            # 3 hook templates
  types/              # TypeScript type definitions
  utils/              # Shared utilities (logger, errors, hashing)
  index.ts            # Public API exports
```

## Code Conventions

- **TypeScript strict mode** with ESM modules
- **Max 700 lines** per source file -- split into focused modules
- **Result pattern** for error handling -- return errors, never throw for expected failures
- **Zod schemas** for all validation (config, flags, artifacts)
- **Conventional commits**: `feat(scope):`, `fix(scope):`, `docs:`, `refactor:`, `test:`, `chore:`
- **camelCase** for variables and functions, **PascalCase** for types and classes
- **kebab-case** for file names
- Functions under 30 lines; extract when longer
- No `any` types -- use strict typing everywhere
- Import order: external libraries, internal modules, types

## Adding New Features

### Adding a Rule Template

1. Create `src/templates/rules/{name}.ts` exporting a template object
2. Export from `src/templates/rules/index.ts`
3. Add to `TEMPLATE_MAP` in the template loader
4. Add tests in `tests/unit/templates/`
5. Run `npm test` to verify

### Adding a Skill Template

1. Create a directory `src/templates/skills/{name}/` with:
   - `template.ts` — exports the SKILL.md content string
   - `index.ts` — re-exports `{ template }` from `./template.js`
   - (optional) `assets/`, `evals/`, `references/`, `scripts/`, `agents/` — static files copied during scaffolding
2. Export from `src/templates/skills/index.ts`
3. Add to the skill template map in `skill-template-loader.ts`
4. If the skill has static files (any of the optional dirs above):
   - Add `export const staticDir = resolveStaticDir("{name}", import.meta.url);` to `index.ts`
   - Export `staticDir` from `src/templates/skills/index.ts` (e.g., `staticDir as mySkillStaticDir`)
   - Register in `STATIC_DIR_MAP` in `src/core/scaffolder/skill-template-loader.ts`
5. If adding evals, create `evals/evals.json` with at least 5 cases (3 positive, 2 negative). See `src/templates/skills/skill-creator/references/schemas.md` for the schema.
6. Add tests
7. Run `pnpm test`

### Adding an Agent Template

1. Create `src/templates/agents/{name}.ts` exporting a template object
2. Export from `src/templates/agents/index.ts`
3. Add to the agent template map in the template loader
4. Add tests
5. Run `npm test`

### Adding a New Flag

1. Add the flag definition to `src/core/flags/flag-catalog.ts`:
   ```typescript
   my_new_flag: {
     type: 'boolean',    // boolean, number, enum, string[]
     default: false,
     hook: null,         // or hook name if it triggers a pre-commit hook
     description: 'What this flag controls',
   },
   ```
2. Add to all 6 presets in `src/templates/presets/` (minimal, balanced, strict, fullstack, power-user, development)
3. If the flag should generate agent instructions, add to `src/adapters/flag-instructions.ts`
4. Update the flag count in tests (`tests/unit/flags/flag-catalog.test.ts`)
5. Run `npm test`
6. Submit PR

### Adding a New CLI Command

1. Create `src/cli/{name}.ts` with a handler function and a register function
2. The register function receives the Commander program and adds the command
3. Register it in `src/cli.ts` by importing and calling the register function
4. Add unit tests in `tests/unit/cli/{name}.test.ts`
5. Run `npm test`

### Adding a New Adapter

1. Create `src/adapters/{name}.ts` implementing the adapter interface
2. Export from `src/adapters/index.ts`
3. Add the agent ID to the supported agents list in schemas
4. Implement `generate()` returning the formatted output string
5. Add integration tests
6. Run `npm test`

## Testing

Codi uses [Vitest](https://vitest.dev/) for testing.

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test organization

- `tests/unit/` -- unit tests mirroring `src/` structure
- `tests/integration/` -- integration and E2E tests
- Follow the arrange-act-assert (AAA) pattern
- Use descriptive test names: `should [behavior] when [condition]`
- Mock only external dependencies (file system, network)
- Maintain minimum 80% code coverage

## Pull Request Process

1. **Fork** the repository and create a feature branch (`feature/my-feature` or `fix/my-fix`)
2. **Make changes** following the code conventions above
3. **Add tests** for new functionality or bug fixes
4. **Ensure all tests pass**: `npm test`
5. **Ensure types check**: `npm run lint`
6. **Submit a PR** with a clear description of what changed and why
7. PRs require review before merging

### Commit message format

```
type(scope): short description

Optional longer description explaining the motivation
and any important context.
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`

## Test Coverage

<!-- GENERATED:START:test_coverage -->
| Metric | Coverage | Threshold | Status |
|:-------|--------:|--------:|:------:|
| Statements | 74.2% | 70% | Pass |
| Branches | 66.4% | 63% | Pass |
| Functions | 77.6% | 73% | Pass |
| Lines | 75.8% | 70% | Pass |

**Module thresholds:**

| Module | Stmts | Branch | Funcs | Thresholds (S/B/F) |
|:-------|------:|-------:|------:|:-------------------|
| adapters | 94.9% | 92.4% | 100.0% | 93% / 90% / 100% |
| core/config | 78.2% | 66.3% | 96.1% | 76% / 64% / 94% |
| core/flags | 92.5% | 87.6% | 100.0% | 90% / 85% / 100% |
| core/verify | 97.9% | 96.8% | 95.0% | 95% / 94% / 93% |
| schemas | 100.0% | 100.0% | 100.0% | 100% / 100% / 100% |
| utils | 97.6% | 94.4% | 100.0% | 95% / 92% / 100% |
<!-- GENERATED:END:test_coverage -->

## Documentation

When making changes that affect behavior, update the relevant documentation. See [Maintaining Docs](docs/project/maintaining-docs.md) for guidelines on which files to update and how to keep docs in sync with code.

## Questions?

Open an issue on [GitHub](https://github.com/lehidalgo/codi/issues).
