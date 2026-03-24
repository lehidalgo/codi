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

**Requirements**: Node.js >= 20 (see `.nvmrc`).

### Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build with tsup |
| `npm test` | Run tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run lint` | Type check (`tsc --noEmit`) |
| `npm run dev` | Build in watch mode |

## Project Structure

```
src/
  adapters/           # Agent-specific output formatters (5 agents)
    claude-code.ts    # Claude Code adapter
    cursor.ts         # Cursor adapter
    codex.ts          # Codex (OpenAI) adapter
    windsurf.ts       # Windsurf adapter
    cline.ts          # Cline adapter
    flag-instructions.ts  # Flag-to-instruction mapping
    generated-header.ts   # Traceability headers
    skill-generator.ts    # Skill file generation
  cli/                # CLI command handlers (one file per command)
    init.ts           # codi init
    init-wizard.ts    # Interactive init wizard
    generate.ts       # codi generate
    validate.ts       # codi validate
    status.ts         # codi status
    add.ts            # codi add rule/skill/agent/command
    verify.ts         # codi verify
    doctor.ts         # codi doctor
    update.ts         # codi update
    clean.ts          # codi clean
    compliance.ts     # codi compliance
    watch.ts          # codi watch
    ci.ts             # codi ci
    revert.ts         # codi revert
    marketplace.ts    # codi marketplace
    preset.ts         # codi preset
    shared.ts         # Shared CLI utilities
  cli.ts              # Command registration and entry point
  core/               # Business logic
    audit/            # Audit log (append-only JSONL)
    backup/           # Automatic backup before generate
    config/           # Config resolution (7-layer merge)
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
    rules/            # 21 rule templates
    skills/           # 13 skill templates
    agents/           # 8 agent templates
    commands/         # 8 command templates
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

1. Create `src/templates/skills/{name}.ts` exporting a template object
2. Export from `src/templates/skills/index.ts`
3. Add to the skill template map in the template loader
4. Add tests
5. Run `npm test`

### Adding an Agent Template

1. Create `src/templates/agents/{name}.ts` exporting a template object
2. Export from `src/templates/agents/index.ts`
3. Add to the agent template map in the template loader
4. Add tests
5. Run `npm test`

### Adding a Command Template

1. Create `src/templates/commands/{name}.ts` exporting a `template` string
2. Export from `src/templates/commands/index.ts`
3. Add to `TEMPLATE_MAP` in `src/core/scaffolder/command-template-loader.ts`
4. Run `npm test`
5. Submit PR

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
2. Add to all 3 presets in `src/core/flags/flag-presets.ts` (minimal, balanced, strict)
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

## Questions?

Open an issue on [GitHub](https://github.com/lehidalgo/codi/issues).
