# ADR-v3ed0-003: Tiered capabilities matrix (Tier 1 + Tier 2 + Tier 3)

- **Date**: 2026-05-08 14:09
- **Document**: 20260508*140925*[ARCHITECTURE]\_adr-v3ed0-003-tiered-capabilities.md
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Source decision**: Z3 (grilling final ed.0) + Q28-Q29 (v3-consolidated)

## Context

Codi v2 actual genera configs para 7+ targets: Claude Code, Codex, Cursor, Windsurf, Cline, GitHub Copilot, Gemini, opencode. La directiva inicial fue limitar v3 ed.0 a Codex + Claude Code only para mantener focus.

Sin embargo, la realidad técnica es que cada target tiene capacidades distintas. Eliminar adapters de Cursor/etc rompe users actuales sin ganancia real, porque esos targets nunca soportaron Anthropic hook protocol de todos modos — no perderían "features de v2" al subir a v3.

Tres opciones evaluadas:

- **A — `_deprecated/` folder**: targets no-Tier1 congelados.
- **B — Eliminación**: delete completo de adapters no-soportados.
- **C — Feature flag opt-in**: targets gated detrás de `experimental.targets`.
- **D — Tiered capabilities matrix**: cada target declara qué soporta; el generator emite solo eso.

## Decision

Adoptamos **Opción D — Tiered capabilities matrix**.

Cada target tiene un `capabilities.ts` que declara explícitamente qué soporta:

```typescript
export const claudeCodeCapabilities: TargetCapabilities = {
  tier: "full", // Tier 1
  skills: true,
  rules: true,
  agents: true,
  commands: true,
  settings: true,
  hooks_runtime: true,
  capture_markers: true,
  brain_sync_runtime: true,
  workflows_phase_locked: true,
  plugin_distribution: true,
};

export const cursorCapabilities: TargetCapabilities = {
  tier: "config-only", // Tier 2
  skills: true,
  rules: true,
  agents: false,
  commands: false,
  settings: false,
  hooks_runtime: false,
  capture_markers: false,
  brain_sync_runtime: false,
  workflows_phase_locked: false,
  plugin_distribution: false,
};
```

`codi generate --target=cursor` produce solo lo que cursor soporta. Sin warnings molestos, sin restricciones artificiales.

### Tier 1 — Full (2 targets)

- **Claude Code**: Anthropic hook protocol nativo, full features.
- **Codex CLI**: hook protocol compartido, paths asimétricos (`.agents/skills/` no `.codex/skills/`), `commit_attribution = ""`, `trust_level = "trusted"`, `AGENTS.override.md`.

### Tier 2 — Config-only (5 targets)

- **Cursor**: `.cursor/rules`, `.cursor/skills/`, `.cursor/mcp.json`.
- **Windsurf**: `.windsurfrules`, `.windsurf/skills/`.
- **Cline**: `.clinerules`, `.cline/skills/`.
- **GitHub Copilot**: `.github/copilot-instructions.md`, `.github/instructions/`, `.github/agents/`.
- **Gemini**: `.gemini/commands/*.toml`.

### Tier 3 — Future evaluation (no en v3 ed.0)

- opencode, Antigravity, Q Developer, Continue: evaluables case-by-case post-v3.0.

## Consequences

### Positivas

- **Zero breaking change para users existentes**: Cursor/Windsurf/etc siguen funcionando como antes.
- **Tu directiva "limit focus" se respeta a nivel runtime**: hooks + brain SQLite + UI consolidación son inversión Tier 1 only.
- **Codi v2 generators preservados**: el código de adapters Tier 2 sigue activo, solo se anota con capabilities matrix.
- **Path de upgrade claro**: dev en Tier 2 que quiere features Tier 1 cambia a Claude Code/Codex sin reinstall — `codi generate` re-emite con capabilities full.
- **Documentación clara**: README explica qué Tier ofrece qué; sin restricciones sorpresa.
- **Tests dimension claro**: tests Tier 1 extensos (runtime), Tier 2 simples (config files generados).

### Negativas

- **Bundle size**: ~5-10 KB extra por target inactivo. Mitigable con tree-shaking en build production.
- **Testing matrix**: 7 targets × tests = más combinaciones. Mitigado: Tier 2 tests son trivial (file generation), Tier 1 tests son los que importan.

## Alternatives considered

### Opción A (`_deprecated/` folder) — descartada

- Pros: simplicidad, congelar targets no-Tier1.
- Contras: rompe users existentes que dependen de Cursor/etc, pierde valor del trabajo Codi v2 sin razón técnica.

### Opción B (Eliminación) — descartada

- Pros: codebase mínimo.
- Contras: hostile a users existentes, irreversible barato.

### Opción C (Feature flag opt-in) — descartada

- Pros: flexibilidad máxima.
- Contras: contradice "limit focus", duplica testing matrix sin beneficio.

## Implementation

Sprint 6 del roadmap (semanas 12-13):

1. Crear `src/generators/<target>/capabilities.ts` para cada target.
2. Refactor existing generators para consultar capabilities antes de emit.
3. `codi generate` valida `capabilities.tier !== 'unsupported'`.
4. Tests dimension: separar Tier 1 (runtime) de Tier 2 (config-only).
5. README explica matriz tiered.

## Related ADRs

- ADR-v3ed0-009: Plugin distribution dual track (aplica solo Tier 1 con plugin manifests).
- ADR-v3ed0-007: 4 features arquitectónicas (capture markers + brain SQLite son Tier 1 only).
