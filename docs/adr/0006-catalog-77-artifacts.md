# ADR-v3ed0-006: Catálogo 77 artefactos (49 skills + 21 rules + 4 agents + 3 presets)

- **Date**: 2026-05-08 14:09
- **Document**: 20260508*140928*[ARCHITECTURE]\_adr-v3ed0-006-catalog-77-artifacts.md
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Source decision**: Z7 (grilling final ed.0)

## Context

Codi v2 actual tiene 125 artefactos: 66 skills + 29 rules + 22 agents + 8 presets. Plan v3-full original proponía 77 artefactos. Plan v3-zero minimalista proponía 38 skills.

La directiva del usuario fue: "asegurate de que tenemos todas las metaskills includas que son todas aquellas skills pensadas para trabajar con codi: skills para crear artefactos, etc". Esto requiere preservar capacidad de extension del sistema.

## Decision

Catálogo final ed.0: **77 artefactos** organizados como sigue.

### Skills (49) — 13 bloques

| Bloque                           | Count | Skills                                                                                                                                                                                    |
| -------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Foundation                   | 4     | codi-dev-team-charter, codi-caveman, codi-recall, codi-remember                                                                                                                           |
| B — Workflows phase-locked       | 5     | codi-{project,feature,bug-fix,refactor,migration}-workflow                                                                                                                                |
| C — SDD inner-loop core          | 8     | codi-clarify, codi-spec-writer, codi-plan-writer, codi-plan-execution, codi-tdd, codi-debugging, codi-verify, codi-code-review                                                            |
| D — SDD ortogonales              | 4     | codi-brainstorming, codi-prototype, codi-architecture-review, codi-evidence-gathering                                                                                                     |
| E — Codebase exploration         | 1     | codi-codebase-explore (merged onboarding)                                                                                                                                                 |
| F — Workflow utility             | 4     | codi-worktrees, codi-dispatching-parallel-agents, codi-dev-session-recovery, codi-session-log                                                                                             |
| G — Git lifecycle                | 3     | codi-commit, codi-branch-finish, codi-audit-fix                                                                                                                                           |
| H — Quality                      | 2     | codi-refactoring, codi-security-scan                                                                                                                                                      |
| I — Lifecycle                    | 1     | codi-install (modes zero/lite/standard/full)                                                                                                                                              |
| J — v3 brain features            | 3     | codi-dev-brain-ui, codi-brain-consolidate, codi-brain-export/import                                                                                                                       |
| K — Self-improvement             | 3     | codi-dev-rule-feedback, codi-dev-refine-rules, codi-dev-compare-preset                                                                                                                    |
| L — Metaskills artifact creators | 8     | codi-dev-skill-creator, codi-dev-rule-creator, codi-dev-agent-creator, codi-dev-preset-creator, codi-workflow-creator, codi-gate-creator, codi-skill-audit, codi-dev-artifact-contributor |
| M — Codi self-development        | 3     | codi-dev-operations, codi-dev-docs-manager, codi-dev-e2e-testing                                                                                                                          |

### Rules (15 core + 6 opt-in = 21)

**Core always-loaded (15)**:

1. codi-iron-laws (DevLoop + plan v3)
2. codi-output-discipline (Codi v2)
3. codi-workflow (Codi v2)
4. codi-recommend-pattern (Codi v2)
5. codi-security (Codi v2)
6. codi-error-handling (Codi v2)
7. codi-testing (Codi v2)
8. codi-git-workflow (Codi v2)
9. codi-documentation (Codi v2)
10. codi-improvement-dev (Codi v2)
11. codi-architecture (Codi v2)
12. codi-simplicity-first (Codi v2)
13. codi-production-mindset (Codi v2)
14. codi-code-style (Codi v2)
15. codi-capture-everything (NEW v3)

**Opt-in (6)** — preset codi-extended: 16. codi-domain-driven 17. codi-hexagonal-architecture 18. codi-spanish-orthography 19. codi-api-design 20. codi-performance 21. codi-agent-usage

### Agents — subagent definitions (4)

1. lead — orchestrator general
2. worker — executor task-by-task
3. reviewer — read-only code/spec review
4. scaffolder — new file generation

(`advisor`, `docs-lookup`, `architect`, `compliance-reviewer` y 14 expert subagents → defer marketplace v3.1)

### Presets (3)

1. **codi-default** — 49 skills + 15 rules core + 4 agents (baseline ed.0)
2. **codi-extended** — codi-default + 6 rules opt-in
3. **codi-minimal** — 17 skills (Foundation 4 + Workflows 5 + SDD core 8) + 8 rules + 4 agents

## Skills DESCARTADAS de Codi v2 (28 skills → defer marketplace v3.1)

- **Mergeadas** (no descartadas, fusionadas): codi-test-suite (→ codi-verify), codi-pr-review + codi-receiving-code-review (→ codi-code-review bidireccional), codi-codebase-onboarding (→ codi-codebase-explore).
- **Defer a marketplace v3.1** (contenido especializado): codi-canvas-design, codi-theme-factory, codi-html-live-inspect, codi-slack-gif-creator, codi-algorithmic-art, codi-pdf, codi-pptx, codi-xlsx, codi-docx, codi-content-factory, codi-audio-transcriber, codi-notebooklm, codi-mobile-development, codi-internal-comms, codi-codi-brand, codi-dev-brand-creator, codi-claude-api, codi-claude-artifacts-builder, codi-mcp-ops, codi-box-validator, codi-dev-step-documenter, codi-frontend-design, codi-humanizer, codi-roadmap, codi-dev-graph-sync, codi-project-documentation, codi-project-quality-guard, codi-webapp-testing, codi-guided-execution, codi-guided-qa-testing.

Razón: contenido especializado (PDF/PPTX/XLSX/audio/canvas/etc) o redundancia funcional. Re-añadir como skills opcionales en marketplace v3.1 si demanda real lo justifica.

## Skills DevLoop NO incluidas (3 → defer)

- codi-discover (parcialmente cubierta por workflow phases).
- codi-dev-init-knowledge-base (parcialmente cubierta por install + brain).
- codi-skill-audit ya incluida en bloque L.

## Consequences

### Positivas

- **Catálogo manejable**: 77 artefactos vs 125 actuales (-48). Equipo de 4 devs puede mantener sin fatigue.
- **Metaskills preservadas**: 8 skills creator (bloque L) + 3 self-dev (bloque M) garantizan que el equipo puede crear/auditar/mantener artefactos de Codi mismo (self-host dogfooding).
- **Backward compat**: skills mergeadas (`codi-test-suite` → `codi-verify`) tienen migration script automático que renombra invocaciones.
- **Defer claro**: 28 skills descartadas no se eliminan; quedan disponibles en marketplace v3.1 si demanda.

### Negativas

- **Breaking changes para users de skills descartadas**: agencias que usan codi-pdf/codi-pptx/etc deben esperar marketplace v3.1 o mantener fork local.
- **Subagents reducidos a 4**: pierden 18 specialized agents de Codi v2. Mitigación: dev puede crear custom subagent definitions con `codi-dev-agent-creator` (skill bloque L).

## Alternatives considered

### A — Mantener todos 125 artefactos de Codi v2

- Pros: zero breaking change.
- Contras: catálogo gigante, costo de mantenimiento alto, dilución de focus. Skill budget (~2% context window) trunca skills always-active.

### B — Catálogo minimalista 38 skills (v3-zero original)

- Pros: foco máximo.
- Contras: pierde metaskills creators, sin path para extender el sistema, contradice directiva del usuario.

## Implementation

Sprint 1 del roadmap (semanas 1-3):

1. Filtrar `src/templates/skills/` Codi v2 actual: mantener 49 skills aprobadas, mover 28 descartadas a `src/templates/skills/_deferred/`.
2. Mergear skills duplicadas (test-suite → verify, pr-review + receiving → code-review, onboarding → explore).
3. Copy 5 workflows DevLoop + 23 skills DevLoop a `src/templates/skills-devloop/`. Resolver duplicados con Codi v2 skill-by-skill.
4. Crear 3 NEW skills v3 (codi-clarify, codi-spec-writer, codi-prototype) + 3 brain features (codi-dev-brain-ui, codi-brain-consolidate, codi-brain-export-import) + 1 capture rule (codi-capture-everything) + 2 workflow creators (codi-workflow-creator, codi-gate-creator).
5. Validate `codi list` cuenta exactly 49 + 21 + 4 + 3 = 77.

## Related ADRs

- ADR-v3ed0-002: DevLoop copy+adapt (define source de skills DevLoop).
- ADR-v3ed0-004: Workflows como artefactos (5 workflows entran al catálogo).
- ADR-v3ed0-007: 4 features arquitectónicas (codi-clarify, codi-spec-writer, codi-prototype, brain features).
