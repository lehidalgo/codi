# Codi Specification v1.0

**Spec Version**: 1.0

Complete specification for the Codi unified AI agent configuration platform.

## Chapters

| # | Document | Description |
|---|----------|-------------|
| 1 | [Overview](01-overview.md) | What Codi is, design philosophy, high-level architecture |
| 2 | [Layout](02-layout.md) | `.codi/` directory structure and file conventions |
| 3 | [Manifest](03-manifest.md) | `codi.yaml` fields, types, and semantics |
| 4 | [Artifacts](04-artifacts.md) | Rules, skills, agents, commands: format, frontmatter, ownership |
| 5 | [Generation](05-generation.md) | Generation pipeline: config resolution through adapter output |
| 6 | [Hooks](06-hooks.md) | Hook system: detection, installation, templates |
| 7 | [Presets](07-presets.md) | Preset system: built-in, ZIP, GitHub, registry |
| 8 | [Flags](08-flags.md) | All 18 behavioral flags with types, defaults, and modes |
| 9 | [Verification](09-verification.md) | Token generation and compliance checking |
| 10 | [Compatibility](10-compatibility.md) | Conformance checklist and ACS compatibility |

## Reading Order

Chapters are numbered sequentially. Read 1-3 for a working understanding. Chapters 4-8 cover the core systems. Chapters 9-10 address governance and interoperability.

## Conventions

- **MUST**, **SHOULD**, **MAY** follow RFC 2119 semantics
- All paths are relative to the project root unless stated otherwise
- YAML examples use the `balanced` preset defaults unless noted
