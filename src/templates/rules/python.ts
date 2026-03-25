export const template = `---
name: {{name}}
description: Python-specific conventions — typing, data models, testing, resource management
priority: medium
alwaysApply: false
managed_by: codi
language: python
---

# Python Conventions

## Type Hints
- Add type hints to all function signatures — parameters and return types
- Use \`Optional[T]\` or \`T | None\` (3.10+) for nullable values
- Use \`TypedDict\` for dictionary shapes, \`Protocol\` for structural typing
- Run mypy or pyright in CI — treat type errors as bugs; they catch real issues before runtime

\`\`\`python
# BAD: no type hints
def get_user(id):
    return db.find(id)

# GOOD: typed signature
def get_user(user_id: str) -> User | None:
    return db.find(user_id)
\`\`\`

## Data Models
- Use dataclasses for simple data containers
- Use Pydantic for models with validation (API inputs, config files)
- Prefer immutable models: \`frozen=True\` on dataclasses — prevents accidental mutation after creation
- Never use plain dicts for structured data — define a model; dicts have no validation and no IDE support

## Resource Management
- Use context managers (\`with\`) for files, connections, locks
- Implement \`__enter__\`/\`__exit__\` for custom resources
- Close database connections in finally blocks
- Use \`contextlib.asynccontextmanager\` for async resources

## Error Handling
- Define custom exception classes for domain errors
- Catch specific exceptions — never bare \`except:\`; bare except catches KeyboardInterrupt and SystemExit
- Use \`logging\` module — never \`print()\` for operational output; logging supports levels, formatting, and routing
- Include context in error messages: what failed, with what input

## Testing
- Use pytest with fixtures for test setup and teardown
- Name tests descriptively: \`test_<action>_<condition>_<expected>\`
- Use \`parametrize\` for testing multiple inputs against same logic
- Mock only external dependencies (APIs, databases, file system)

## Formatting & Style
- Use f-strings for string formatting — no \`%\` or \`.format()\`
- Follow PEP 8 — enforce with ruff or black; automated formatting eliminates style debates
- Use pathlib.Path over os.path for file operations — cleaner API and cross-platform by default
- Prefer list/dict/set comprehensions over manual loops for transformations
`;
