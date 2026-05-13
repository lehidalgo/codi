import { MAX_FUNCTION_LINES, PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Code style and formatting conventions
priority: medium
alwaysApply: true
managed_by: ${PROJECT_NAME}
version: 7
---

# Code Style

## Naming Conventions
- Variables and functions: camelCase
- Classes, interfaces, and types: PascalCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case for modules, PascalCase for components
- Booleans: prefix with is, has, can, should (e.g., isActive, hasPermission) — makes conditionals read like English

## Functions
- Keep functions under ${MAX_FUNCTION_LINES} lines — longer functions are harder to test and reason about

BAD: A 60-line function doing validation + transformation + persistence
GOOD: Three focused functions: validate(), transform(), persist()

- Single responsibility: one function does one thing
- Pure functions preferred: same input always produces same output — easier to test and cache
- Limit parameters to 3 — use an options object for more

BAD: \`createUser(name, email, role, team, isActive, notify)\`
GOOD: \`createUser({ name, email, role, team, isActive, notify })\`

## Control Flow
- Use early returns and guard clauses to handle edge cases at the top of functions — keeps the happy path at the outer scope and reduces nesting
- Prefer exhaustive pattern matching (switch/when with sealed types) over if-else chains — the compiler enforces that all cases are handled
- Avoid deep nesting: if indentation exceeds 3 levels, refactor — use early returns, extract functions, or invert conditions

## Immutability by Default
- Treat data as immutable unless mutation is explicitly required — create new objects instead of modifying existing ones
- Use language-level immutability features: const, readonly, frozen, final — mutation should require a conscious choice

## File Organization
- One primary export per file where practical — simplifies imports and dependency tracking
- Group imports: external libraries, path-aliased modules, relative modules, types
- Order imports alphabetically within each group
- Keep files focused on a single concern
- Never use deep relative imports (2+ levels of \`../\`) — use path aliases (\`#src/*\`, \`@/*\`) instead; deep traversals are fragile and unreadable

## Type Discipline
- Treat type errors as design feedback, not noise — fix the design, don't suppress the error
- Automate type generation in CI where applicable (API schemas, database types, GraphQL)

## Complexity Metrics
- Track cognitive complexity, not just line count — a 25-line function with 4 levels of nesting is harder to read than a 40-line flat function
- Configure linters to warn on cognitive complexity thresholds (e.g., SonarQube default of 15)

## Linting
- Always fix linting errors before moving to other tasks — never leave broken lint for later
- Never suppress linter warnings without a documented reason and ticket reference

## Error Handling
- Never silently swallow errors (empty catch blocks) — hidden failures cause hard-to-debug production issues
- Handle errors at the appropriate level, not everywhere
- Use typed errors when the language supports them
- Always clean up resources in finally blocks

## Dead Code
- Remove unused functions, imports, and variables — dead code misleads readers and increases maintenance burden
- Remove stale feature flags after rollout is complete — lingering flags accumulate as tech debt

## No Hardcoding — Single Source of Truth
- Never hardcode values that are defined or derivable elsewhere — duplicated lists drift and cause bugs
- Magic numbers and magic strings must be named constants with clear intent
- Dynamic lists (supported agents, preset names, template catalogs, flag keys) must be derived from their source of truth, not duplicated in arrays or sets
- Configuration values belong in environment variables, config files, or constants modules — not scattered in business logic
- If you find yourself copying a list from one file to another, extract it to a shared source and import it
- For identity unions (agent ids, status enums, target keys), declare ONE canonical \`as const\` literal tuple plus a \`type Foo = (typeof FOO_TUPLE)[number]\` alias. Every consumer imports both. Deliberate narrowings encode their constraint with \`satisfies readonly Foo[]\` so a rename at the canonical source fails compilation locally
- When the canonical literal must be embedded into a generated artifact (script template, YAML emitter, etc.), interpolate \`JSON.stringify(CANONICAL_TUPLE)\` at build time rather than re-typing the literal alongside a stale "Mirrors X" comment
- Project-name / dir / brand literals (\`.codi\`, \`"codi"\`, \`"Codi"\`, \`managed_by: "codi" | "user"\`) MUST import from \`#src/constants.js\` (\`PROJECT_DIR\`, \`PROJECT_NAME\`, \`PROJECT_NAME_DISPLAY\`, \`MANAGED_BY_FRAMEWORK\`, \`MANAGED_BY_USER\`, type \`ManagedBy\`). The CI guard \`scripts/guard-project-literals.mjs\` enforces this; comments, URLs, and the \`codi-cli\` npm package name are tolerated
- Artifact-kind literals (\`"rule" | "skill" | "agent" | "mcp-server"\` and the plural-directory variants) MUST import from \`#src/core/artifact-types.js\` (\`ArtifactType\`, \`ARTIFACT_TYPES\`, \`ARTIFACT_DIR_NAMES\`). Subset narrowings use \`Exclude<ArtifactType, …>\`. Supersets (e.g. preset-only \`+ "brand"\`) declare a local extension named explicitly and keep the canonical tuple as the base — never re-type the four kinds inline
- Scaffolders share pre-flight primitives via \`src/core/scaffolder/common.ts\` (\`validateArtifactName\`, \`ensureDir\`, \`assertNotExists\`, \`writeFileSafe\`, \`replaceNamePlaceholder\`, \`writeArtifactFile\`). New scaffolders MUST compose these helpers; do NOT duplicate the mkdir / conflict-check / write try-catch ladder per artifact kind
- Route user-facing output through \`Logger.getInstance()\` (\`src/core/output/logger.ts\`) in CLI command handlers, adapters, and core/runtime code — never raw \`console.*\`. \`console.*\` is permitted ONLY in: (a) hook template strings emitted as \`.mjs\` scripts; (b) shipped skill scripts under \`src/templates/skills/<name>/scripts/\`; (c) hook orchestrators (\`src/cli/agent-hooks.ts\`, \`src/runtime/capture/{stop,prompt,tool}-hook.ts\`) where the stderr prefix is Claude Code's protocol contract; (d) JSDoc \`@example\` blocks. The CI guard \`scripts/guard-console-usage.mjs\` enforces the boundary
- On-disk artifact layout (directory, extension, single-file vs. bundle-directory, frontmatter location) lives in \`ARTIFACT_LAYOUT\` (\`src/core/artifact-types.ts\`). Code that needs the path of an artifact MUST call \`artifactRelativePath(type, name)\` — never reconstruct \`\${dir}/\${name}.md\` inline. The \`as const satisfies Record<ArtifactType, ArtifactLayoutDef>\` enforces exhaustive coverage at compile time

BAD: \`const presets = ['minimal', 'balanced', 'strict']\` (duplicates the preset registry)
GOOD: \`const presets = getPresetNames()\` (derived from the registry)

BAD: \`if (status === 3)\` (what does 3 mean?)
GOOD: \`if (status === STATUS.APPROVED)\` (self-documenting constant)

## Comments
- Write self-documenting code first
- Comment the WHY, not the WHAT — the code already shows what it does

BAD: \`// increment counter\` above \`counter++\`
GOOD: \`// retry count resets after successful auth per RFC 6749 §4.1.3\`

- Remove commented-out code — version control has the history
- Use TODO/FIXME with ticket references, not open-ended notes`;
