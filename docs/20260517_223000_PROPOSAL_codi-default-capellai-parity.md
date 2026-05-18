# PROPOSAL — codi-default = capellai parity (placement-only scope)

- **Date**: 2026-05-17 (executed 2026-05-17 → 2026-05-18)
- **Status**: Pasos 1-8 complete; Paso 9 (init wiring of `core.hooksPath` for git hooks) deferred to follow-up PR.
- **Category**: PROPOSAL / DISTRIBUTION
- **Session origin**: Grilling session 2026-05-17 (this session). Trabajo paralelo e independiente al PROPOSAL existente `20260517_160000_PROPOSAL_codi-v4-default-base.md` y al ADR-012 (capellai-parity-import).
- **Source decision (this session)**: ADR-013 (refining ADR-012).
- **Branch strategy**: `feature/codi-default-parity` ramificada desde `feature/codi-v3-harness` (NO desde main). PR atómico de vuelta a `feature/codi-v3-harness`.
- **Pre-release**: sin migración legacy; un `.codi/preset.json` con preset removido se trata como tierra nueva.

## Paso 9 — DEFERRED: git hook installation via core.hooksPath

Discovered during Paso 8 implementation that codi already has a sophisticated
git hook install pipeline (`src/core/hooks/hook-installer.ts`) that:
* Detects the project's git hook framework (Husky / pre-commit / Lefthook /
  standalone) via `detectHookSetup()`.
* Installs many existing check types: `commitMsgValidation`, `secretScan`,
  `fileSizeCheck`, `stagedJunkCheck`, `conflictMarkerCheck`, `skillYamlValidation`,
  `versionCheck`, etc. — substantially overlapping with the capellai
  `scripts/hooks/*.sh` set this PR was intended to absorb.

The original plan for Paso 9 was to:
1. Force `git config core.hooksPath ./hooks/` as the single canonical setup.
2. Write `hooks/pre-commit` and `hooks/pre-push` stubs invoking
   `codi hook git-pre-commit` / `codi hook git-pre-push`.

Following that plan would bypass codi's existing per-framework hook system
entirely — replacing months of sophisticated install logic with a stub.
That refactor is genuinely out of scope for this PR.

**Deferred work** (separate follow-up PR):
* Reconcile the 11 hook modules in `src/runtime/hooks/{claude-code,git}/`
  with codi's existing `hook-config-generator` + `hook-installer`. Specifically:
  retire my `junk-paths-check.ts` and `file-lines-check.ts` (overlap with
  codi's `stagedJunkCheck` and `fileSizeCheck`); keep `auto-format`,
  `agent-configs-scan`, `branch-name-check`, `branch-base-check`,
  `direct-push-guard` and register them with codi's hook config generator
  so they install via whichever framework the project uses.
* `codi init` auto-invokes the registration so users do not have to wire
  hooks manually.

**Current state**: the 11 hook modules ship in this PR as runtime code,
invocable via `codi hook git-pre-commit` and `codi hook git-pre-push`.
They are not auto-installed by `codi init`. Manual install for users who
want the codi-default parity guardrails immediately:

```bash
git config core.hooksPath hooks/
mkdir -p hooks
cat > hooks/pre-commit <<'EOF'
#!/bin/sh
codi hook git-pre-commit
EOF
cat > hooks/pre-push <<'EOF'
#!/bin/sh
codi hook git-pre-push
EOF
chmod +x hooks/pre-commit hooks/pre-push
```

Note: doing this REPLACES codi's existing per-framework hook install for
that project. Users who want both systems coexisting should wait for the
follow-up PR that does proper integration.

> Este documento es el plan de ejecución de esta sesión. La decisión está fijada en ADR-013 (que refina ADR-012) y el glosario actualizado en CONTEXT.md (entradas Capellai parity + Best-of-both merge de esta sesión).
>
> **Alcance reducido del executor de este PR**: colocar los artefactos en `src/templates/` siguiendo las convenciones existentes de codi. La maquinaria de render + degradación multi-agente ya existe en codi; no se diseña infraestructura nueva en este PR. Si durante exec se descubre que codi NO renderiza algo (commands, scripts/hooks, lifecycle hooks, _index.md, settings.json extendido), se surface como gap, NO se construye aquí.

---

## 1. Inventario de paridad (verificado 2026-05-17)

### 1.1 Skills (40 en capellai)

#### Grupo A — Existen en codi/src/templates por nombre (14, merge codi×capellai requerido)

| capellai | codi template | Acción |
|---|---|---|
| `caveman` | `caveman/template.ts` | Merge: cuerpo capellai, frontmatter codi (category, version, maintainers, placeholders) |
| `diagnose` | `diagnose/template.ts` | Merge |
| `tdd` | `tdd/template.ts` | Merge (capellai tiene 5 refs subarchivos: deep-modules, interface-design, mocking, refactoring, tests) |
| `zoom-out` | `zoom-out/template.ts` | Merge |
| `codi-agent-creator` | `dev-agent-creator/template.ts` | Merge |
| `codi-artifact-contributor` | `dev-artifact-contributor/template.ts` | Merge |
| `codi-compare-preset` | `dev-compare-preset/template.ts` | Merge |
| `codi-dev-docs-manager` | `dev-docs-manager/template.ts` | Merge (nombre capellai conserva `dev-` infijo, ojo) |
| `codi-dev-operations` | `dev-operations/template.ts` | Merge |
| `codi-preset-creator` | `dev-preset-creator/template.ts` | Merge |
| `codi-refine-rules` | `dev-refine-rules/template.ts` | Merge |
| `codi-rule-creator` | `dev-rule-creator/template.ts` | Merge |
| `codi-rule-feedback` | `dev-rule-feedback/template.ts` | Merge |
| `codi-skill-creator` | `dev-skill-creator/template.ts` | Merge |

#### Grupo B — Subset Obsidian/wiki (7, merge claude-obsidian×capellai)

| capellai | claude-obsidian | Acción |
|---|---|---|
| `wiki` | `wiki` | Merge → nuevo template `src/templates/skills/wiki/template.ts` |
| `wiki-ingest` (skill) | `wiki-ingest` | Merge → `src/templates/skills/wiki-ingest/template.ts` |
| `wiki-query` | `wiki-query` | Merge → `src/templates/skills/wiki-query/template.ts` |
| `wiki-lint` (skill) | `wiki-lint` | Merge → `src/templates/skills/wiki-lint/template.ts` |
| `save` | `save` | Merge → `src/templates/skills/save/template.ts` |
| `autoresearch` | `autoresearch` | Merge → `src/templates/skills/autoresearch/template.ts` |
| `canvas` | `canvas` | Merge → `src/templates/skills/canvas/template.ts` |

#### Grupo C — Solo en capellai (19, port directo re-templatizado)

`agent-eyes-browser, defuddle, edit-article, git-guardrails-claude-code, grill-me, grill-with-docs, handoff, improve-codebase-architecture, migrate-to-shoehorn, obsidian-bases, obsidian-markdown, prototype, scaffold-exercises, setup-matt-pocock-skills, setup-pre-commit, to-issues, to-prd, triage, wiki-fold`

Cada una → `src/templates/skills/<name>/template.ts` nuevo, con frontmatter en estilo codi (placeholders + category + compatibility + managed_by + version + maintainers).

#### Grupo D — En codi pero NO en capellai (excluir del preset default)

Permanecen en `src/templates/skills/` (siguen siendo "templates disponibles") pero NO se listan en `codi-default.skills[]`. Lista exacta de exclusión: `architecture-review, audio-transcriber, audit-fix, brainstorming, branch-finish, bug-fix-workflow, claude-api, claude-artifacts-builder, codebase-explore, codebase-onboarding, code-review, codi-brand, commit, content-factory, debugging, dev-brain-ui, dev-brand-creator, dev-e2e-testing, dev-gate-deep-modules, dev-gate-plan-coverage, dev-graph-sync, dev-init-knowledge-base, dev-session-recovery, dev-sheets-sync, dev-step-documenter, dev-team-charter, dev-team-consolidation-workflow, dev-using-codi, discover, feature-workflow, frontend-design, guided-execution, guided-qa-testing, html-live-inspect, humanizer, mcp-ops, migration-workflow, mobile-development, plan-execution, plan-writing, project-documentation, project-quality-guard, project-workflow, pr-review, quality-gates, receiving-code-review, refactoring, refactor-workflow, roadmap, security-scan, session-log, subagent-orchestration, test-suite, verify-evidence, webapp-testing, worktrees`

> Nota: muchas de esas (e.g. `plan-writing`, `commit`, `code-review`) son razonablemente útiles. Si en una revisión posterior se decide incluirlas, basta con añadir el nombre al array `skills: [...]` del preset. La decisión actual es **paridad estricta con capellai**.

---

### 1.2 Rules (25 en capellai — `v1-sprint-gates` queda fuera)

#### Grupo A — Existen por nombre (22, merge codi×capellai)

Mapeo `codi-X` (capellai) ↔ `X` (codi templates):
- `codi-agent-usage` ↔ `agent-usage.ts`
- `codi-api-design` ↔ `api-design.ts`
- `codi-architecture` ↔ `architecture.ts`
- `codi-capture-everything` ↔ `capture-everything.ts`
- `codi-code-style` ↔ `code-style.ts`
- `codi-contribution-discipline` ↔ `contribution-discipline.ts`
- `codi-documentation` ↔ `documentation.ts`
- `codi-error-handling` ↔ `error-handling.ts`
- `codi-git-workflow` ↔ `git-workflow.ts`
- `codi-improvement-dev` ↔ `improvement.ts` (verificar diff: nombre infijo distinto)
- `codi-nextjs` ↔ `nextjs.ts`
- `codi-output-discipline` ↔ `output-discipline.ts`
- `codi-performance` ↔ `performance.ts`
- `codi-production-mindset` ↔ `production-mindset.ts`
- `codi-python` ↔ `python.ts`
- `codi-react` ↔ `react.ts`
- `codi-security` ↔ `security.ts`
- `codi-simplicity-first` ↔ `simplicity-first.ts`
- `codi-spanish-orthography` ↔ `spanish-orthography.ts`
- `codi-testing` ↔ `testing.ts`
- `codi-typescript` ↔ `typescript.ts`
- `codi-workflow` ↔ `workflow.ts`

#### Grupo B — Faltan en codi (3, port directo)

| capellai | Acción |
|---|---|
| `agent-capability-discovery` | Nuevo `src/templates/rules/agent-capability-discovery.ts` |
| `dev-vault-discipline` | Nuevo `src/templates/rules/vault-discipline.ts` (nombre des-`dev`-ificado en codi) |
| `output-tone-policy` | Nuevo `src/templates/rules/output-tone-policy.ts` |

> **Fuera**: `v1-sprint-gates` queda excluido (project-specific de un sprint v1 ajeno, decisión de esta sesión).

#### Grupo C — En codi pero NO en capellai (excluir del preset default)

`csharp, django, golang, java, kotlin, rust, spring-boot, swift` — quedan en templates pero fuera de `codi-default.rules[]`.

---

### 1.3 Agents (2 en capellai, ambos faltan en codi)

| capellai | Acción |
|---|---|
| `wiki-ingest.md` | Merge claude-obsidian×capellai → `src/templates/agents/wiki-ingest.ts` |
| `wiki-lint.md` | Merge claude-obsidian×capellai → `src/templates/agents/wiki-lint.ts` |

**Excluir del preset default**: los 21 agents actualmente en codi (`ai-engineering-expert, api-designer, codebase-explorer, code-reviewer, data-analytics-bi-expert, data-engineering-expert, data-intensive-architect, data-science-specialist, docs-lookup, legal-compliance-eu, marketing-seo-specialist, mlops-engineer, nextjs-researcher, openai-agents-specialist, payload-cms-auditor, performance-auditor, python-expert, refactorer, scalability-expert, security-analyzer, test-generator`) permanecen en templates, fuera de `codi-default.agents[]`.

---

### 1.4 Commands (5 en capellai)

| capellai | Fuente merge | Acción |
|---|---|---|
| `autoresearch.md` | claude-obsidian × capellai | Colocar contenido como template |
| `canvas.md` | claude-obsidian × capellai | Colocar contenido como template |
| `save.md` | claude-obsidian × capellai | Colocar contenido como template |
| `wiki.md` | claude-obsidian × capellai | Colocar contenido como template |
| `wiki-query.md` | solo capellai | Colocar contenido como template |

**Placement**: colocar los 5 archivos siguiendo la convención existente de codi para commands. Si codi NO tiene aún un patrón claro para commands (durante exec verifico `src/templates/`), se surface como discovery item y se le pasa la decisión al operador.

---

### 1.5 Lifecycle hooks `.claude/hooks/` (2 en capellai)

| capellai | Fuente | Acción |
|---|---|---|
| `inject-capability-prompt.sh` | solo capellai | Colocar como template |
| `append-memory-to-claudemd.py` | solo capellai | Colocar como template |
| claude-obsidian `hooks/hooks.json` (SessionStart + Stop) | claude-obsidian | Considerar durante merge si añade valor al contenido |

**Placement**: colocar los 2 archivos siguiendo la convención existente de codi para lifecycle hooks. Si la convención no existe, surface como discovery item.

---

### 1.6 `scripts/hooks/*.sh` (9 en capellai, fuera de `.claude/`)

Files a colocar como templates:

- `auto-format.sh`
- `block-junk-paths.sh`
- `check-branch-base.sh`
- `check-branch-name.sh`
- `check_file_lines.py`
- `guard-bash.sh`
- `guard-write.sh`
- `no-direct-push.sh`
- `scan-agent-configs.sh`

**Placement**: colocar siguiendo la convención existente de codi para scripts auxiliares fuera de `.claude/`. Si la convención no existe, surface como discovery item — codi ya define qué hace cuando un preset declara archivos fuera de `.claude/`/`.codi/`, esa es responsabilidad del pipeline, no de este PR.

---

### 1.7 `.claude/settings.json`

Codi ya emite via `src/adapters/claude-settings.ts`. El contenido extra que el preset `codi-default` debe aportar (deny/allow extenso + entradas Pre/PostToolUse que invocan `scripts/hooks/*.sh`):

**Permisos a añadir al `deny[]` por defecto:**
```
Bash(git push origin main*)
Bash(git push * main)
Bash(git push origin HEAD:main*)
Bash(git push origin develop*)
Bash(git push * develop)
Bash(git push origin HEAD:develop*)
Bash(git push --no-verify*)
Bash(git push --force *)
Bash(git push -f *)
Bash(git commit --no-verify*)
Bash(git commit -n *)
Bash(git config --global *)
Bash(pip install *)
Edit(.env)
Edit(.env.local)
Edit(.env.production)
Edit(.env.staging)
Edit(.env.development)
Edit(.env.test)
Write(.env)
Write(.env.local)
Write(.env.production)
Write(.env.staging)
Write(.env.development)
Write(.env.test)
```

**Permisos a añadir al `allow[]` por defecto:**
```
Bash(git push --force-with-lease origin feature/*)
Bash(git push --force-with-lease origin bugfix/*)
Bash(git push --force-with-lease origin chore/*)
Bash(git push --force-with-lease origin release/*)
Bash(git push --force-with-lease origin hotfix/*)
Bash(git checkout -b feature/*)
Bash(git checkout -b bugfix/*)
Bash(git checkout -b chore/*)
Bash(git checkout -b release/*)
Bash(git checkout -b hotfix/*)
Bash(git switch -c feature/*)
Bash(git switch -c bugfix/*)
Bash(git switch -c chore/*)
Bash(git switch -c release/*)
Bash(git switch -c hotfix/*)
```

**Hooks PreToolUse/PostToolUse a inyectar:**
```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR:-.}/scripts/hooks/guard-bash.sh\"", "timeout": 5 }] },
      { "matcher": "Edit|Write|NotebookEdit", "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR:-.}/scripts/hooks/guard-write.sh\"", "timeout": 5 }] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR:-.}/scripts/hooks/auto-format.sh\"", "timeout": 10 }] }
    ]
  }
}
```

**`settings.local.json`**: NO se emite — es per-user, no parte del default.

**Placement**: el contenido va al preset `codi-default` o como override al adapter, según la convención existente de codi. Si codi NO tiene aún un mecanismo para que un preset extienda el settings.json base, se surface como discovery item.

---

### 1.8 `.claude/skills/_index.md` (capellai lo tiene)

Capellai tiene un archivo de mapa de capacidades legible por humanos. **Placement-only**: si codi tiene un generator o template para este archivo, se colocan los contenidos siguiendo esa convención. Si no, se surface como discovery item.

Plantilla de referencia (estilo capellai, NO de implementación):
```markdown
# Capability Index — {projectName}

Human-readable map of every skill, agent, and slash command installed in this repo's `.claude/`.

Total: **{nSkills} skills · {nAgents} agents · {nCommands} slash commands**.

## Intent → skill cheatsheet
... (cheatsheet de intents → primary skill)

## Skills · Agents · Slash commands
- listas con `{name}` y `{first-line-of-description}`
```

---

### 1.9 `CLAUDE.md` raíz (capellai lo tiene)

Capellai tiene un `CLAUDE.md` de 123 líneas en raíz. **Placement-only**: si codi ya tiene un mecanismo para emitir/aumentar `CLAUDE.md` durante init, se aportan los contenidos al template correspondiente. Si no, se surface como discovery item.

---

## 2. Cambios de código (orden de ejecución dentro del PR atómico)

### Paso 1 — Setup ramificación y workspace
1. `git checkout feature/codi-v3-harness && git pull`
2. `git checkout -b feature/codi-default-parity`
3. `git clone https://github.com/AgriciDaniel/claude-obsidian /tmp/claude-obsidian` (tmp, no rastreado por git)
4. Verificar `npm install` limpio en codi (ya está, pero confirmar).

### Paso 2 — Eliminar presets removidos
1. Borrar archivos: `src/templates/presets/minimal.ts`, `balanced.ts`, `strict.ts`, `fullstack.ts`, `development.ts`, `power-user.ts`
2. Editar `src/templates/presets/index.ts`: quitar imports y entradas del registro, mantener solo `default` (a crear)
3. Editar `src/constants.ts`: cambiar `DEFAULT_PRESET = prefixedName("balanced")` → `DEFAULT_PRESET = prefixedName("default")`
4. Borrar tests: `tests/unit/presets/balanced.test.ts`, `minimal.test.ts`, `strict.test.ts`, `fullstack.test.ts`, `development.test.ts`, `power-user.test.ts` (verificar nombres exactos)
5. Auditar referencias literales a `"balanced"`/`"minimal"`/etc. en `src/`, eliminarlas o redirigir a `"default"`

### Paso 3 — Crear preset `codi-default` (todavía vacío)
1. Nuevo: `src/templates/presets/default.ts` con la estructura de `BuiltinPresetDefinition`, `name: prefixedName("default")`, `rules: []`, `skills: []`, `agents: []`, `mcpServers: []` (y los campos adicionales que codi ya soporte — commands, scripts, lifecycleHooks — solo si existen en el tipo)
2. Registrar en `src/templates/presets/index.ts`
3. Confirmar que `tsc --noEmit` pasa y los tests no-preset siguen verdes

### Paso 4 — Discovery: capacidades existentes de codi
Antes de portar contenido, verificar qué de lo siguiente YA tiene maquinaria en codi:
1. `src/templates/commands/` directorio + render pipeline
2. `src/templates/scripts/hooks/` (o equivalente) + emit a `<projectRoot>/scripts/hooks/`
3. Lifecycle hooks `.claude/hooks/` + inyección en `settings.json::hooks.*`
4. `_index.md` generator
5. `CLAUDE.md` emitter
6. settings.json deny/allow override por preset

Para cada uno que NO exista: **registrar el gap en `docs/`** como discovery item y consultar con el operador antes de construir (fuera del scope de este PR según ADR-013).

### Paso 5 — Port de rules (22 merges + 3 nuevas)
- Para cada rule del Grupo A (sección 1.2): comparar `src/templates/rules/<bare>.ts` body con `capellai/.claude/rules/codi-<bare>.md`, sintetizar versión pro
- Para cada rule del Grupo B (3 rules ahora — sin `v1-sprint-gates`): crear `src/templates/rules/<name>.ts` nuevo desde capellai
- Añadir nombres al array `codi-default.rules[]`
- Excluir Grupo C (csharp/django/golang/java/kotlin/rust/spring-boot/swift) del array

### Paso 6 — Port de agents (2 nuevos, merge claude-obsidian×capellai)
- `wiki-ingest.ts` y `wiki-lint.ts` en `src/templates/agents/`
- Añadir al array `codi-default.agents[]`
- El index `src/templates/agents/index.ts` se actualiza

### Paso 7 — Port de skills (14 merge + 7 Obsidian merge + 19 port directo)
Sub-fases internas (todas en el mismo PR, commits separados por sub-fase):
- **7a**: 14 merges codi×capellai (skills ya existentes en codi)
- **7b**: 7 merges claude-obsidian×capellai (subset Obsidian)
- **7c**: 19 ports directos capellai-only

Cada skill añadida → entrada en `codi-default.skills[]` y export en `src/templates/skills/index.ts`.

### Paso 8 — Placement de commands, lifecycle hooks, scripts/hooks (depende de Paso 4)
Para cada categoría con infraestructura confirmada:
- **Commands** (5): colocar contenido fusionado (capellai × claude-obsidian) en la convención existente; registrar en el preset
- **Lifecycle hooks** (2): colocar `inject-capability-prompt.sh` y `append-memory-to-claudemd.py`; registrar en el preset
- **scripts/hooks** (9): colocar los 9 scripts; registrar en el preset

Para cada categoría SIN infraestructura: **NO se ejecuta aquí**. El contenido queda preparado en una carpeta `docs/parity-content/<kind>/` para que el operador decida si abre un PR de infra separado o si reduce el alcance.

### Paso 9 — Contenido para settings.json, _index.md, CLAUDE.md
- **settings.json**: si codi expone una API para que el preset extienda permissions + hooks Pre/PostToolUse, alimentar el contenido (deny/allow listado en sección 1.7). Si no, gap registrado en Paso 4.
- **_index.md**: si codi tiene generator, alimentar plantilla. Si no, gap.
- **CLAUDE.md**: si codi emite/extiende, alimentar template. Si no, gap.

### Paso 10 — Tests de paridad (gate de regresión)
- Test E2E: `codi init --preset codi-default` en directorio temporal vacío → diff resultante vs snapshot de `capellai/.claude/`. Diff debe ser cero **para los artefactos cuyas categorías SÍ tienen infraestructura** (módulo placeholders renderizados).
- Tests unitarios para los nuevos templates en sus convenciones existentes
- Para gaps de Paso 4: los tests NO se construyen aquí, salen en PR aparte

### Paso 11 — Docs upkeep
- README.md raíz: actualizar sección "Built-in presets" → "Single canonical preset: codi-default"
- CONTRIBUTING.md: ajustar referencias a presets multi (si las hay)
- CHANGELOG.md: entrada visible con breaking change y razón
- ADR-013 status `Proposed` → `Accepted` al merge
- Actualizar PROPOSAL con resultado del Discovery (Paso 4): qué gaps existen, decisión por categoría

### Paso 12 — Validación final
- `npm run lint && npm run type-check && npm test`
- `codi init` en directorio scratch limpio, verificar artefactos
- Cross-check con capellai/.claude (diff manual de algunos artefactos representativos)

### Paso 13 — PR
- Crear PR base `feature/codi-v3-harness`, head `feature/codi-default-parity`
- Body: link a ADR-013 + este PROPOSAL + tabla de paridad antes/después + listado de gaps de infraestructura descubiertos + breaking changes
- Solicitar review

---

## 3. Criterios de done

- [ ] `codi init` sin flags en proyecto limpio produce `.claude/` cuyo `diff -r` contra una versión normalizada de `capellai-ai-crm/.claude/` es vacío **para las categorías con infraestructura confirmada** (módulo placeholders renderizados).
- [ ] `getBuiltinPresetNames()` retorna `["codi-default"]` y nada más.
- [ ] Tests E2E de paridad verdes para artefactos colocados.
- [ ] `tsc --noEmit` limpio; `eslint` limpio.
- [ ] CHANGELOG + README + ADR-013 actualizados a `Accepted`.
- [ ] PR pasa CI completo (`.github/workflows/`).
- [ ] No queda referencia literal a `"balanced" | "minimal" | "strict" | "fullstack" | "development" | "power-user"` en `src/` salvo en CHANGELOG.
- [ ] Gaps de infraestructura descubiertos en Paso 4 documentados explícitamente para PRs de seguimiento.
- [ ] `v1-sprint-gates` NO aparece en `src/templates/rules/` ni en `codi-default.rules[]`.

---

## 4. Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Tests existentes para los 5 presets eliminados rompen masivamente | Borrar los tests específicos en paralelo al borrado de presets; los tests genéricos siguen pasando. |
| Trabajo de merge en 21 skills + 22 rules subjetivo, propenso a discrepancias de gusto | Documentar criterios de merge en el PR; pedir review de muestra (5 skills) antes de hacer las 21. |
| `scripts/hooks/*.sh` rompe asunciones de "codi solo escribe en `.codi/` y `.claude/`" | Disclosure explícita en wizard + entrada en docs. Considerar flag `--no-scripts` para opt-out futuro (fuera de scope de este PR). |
| Codex no soporta hooks exactamente como Claude Code | Investigar al llegar al paso 13; degradar silenciosamente si la diferencia es estructural. |
| claude-obsidian repo evoluciona después del merge | Aceptado por diseño (ADR-013): no es runtime dep. Si futuras versiones traen mejoras, se re-evalúa en PR separado. |

---

## 5. Out of scope (explícito)

- Plugin distribution / live dep on claude-obsidian
- Multi-context CONTEXT-MAP (sigue siendo single-context)
- Migración de instalaciones legacy (pre-release, no aplica)
- Equivalentes de hooks en Cursor/Windsurf/Cline/Copilot
- Restablecimiento de los 5 presets eliminados como opt-in (futuro PR si se justifica)
- Cualquier cambio al sistema de presets más allá de la registración del catálogo

---

**Siguiente acción**: confirmar este plan con el operador y, al OK, ejecutar Paso 1.
