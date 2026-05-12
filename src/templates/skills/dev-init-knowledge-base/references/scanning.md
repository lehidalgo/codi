# Codebase scanning procedure

Targeted reads to extract the project's existing domain vocabulary.

## Scan order

```bash
git ls-files | head -200          # overview of structure
```

Read in this order:

1. `README.md` — stated purpose, intended audience, core entities mentioned.
2. `package.json` (Node) / `pyproject.toml` (Python) / `Cargo.toml` (Rust) / equivalent — declared dependencies and module names.
3. Top-level source directories under `src/`, `lib/`, `app/`, or the project's convention.
4. A handful of representative source files in each top-level area (5–10 files total, not exhaustive).

## What to extract

- **Recurring nouns** in file names, function names, and module names → domain entities.
- **Unique terms** that would confuse a newcomer → need definitions.
- **Acronyms and short codes** specific to the project.
- **Verbs** that name workflows or processes specific to this domain.

## What NOT to do

- Read every file. Sampling is enough.
- Invent terms not present in the codebase.
- Import generic terms (User, Account, Service) without checking what the project actually uses.
- Read in dependency order across all transitive deps. Top-level project structure is the target.

## Stopping criterion

When you have 5–15 high-value candidate terms with evidence (file:line) for each, stop scanning and proceed to propose. The list grows inline during workflows; bootstrap is the seed, not the final glossary.
