# ADR-v3ed0-009: Plugin distribution dual track (codi generate + codi plugin publish)

- **Date**: 2026-05-08 14:09
- **Document**: 20260508*140931*[ARCHITECTURE]\_adr-v3ed0-009-plugin-distribution-dual-track.md
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Source decision**: heredada de Q29 (v3-consolidated) + Z8.F8.3

## Context

Tanto Claude Code como Codex CLI soportan distribución como **plugin oficial** (manifest + marketplace), alternativa al modelo "copiar a `.claude/`/`.codex/`" que Codi v2 usa actualmente.

| Aspecto                             | Modelo overwrite (v2)            | Modelo plugin (oficial)                                     |
| ----------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| Distribución                        | `codi generate` copia archivos   | Marketplace JSON + plugin manifest                          |
| Update                              | `codi generate --force`          | `claude plugins update codi` / `codex plugins update codi`  |
| Conflicto con artifacts del usuario | Posible (mismo path)             | Aislado en `${CLAUDE_PLUGIN_ROOT}` / `${CODEX_PLUGIN_ROOT}` |
| Versionado                          | Basado en frontmatter `version:` | SemVer en `plugin.json`                                     |
| Namespace                           | Convención `codi-*`              | Forzado por plugin id                                       |

Surge la pregunta: ¿cuál modelo adoptamos?

## Decision

**Doble track**: ambos modelos coexisten.

- **`codi generate`** (default) — sigue siendo el modo principal. Consistente con Codi v2, supports custom paths, no requiere marketplace.
- **`codi plugin publish`** (opt-in nuevo) — genera los manifests y empuja a un marketplace privado por agencia.

### Manifest Claude Code

`.claude-plugin/plugin.json`:

```json
{
  "id": "codi",
  "version": "3.0.0",
  "name": "Codi v3",
  "description": "Multi-agent harness with workflows, capture, brain SQLite",
  "skills": ["skills/codi-*/SKILL.md"],
  "agents": ["agents/codi-*.md"],
  "rules": ["rules/codi-*.md"],
  "hooks": "hooks/hooks.json",
  "commands": ["commands/codi-*.md"]
}
```

### Manifest Codex CLI

`.codex-plugin/plugin.json` schema análogo, pero:

- `skills` apunta a `.agents/skills/` (NO `.codex/skills/`).
- `agents` apunta a `.codex/agents/*.toml` (TOML schema).
- `hooks` apunta a `.codex/hooks.json`.
- Settings en `.codex/config.toml`.

### Cuándo se vuelve obligatorio

- **v3.0 ed.0**: ambos tracks. `codi generate` default. `codi plugin publish` opt-in.
- **v3.x si shipping a marketplace público**: el plugin model se vuelve obligatorio para distribución oficial via Anthropic Plugin Marketplace.

Hasta entonces, plugin model sirve como **mecanismo opt-in para agencias que quieren auto-update centralizado**.

### CLI

```bash
# Default (Codi v2 way)
codi generate                    # produce .claude/, .codex/ overwrite mode
codi generate --target=claude-code,codex
codi generate --force            # overwrite con confirmation

# Plugin track (nuevo)
codi plugin publish              # produce .claude-plugin/plugin.json + .codex-plugin/plugin.json
codi plugin publish --registry=<url>  # push a marketplace privado
codi plugin install <plugin-id>  # install plugin desde marketplace
```

## Consequences

### Positivas

- **Zero breaking change**: users de Codi v2 no notan diferencia, `codi generate` sigue funcionando.
- **Path para marketplace público**: foundation lista cuando v3.x se publique en Anthropic marketplace oficial.
- **Aislamiento de plugins**: agencies usando plugin model evitan conflicts con artifacts del usuario.
- **Auto-update centralizado**: agencias avanzadas pueden gestionar updates via marketplace privado.
- **Consistente con Codi v2**: `.claude-plugin/` ya existe parcialmente en repo actual.

### Negativas

- **Doble mantenimiento**: dos paths que pueden divergir si no se cuidan.
- **Discovery confuso para users**: ¿cuándo usar uno vs otro? Mitigación: docs + flowchart en README.

## Alternatives considered

### A — Solo modelo overwrite (Codi v2 way)

- Pros: simplicidad.
- Contras: no path para marketplace público v3.x. Plugin model llega tarde si.

### B — Solo modelo plugin (forzar a todos)

- Pros: limpieza arquitectónica.
- Contras: breaking change para Codi v2 users. Marketplace público no existe oficialmente todavía.

## Implementation

Sprint 6 del roadmap (semanas 12-13):

1. Crear template `.claude-plugin/plugin.json` y `.codex-plugin/plugin.json` en `src/templates/plugin/`.
2. Implementar `codi plugin publish` command:
   - Validar manifest (Zod).
   - Generar `.zip` con artifacts + manifest.
   - Push a marketplace privado opt-in (URL configurable).
3. Implementar `codi plugin install <plugin-id>` command:
   - Download desde marketplace.
   - Validar manifest.
   - Extract a `${CLAUDE_PLUGIN_ROOT}` o `${CODEX_PLUGIN_ROOT}`.
4. Tests E2E plugin lifecycle: publish → install → invoke skill.
5. Docs: cuándo usar `codi generate` vs `codi plugin publish`.

## Related ADRs

- ADR-v3ed0-001: Rebrand in-place (define namespace `codi-*` para plugin id).
- ADR-v3ed0-006: Catálogo 77 artefactos (define qué se incluye en el plugin).
