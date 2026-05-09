# Audit: Codi v3 — el paradigma "workflows son el centro" frente a la realidad del código

- **Date**: 2026-05-09 01:46
- **Document**: 20260509*014606*[AUDIT]\_codi-v3-workflows-paradigm.md
- **Category**: AUDIT
- **Branch**: `feature/codi-v3-harness` @ `e6d6b822`
- **Scope**: arquitectura, modelo, DX, escalabilidad, calidad, riesgos, recomendaciones — con foco en si la doctrina de "workflows como elemento central" está realmente implementada
- **Severidad del informe**: crítica. El usuario pidió explícitamente "no busco validación superficial". No la doy.

---

## Veredicto ejecutivo

**Los workflows NO son el centro de Codi v3 en el código de hoy.** Son un sistema paralelo, parcialmente cableado, con una capa de runtime razonablemente diseñada (event log + reducer + handlers) pero desconectada del resto del sistema en cinco fronteras críticas:

| Frontera               | Estado                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo de artefactos | `ArtifactType = "rule" \| "skill" \| "agent" \| "brand"` — **workflow no existe**                                                     |
| Manifest del plugin    | `PluginArtifact.type` lista 6 valores — **workflow no aparece**                                                                       |
| CLI `codi`             | 25 comandos registrados — **cero tocan workflows** (workflow ops viven en binario `devloop` separado)                                 |
| Wizard / presets       | 5 presets builtin — **ninguno instala los 5 workflow skills**                                                                         |
| Doc de arquitectura    | "Four moving parts: Agent → Brain → Pipeline → Catalog" — **workflows no aparecen en el diagrama**; se mencionan como 2/12 tablas SQL |

La doctrina existe en plan maestro y ADRs. La implementación trata workflows como **skills con un naming convention**. Eso es defendible si la elección consciente es "workflow = subgénero de skill"; pero entonces la frase "workflows son el centro" es marketing interno, no arquitectura. Hay que decidir cuál de los dos relatos es el real y alinear todo.

**Subverdicto adicional**: hay tres sistemas documentados que **no existen en código**:

1. **`contract.json` por workflow** — `scripts/runtime/gate.ts:65-79` los lee; cero archivos shippean. Todo `devloop gate run` falla.
2. **Hook Stop + pipeline `[CODI-OBSERVATION: ...]`** — tres rules + cuatro skills lo prometen; no hay entrada en `hooks.json` ni script `hook-stop.ts`.
3. **Iron Laws 4-8 enforcer** — el módulo `iron-laws-enforcer.ts` existe; **cero callers**. El gate `ok`/`OK`/`Ok` es prosa de charter, no un check.

Estos tres son **deuda técnica con apariencia de feature**. Debes decidir antes de seguir construyendo encima si los implementas o los retractas.

---

## 1. Arquitectura general

### 1.1 ¿Está el paradigma "centrado en workflows" correctamente diseñado?

**No, está parcialmente diseñado y peor implementado.**

El plan maestro §7 (`docs/20260508_133556_[PLAN]_codi-v3-ed0-master.md`) y ADR-004 (`docs/20260508_140926_[ARCHITECTURE]_adr-v3ed0-004-workflows-as-artifacts.md`) dicen explícitamente:

> Z5 = A — SKILL.md con `mode: workflow` + phases + transitions + skills_by_phase + invariants + flags

En código, ninguno de los 5 workflows tiene esos campos en su frontmatter. Cada uno es prosa Markdown libre dentro de un template literal de TS. La diferencia entre `feature-workflow` y `tdd` desde el punto de vista del catálogo, scaffolder, plugin manifest y validador es **cero**.

Evidencia:

- `src/templates/skills/feature-workflow/template.ts:1-30` — frontmatter contiene `name / description / category / compatibility / managed_by / user-invocable / version`. **Ningún `phases:`, `transitions:`, `skills_by_phase:`, `gates:`, `flags:`**.
- Igual en los otros 4 (`bug-fix-workflow`, `refactor-workflow`, `migration-workflow`, `project-workflow`).

### 1.2 Separación de responsabilidades

**Hay dos universos paralelos que apenas se hablan:**

| Universo "artefactos"                                            | Universo "runtime workflow"                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/templates/`, `src/cli/`, `src/core/scaffolder/`             | `src/runtime/cli-handlers/`, `event-log.ts`, `reducer.ts`, `gate-runner.ts` |
| Conoce: rules, skills, agents, presets, MCP servers              | Conoce: workflow_id, phases, scope expansions, transitions, gates           |
| **No conoce**: workflow como tipo, phase contract, gate registry | **No conoce**: el catálogo, los presets, la matrix de capabilities          |
| Habla con: `.codi/codi.yaml`, `dist/templates/`, `package.json`  | Habla con: `.workflow/active/`, `~/.codi/brain.db`, `workflow_runs` SQL     |

La única conexión es vía nombres de skill (`feature-workflow` skill ↔ `WORKFLOW_TYPES.feature` enum). Esa conexión es **stringly-typed y duplicada**: el classifier (`src/runtime/classifier.ts`), el ID builder (`src/runtime/workflow-id.ts:48`), el reducer, el sync schema, todos llevan su propia copia de la lista de tipos.

### 1.3 Coherencia, mantenibilidad, escalabilidad

- **Coherente**: no del todo. Dos binarios (`codi`, `devloop`), dos backends de event log con 5 sitios todavía pinneados a legacy, dos lugares donde vive "workflow type" como fuente de verdad, dos modelos de gate (deterministic checkers + agent-fork skills).
- **Mantenible**: medio. La capa runtime (`reducer.ts`, `event-log.ts`, `brain-event-log.ts`) tiene tests sólidos y tipos exhaustivos. El catálogo es coherente para skills/rules/agents pero ciego a workflows.
- **Escalable**: NO bajo el paradigma declarado. Añadir un sexto workflow type hoy requiere editar 6+ archivos `.ts` + el JSON Schema y recompilar el paquete. Eso contradice la promesa "workflows creables por el usuario via skill-creator".

### 1.4 Acoplamientos al modelo anterior (rules/skills/presets)

Sí, hay acoplamientos claros:

- `src/cli/artifact-categories.ts:33-39` — la categoría `Workflow & Process` mete `codi-workflow` (rule), `codi-git-workflow` (rule), `codi-documentation` (rule), `codi-spanish-orthography` (rule), `codi-output-discipline` (rule). Los 5 workflow-skills NO están en ninguna categoría dedicada.
- `src/cli/add-wizard.ts:29` — el hint que describe `skill` dice literalmente "Define a reusable workflow". Conflación UX-nivel entre las dos cosas.
- `src/templates/presets/{balanced,strict,fullstack,power-user,development}.ts` — ninguno declara los 5 workflow-skills. El preset por defecto (`balanced`) deja al usuario sin runtime de workflows.

---

## 2. Modelo de workflows

### 2.1 Cómo están definidos internamente

**Como skills con sufijo `-workflow` y un `category: DEVELOPER_WORKFLOW` que comparten con otros 30+ skills no-workflow.**

No hay en ningún archivo:

- Una clase / interface `Workflow` o `WorkflowDefinition`.
- Un Zod schema para validar la frontmatter de un workflow.
- Una tabla / archivo / registry que mapee `workflow_type → { phases, gates_per_phase, default_skills }`.
- Un campo `mode: workflow` distinguiendo workflow-skills de otros skills (a pesar de que ADR-004 §Z5 lo elige explícitamente).

El concepto "phase" sí existe runtime-side:

- `src/runtime/types.ts:87-99` — `PHASES = ["intent", "reproduce", "baseline", "plan", "discover", "decompose", "execute", "verify", "data-validation", "sync", "done"]` (11 elementos, **superset global de todos los workflows**).
- `src/schemas/runtime/manifest-event.schema.json` lo refleja.
- `src/runtime/cli-handlers/transitions.ts:78-141` acepta cualquier `to_phase` sin validar que sea un sucesor legal del actual ni que pertenezca al workflow_type.

Resultado: **un `bug-fix` workflow puede transicionar a `data-validation`**, que es una fase de `migration`. El runtime no sabe distinguir.

### 2.2 ¿Permite crear workflows complejos de forma simple y extensible?

**No.** Para añadir un sexto workflow `release-workflow` hoy:

1. Crear `src/templates/skills/release-workflow/{index.ts, template.ts, references/, evals/}` copiando `feature-workflow/`.
2. Añadir export en `src/templates/skills/index.ts`.
3. Registrar entry en `src/core/scaffolder/skill-template-loader.ts` `TEMPLATE_MAP`.
4. Editar `src/runtime/types.ts:103` `WORKFLOW_TYPES` (literal union TS).
5. Editar `src/runtime/workflow-id.ts:48` `TYPE_PREFIX`.
6. Actualizar `manifest-event.schema.json` enum `workflowType`.
7. Si el workflow introduce una fase nueva (e.g. `release: cut-rc`), editar `PHASES` en types.ts + schema.
8. Reconstruir y reinstalar el paquete de Codi (no un cambio user-side).

**Seis a ocho archivos en tres capas, recompilación obligatoria.** Y todo el comportamiento del workflow (qué hace cada fase, qué skills se invocan, qué gates aplican) sigue viviendo en prosa Markdown que nada parsea.

### 2.3 Composición de skills dentro de workflows

**Solo narrativa.**

Ejemplo: `src/templates/skills/feature-workflow/references/phase-execute.md` dice cosas como "MUST invoke `tdd`". El sistema **nunca lee ese fichero**. La invocación efectiva depende de que el agente respete la prosa. Si el agente decide saltarse `tdd`, no hay gate, no hay validación, no hay aviso.

No existe en frontmatter ni en config algo como:

```yaml
phases:
  - id: execute
    skills: [tdd, subagent-orchestration]
    gates: [plan-coverage, test-first]
    transitions:
      next: verify
      requires_gate: plan-coverage
```

…que es exactamente lo que ADR-004 §Z5 prometió.

### 2.4 Ergonomía de creación

Mala. Detalle en §3 más abajo.

---

## 3. Developer Experience

### 3.1 ¿Qué tan fácil es crear un nuevo workflow desde cero?

**Imposible para un usuario, complejo incluso para un mantenedor del paquete.**

- **Para un usuario** (no-mantenedor): hoy no hay path. El `add-wizard` ofrece `Rule | Skill | Agent | Brand`. No hay opción `Workflow`. Si copia un workflow-skill ajeno y lo edita, su workflow_type no estará en `WORKFLOW_TYPES` runtime y `runWorkflow` lo rechazará.
- **Para un mantenedor**: ver §2.2 — 6-8 archivos.
- **Para nadie hay**: un comando `codi workflow create release`, un skill `workflow-creator` análogo a `skill-creator`, un scaffolder en `src/core/scaffolder/workflow-scaffolder.ts`.

### 3.2 Fricciones actuales

| Fricción                                                                                       | Impacto                                    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `codi` binario no expone comandos workflow — operaciones viven en `devloop` (binario distinto) | El usuario v3 nuevo no descubre el sistema |
| Wizard init no menciona workflows                                                              | Cero workflows instalados por defecto      |
| `add-wizard` describe `skill` como "reusable workflow"                                         | UX conflation                              |
| `WORKFLOW_TYPES` es literal union TypeScript                                                   | Recompilar el paquete para añadir uno      |
| `contract.json` se lee pero no se shippea                                                      | `devloop gate run` siempre falla           |
| Iron Law 4 (`ok` gate) documentado pero no enforced                                            | Falsos garantías                           |
| `tool_calls` y `artifacts_used` tablas vacías                                                  | UI muestra ceros engañosos                 |
| Brain UI muestra workflows como tabla muerta — ningún drill-down ni acción                     | UI desincentiva usar workflows             |

### 3.3 Complejidad innecesaria

- **Dos backends de event log** con 5 sitios todavía pinneados a legacy, locks que no se cruzan, semánticas de `loadArchivedEvents` divergentes. Vale la pena tener brain backend, pero el "selectEventLog" actual es un parche, no una abstracción terminada.
- **Cuatro tipos de "gate"** que se llaman gate: el skill `quality-gates` (sobre git hooks), los skills `gate-deep-modules` / `gate-plan-coverage` (agent-fork verifiers), los 6 `DETERMINISTIC_CHECKERS` runtime, y la idea narrativa "HARD GATES need ok" (Iron Law 4). Ninguno comparte estructura.
- **Dos lugares de verdad para `WorkflowType`**: `src/runtime/types.ts` y `scripts/lib/types.ts`. Mantener sincronizados a mano.

### 3.4 Abstracciones que faltan o sobran

**Faltan**:

- `WorkflowDefinition` — registry data-driven, leído por classifier/reducer/sync/UI.
- `WorkflowService` — capa que encapsula "abrir log activo, cargar eventos, reducer, validar, append, devolver state nuevo". Hoy duplicado 8+ veces en `cli-handlers/`.
- `GateRegistry` — mapping `gate_id → (deterministic checker | agent skill | shell command)`.
- `findLatestUnresolvedProposal(events, type)` — duplicado en scope.ts, elevation.ts, transitions.ts.

**Sobran**:

- El tipo `path: brain://workflow_events/<wf>/<seq>` que devuelve `BrainEventLog.append`. Solo existe para que `AppendResult` cuadre con la versión legacy. Nadie lo consume. Se puede eliminar haciendo que `AppendResult` tenga `path: string | null`.
- Los 6+ excludes en `vitest.config.ts` que parchean tests heredados de DevLoop. Cuando el migrate cli-handlers↔brain esté completo, varios sobran.

---

## 4. Escalabilidad futura

### 4.1 Workflows dinámicos

**No soportado.** `WORKFLOW_TYPES` en `src/runtime/types.ts:103` es una literal union TS:

```ts
export const WORKFLOW_TYPES = ["project", "feature", "bug-fix", "refactor", "migration"] as const;
export type WorkflowType = (typeof WORKFLOW_TYPES)[number];
```

Cualquier valor fuera de esos 5 strings es rechazado en compile-time. Un workflow dinámico (e.g. cargado de `.codi/workflows/release.yaml`) requiere refactor a `string` con runtime validation contra un registry data-driven.

### 4.2 Workflows reutilizables

Parcial. Los 5 workflows existentes son reutilizables como prosa (cualquier proyecto puede importarlos). Pero **no son componibles** — no puedes definir `release-workflow` que reutilice las fases `plan/execute/verify` de `feature-workflow` y añada `cut-rc/publish`. Cada workflow es un monolito.

### 4.3 Workflows parametrizables

**No soportado en absoluto.** ADR-004 §"Flags editables runtime/per-project" promete:

```yaml
flags:
  scope_enforcement_mode: strict | warn | off
  tdd_strict: true | false
  hooks_override: ...
```

`grep -rn "scope_enforcement_mode\|tdd_strict\|hooks_override" src/` retorna **cero hits**. La feature no existe.

### 4.4 Workflows multi-step

Sí, eso sí funciona — el reducer maneja multi-fase con scope expansions, child workflows (paused/resumed), elevations y handovers. Esa es la parte mejor diseñada del runtime. **Pero el catálogo, la UI, y la API expuesta no aprovechan esa riqueza** — solo se ven listas planas de workflow_runs.

### 4.5 Workflows dependientes de contexto/estado

Sí runtime-side: el reducer sigue scope, status, current_owner, paused_for_child_id. **Pero `iron-laws-enforcer.readGateState`** lee `workflow_runs.current_phase` que **nunca se actualiza después de `INSERT` con `'init'`** (`brain-event-log.ts:191`). Es decir, cualquier consumidor que intente "ramificar el comportamiento por fase activa" usando esa columna verá `init` para siempre.

### 4.6 Limitaciones que bloquean evolución

| Limitación                             | Impacto en evolución                         |
| -------------------------------------- | -------------------------------------------- |
| `WORKFLOW_TYPES` literal union         | Plugin/marketplace de workflows imposible    |
| No `WorkflowDefinition` data-driven    | Workflows-as-data nunca podrá llegar         |
| `tool_calls` / `artifacts_used` vacías | Patterns P3 / P6 / P8 trivialmente fallan    |
| Hooks pinneados a legacy backend       | Migración full-brain inviable hasta corregir |
| Stop hook fictional                    | Pipeline observación impossible to ship      |
| `workflow_runs.current_phase` stale    | Consumers downstream bloqueados              |
| Cross-backend lock leakage             | Concurrencia mal definida                    |

---

## 5. Calidad de implementación

### 5.1 Estructura de carpetas, naming, consistencia

**Bien**:

- `src/runtime/{brain,capture,brain-ui,consolidate,llm,sync}/` — carpetas modulares, índices barrel, sin imports circulares.
- Convención `prefixedName("foo") -> "codi-foo"` consistente.

**Mal**:

- `src/runtime/cli-handlers/` y `src/runtime/cli-handlers.ts` (barrel) coexisten — confuso al navegar.
- `src/templates/skills/{feature,bug-fix,refactor,migration,project}-workflow/` están entre los otros 80 skills planos. Sin agrupación visual.
- `scripts/runtime/devloop.ts` — el binario del runtime workflow se llama "devloop" todavía. Heredado del merge Sprint 1; ya no tiene sentido conservarlo.
- `src/cli/add-wizard.ts:29` describe skill como "Define a reusable workflow". Explícitamente equivocado.

### 5.2 Bugs lógicos / decisiones técnicas problemáticas

| Severidad | Issue                                                                                                            | Localización                           |
| --------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| HIGH      | `validation_passes` deterministic checker hardcoded a `fail` con mensaje stub                                    | `src/runtime/gate-runner.ts:30-102`    |
| HIGH      | `no_unresolved_scope_proposals` retorna `pass` incondicionalmente                                                | `gate-runner.ts:71-85`                 |
| HIGH      | `all_planned_files_modified` retorna `pass` con `files_in_plan.length > 0`                                       | gate-runner.ts                         |
| HIGH      | `recoverWorkflow` y `computeWorkflowStats` fijados a legacy regardless de env                                    | `cli-handlers/{lifecycle,stats}.ts`    |
| HIGH      | Hooks (`hook-logic.ts`) llaman `EventLog.fromCwd` directamente, ignorando `selectEventLog`                       | `hook-logic.ts:270, 440, 468`          |
| HIGH      | `workflow_runs.current_phase` se INSERT como `'init'` y nunca se UPDATE                                          | `brain-event-log.ts:191`               |
| MED       | `loadArchivedEvents` semántica divergente entre backends (legacy: solo archive; brain: todo + filter commitable) | brain-event-log.ts:259 vs event-log.ts |
| MED       | Cross-backend lock leakage — dos `codi run` en backends distintos no se ven                                      | event-log-factory.ts                   |
| MED       | Reducer narrows con `as` raw, sin Zod runtime validation                                                         | reducer.ts:38-42, 105                  |
| LOW       | `path` synthetic URI en `BrainEventLog.append` no se consume                                                     | brain-event-log.ts:238                 |

### 5.3 Código duplicado

Tres copias de "find latest unresolved proposal" walk:

- `src/runtime/cli-handlers/scope.ts:144-170`
- `src/runtime/cli-handlers/elevation.ts:197-207`
- `src/runtime/cli-handlers/transitions.ts:84-105`

Idéntica forma. Extracción mecánica.

Ocho duplicaciones de la secuencia "selectEventLog → getActiveWorkflowId → loadEvents → reduce → createEvent → append" en los 7 handlers (a veces 2 veces por archivo). Indica `WorkflowService` faltante.

### 5.4 Performance / simplificación

- `loadEvents` legacy hace un `readFileSync` por evento + JSON.parse en bucle. Para workflows con cientos de eventos, va a costar — pero todavía no es cuello de botella.
- `reducer.ts` recorre todos los eventos cada vez (no incremental). El diseño es correcto para idempotencia y replay, pero un cache de "última reducción + delta" facilitaría UI live.
- FTS5 sobre `captures` está bien indexado. `prompts_fts` indexado pero sin uso visible (no hay endpoint que lo lea).

---

## 6. Riesgos arquitectónicos

### 6.1 Decisiones que serán deuda técnica

| Riesgo                                                                                                                      | Probabilidad | Impacto                                                 |
| --------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------- |
| `WORKFLOW_TYPES` literal union — habrá que migrar a registry data-driven                                                    | Alta         | Alto — afecta classifier, reducer, schema, sync, UI     |
| Dos backends de event log con 5 sitios pinneados a legacy                                                                   | Alta         | Alto — la migración full-brain requerirá tocarlos todos |
| `contract.json` que el runtime lee pero nadie crea — lazy bomb hasta que un user llama `devloop gate run`                   | Alta         | Medio — error claro pero confuso                        |
| Hooks fijados a legacy mientras CLI handlers usan factory — silencioso bypass de enforcement con `CODI_USE_BRAIN_BACKEND=1` | Alta         | Alto — Iron Laws no enforced                            |
| `add-wizard.ts:29` describe skill como "reusable workflow"                                                                  | Alta         | Bajo — UX, pero confunde la mental model                |
| Stop hook fictional + CODI-OBSERVATION pipeline en 7 sitios documentado                                                     | Alta         | Medio — plataforma promete y no cumple                  |
| Iron Laws enforcer sin callers                                                                                              | Cierto       | Alto — feature documentada que no funciona              |

### 6.2 Sobreingeniería

- `BrainEventLog` synthetic `path: brain://...` URI — solo para que el tipo cuadre. Eliminar haciendo `path` opcional.
- El doble registro `manifest.json` legacy + `workflow_runs.metadata` brain — ambos son fuentes de verdad parciales.
- `runtime/llm/` interface + 2 providers + selector + maxCallsPerRun para una sola llamada en `runConsolidation`. Sería defendible si ya hubiera 3+ call sites; con uno solo es premature.

### 6.3 Insuficientemente abstraído

- **`Workflow` no es un tipo.** Solo strings.
- **`Gate` no es un tipo.** 4 nociones distintas.
- **`Phase` no es per-workflow.** Lista global.
- **`WorkflowService`** no existe.
- **`HookContext`** existe (`hook-logic.ts:84`) pero no es accesible desde `iron-laws-enforcer.ts` ni `runtime/cli-handlers/`.

### 6.4 Áreas a refactorizar antes de seguir

1. **Promover Workflow a artifact-type real** (impact: catálogo, wizard, plugin manifest, scaffolder).
2. **Hooks deben ir por `selectEventLog`** (impact: enforcement real bajo brain backend).
3. **Implementar Stop hook o retractar el pipeline `[CODI-OBSERVATION: ...]`** (impact: honestidad de plataforma).
4. **Implementar Iron Laws 4-8 enforcer wiring o moverlos a `behavioral`** (impact: honestidad otra vez).
5. **Persistir contracts.json o reescribir `gate-runner` para no requerirlos** (impact: gates funcionan).
6. **Reemplazar `WORKFLOW_TYPES` literal union por registry** (impact: extensibilidad).

---

## 7. Recomendaciones accionables (priorizadas)

### Prioridad 1 — antes de la próxima feature

#### R1.1 Decidir y comunicar el modelo

**Two-pizza decision**, una semana de trabajo. Elige:

- **Opción A — workflows son el centro.** Entonces:
  - Promueve `Workflow` a `ArtifactType` real (5to valor).
  - Añade `Workflow` al `PluginArtifact.type` union, bump `schemaVersion: 2`.
  - Sub-comando `codi workflow {create,list,run,transition,abandon,recover}` en `src/cli.ts`.
  - Categoría `Workflows` en `catalog-renderer.ts` y `RULE_CATEGORIES`-equivalente.
  - Página `/catalog/workflows/` en docs site.
  - Default preset `balanced` instala `feature-workflow` por lo menos.
  - Doc `codi-v3-architecture.md` rewriten con workflows en el centro del diagrama.

- **Opción B — el centro es el brain + capture + consolidation; workflows son un sistema de soporte.** Entonces:
  - Retracta la frase "workflows son el centro" en plan maestro y closure plan.
  - Mantén workflows como skills con prefix.
  - Acepta que hay 2 binarios (`codi` + `devloop`).
  - Pero todavía: implementa los gates, el Stop hook, los Iron Laws enforcer wiring, los contracts.

Mi recomendación: **A**, porque cuando el usuario habla de "el verdadero elemento central del sistema son los workflows" está describiendo lo que QUIERE construir. La opción B es honesta pero acepta una resignación.

#### R1.2 Cierra los tres "fictional features" o retira los claims

- Stop hook + `[CODI-OBSERVATION: ...]` pipeline.
- Contract.json de gates.
- Iron Laws 4-8 enforcer wiring.

Cada uno es 1-2 días de trabajo o 1 hora de retractación. Pero **decidir uno u otro hay que hacerlo**, porque la documentación los promete a través de 7+ rules/skills.

#### R1.3 `workflow_runs.current_phase` debe actualizarse

Todo `BrainEventLog.append` con `event_type ∈ {phase_started, phase_completed, workflow_completed, workflow_abandoned}` debe `UPDATE workflow_runs SET current_phase = ?, status = ? WHERE workflow_id = ?` dentro de la misma transacción. Sin esto, cualquier feature downstream que consulte la columna ve datos rancios eternamente.

### Prioridad 2 — antes de v3.1

#### R2.1 Workflow definition contract

Frontmatter de los 5 workflow-skills añade:

```yaml
mode: workflow
phases:
  - id: intent
    gates: [task_described]
  - id: plan
    gates: [scope_files_listed, plan_artifact_exists]
    skills: [plan-writer]
  - id: execute
    skills: [tdd, subagent-orchestration]
    gates: [plan-coverage]
transitions:
  - { from: intent, to: plan, requires_gate: task_described }
flags:
  tdd_strict: { default: true, type: boolean }
```

Sin este contract, ningún progreso de workflows-as-the-center es genuino.

#### R2.2 `workflow-creator` skill + `codi workflow create` command

Análogo a `skill-creator`. Bootstrapea:

- `.codi/workflows/<name>/{frontmatter.yaml, references/}`
- Registro en `WORKFLOW_DEFINITIONS` registry (no más literal union).
- Validación contra el contract de R2.1.

#### R2.3 Hooks van por `selectEventLog`

`hook-logic.ts:270, 440, 468` — `EventLog.fromCwd(cwd)` → `selectEventLog(cwd)`. Test que verifica: con `CODI_USE_BRAIN_BACKEND=1`, el hook lee `workflow_runs` y emite `<workflow-state>` block correctamente.

#### R2.4 Cross-backend lock

Un `.codi/lock` archivo que ambos backends respeten, o una migración full-brain que retire el legacy.

### Prioridad 3 — antes de v3.2

#### R3.1 Extraer `WorkflowService` + `findLatestUnresolvedProposal` helper

Elimina las 8+ duplicaciones del patrón open-load-reduce-validate-append en `cli-handlers/`. Ratio coste/beneficio alto, riesgo bajo.

#### R3.2 Plugin manifest registra workflows

- `PluginArtifact.type` añade `"workflow"`.
- `buildPluginManifest` filtra por capability — Tier 1A/1B reciben workflows; Tier 2 los ignora (porque no corren hooks que phase-locked workflows necesitan).

#### R3.3 Brain UI workflow drill-down

- `/workflow/:id` page con timeline de eventos.
- `POST /api/v1/workflows/:id/transition { to_phase, ok_token }` — espejo simétrico de `/proposals/:id/accept`.

#### R3.4 Implementación real de los 8 gates restantes

Master plan promete 14+1; hay 6 (de los cuales 2 son `pass` falsos). Mejor implementar 6 reales que 14 stubbed.

### Prioridad 4 — diferible a v3.3+

#### R4.1 Postgres mirror para lite/standard/full

Schema 1:1 desde SQLite. Activación tras dogfood real de zero-mode.

#### R4.2 vec0 vector index

Para búsquedas semánticas sobre captures.

#### R4.3 Cleanup `devloop` binary

Re-marcar como deprecated. Mover comandos a `codi workflow {run,transition,...}`.

---

## Apéndice A — partes especialmente bien resueltas (mantener como referencia)

| Pieza                                                                       | Por qué es buena                                                                                                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/runtime/brain/{schema,migrate,db}.ts`                                  | Esquema 11+1 tablas + FTS5 + idempotent bootstrap, drizzle ORM, WAL + foreign keys. Buena dirección.                                    |
| `src/runtime/capture/{markers,persist}.ts`                                  | Parser conservador con dedup por `(turn_id, raw_marker)`, cobertura test sólida (11 cases).                                             |
| `src/runtime/reducer.ts`                                                    | Pure, idempotent, exhaustivos compile-time checks. Coverage de 21+ tipos de evento.                                                     |
| `src/runtime/event-log-factory.ts` (post-fix gap)                           | Abstracción `EventLogLike` + selector + type guard para casos legacy-only. Buen patrón para pluggable backends.                         |
| `src/runtime/consolidate/patterns.ts`                                       | 8 detectores con interfaz uniforme `PatternDetector`. Solo SQL. Pure functions. Extensible.                                             |
| `src/runtime/llm/provider.ts`                                               | Interface limpia + 2 implementaciones + redactKey + maxCallsPerRun. (Aunque sobreingenierizada para 1 call site, el shape es correcto.) |
| `src/core/capabilities/matrix.ts` con governance contract + regression test | Buena disciplina contra erosión silenciosa.                                                                                             |
| `src/core/migration/{v2-to-v3,executor}.ts`                                 | Planner pure + executor con StepRecord granular + dry-run default. Buen ejemplo de "safe by default".                                   |

---

## Apéndice B — tabla resumen de severidad

| #   | Hallazgo                                  | Severidad | Categoría     | Recomendación           |
| --- | ----------------------------------------- | --------- | ------------- | ----------------------- |
| 1   | Workflow no es un ArtifactType            | HIGH      | Arquitectura  | R1.1                    |
| 2   | Plugin manifest excluye workflow          | HIGH      | Arquitectura  | R3.2                    |
| 3   | `codi` binario sin comandos workflow      | HIGH      | DX            | R1.1                    |
| 4   | Wizard / presets sin workflows            | HIGH      | DX            | R1.1                    |
| 5   | `WORKFLOW_TYPES` literal union            | HIGH      | Escalabilidad | R2.2                    |
| 6   | `contract.json` no shippean               | HIGH      | Calidad       | R1.2                    |
| 7   | Stop hook no existe                       | HIGH      | Calidad       | R1.2                    |
| 8   | Iron Laws enforcer sin callers            | HIGH      | Calidad       | R1.2 + R2.3             |
| 9   | Hooks pinneados a legacy backend          | HIGH      | Runtime       | R2.3                    |
| 10  | `workflow_runs.current_phase` stale       | HIGH      | Runtime       | R1.3                    |
| 11  | Phase graph no enforced                   | HIGH      | Modelo        | R2.1                    |
| 12  | Frontmatter de workflows sin contract     | HIGH      | Modelo        | R2.1                    |
| 13  | No `workflow-creator` skill               | MED       | DX            | R2.2                    |
| 14  | Brain UI sin drill-down workflow          | MED       | DX            | R3.3                    |
| 15  | Cross-backend lock leakage                | MED       | Runtime       | R2.4                    |
| 16  | `recoverWorkflow`/`stats` solo legacy     | MED       | Runtime       | R2.3 cont.              |
| 17  | `tool_calls`/`artifacts_used` vacías      | MED       | Runtime       | (PreToolUse INSERTs)    |
| 18  | 2/6 gate checkers son fake pass           | MED       | Calidad       | R3.4                    |
| 19  | Reducer `as` casts sin Zod runtime        | MED       | Calidad       | (Zod parse incremental) |
| 20  | 3× duplicación findLatestUnresolved       | LOW       | Calidad       | R3.1                    |
| 21  | 8× duplicación open-reduce-append         | LOW       | Calidad       | R3.1                    |
| 22  | Synthetic `brain://` URI dead weight      | LOW       | Calidad       | (eliminar)              |
| 23  | `add-wizard` describe skill como workflow | LOW       | DX            | (rewording)             |
| 24  | `devloop` binario todavía existe          | LOW       | DX            | R4.3                    |
| 25  | Doc arquitectura no centra workflows      | LOW       | Comunicación  | R1.1                    |

---

## Cierre

El runtime que se construyó es bueno: el reducer es pure y exhaustivo, el event log tiene dos backends razonables (con leaks parchables), el capture parser es conservador y bien testado, la consolidation pipeline tiene 8 patterns + LLM enrichment. **Esa parte vale.**

Lo que falta es el **paso del runtime al producto**: el catálogo, el plugin manifest, el wizard, los comandos del binario `codi`, los contracts, los hooks que no leen brain, y los tres fictional features. Sin ese paso, "workflows son el centro" es marketing interno; con ese paso, lo es de verdad.

Mi recomendación final: **detén la siguiente feature, agarra Prioridad 1 (R1.1, R1.2, R1.3) en una sola tanda de 1-2 semanas, y sólo entonces sigue construyendo encima.** La deuda actual es financiable, pero crece exponencialmente con cada feature que se apila sobre el modelo equivocado.
