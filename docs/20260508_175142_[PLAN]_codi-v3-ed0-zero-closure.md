# Plan: Codi v3 ed.0 zero — closure + v3.0.0 release

- **Date**: 2026-05-08 17:51 (revised after Q4-Q5)
- **Document**: 20260508*175142*[PLAN]\_codi-v3-ed0-zero-closure.md
- **Category**: PLAN
- **Estado**: design pending user approval
- **Scope**: code-complete + Diataxis docs + LLM provider (Gemini/OpenAI) + v3.0.0 release. Zero-mode only.
- **Reemplaza alcance previo**: el doc `20260508_165317_[PLAN]_codi-v3-sprints-4-7-checkpoint.md` describía Sprints 4-7 completos; este doc define el subset realista para shipear v3.0.0 GA.

---

## Goal

Cierra Codi v3 ed.0 zero-mode + shipea **v3.0.0 GA**: todos los features de zero-mode funcionan, LLM consolidation real con Gemini + OpenAI, Diataxis docs publicados, branch lista para merge a `main` (CI publica a npm).

**Decisiones lock-in (Q1-Q5)**:

- Q1 → criterio "release" (ampliado de code-complete)
- Q2 → workflows migrados al brain.db (refactor real)
- Q3 → matrix gobierna solo emisiones nuevas; adapters Tier 2 intocables
- Q4 → versioning **v3.0.0** major bump
- Q5 → LLM providers: **Gemini + OpenAI** detrás de interfaz pluggable; sin Anthropic

Excluido explícitamente:

- Postgres mirror, Docker compose, lite/standard/full
- vec0 vector index
- Real LLM dogfood (consolidation pipeline correrá con providers configurados, pero no exigimos que el dogfood sobre el repo `codi` mismo pase como acceptance — el dogfood como GATE de release queda deferred)
- Anthropic SDK integration

---

## Scope (8 items)

### Item 1+2 — Workflows over brain.db

Refactor para que los 5 workflows DevLoop (project / feature / bug-fix / refactor / migration) lean/escriban `~/.codi/brain.db` en vez de `.devloop/active/`.

**Estrategia**: Dependency Injection.

- `BrainEventLog` clase nueva con misma surface que `EventLog`.
- `cli-handlers.ts` recibe el log via parameter (default = legacy `EventLog` para no romper tests existentes).
- Flag `useBrainBackend` o env `CODI_USE_BRAIN_BACKEND=1` activa el nuevo backend en runtime.
- Tests existentes (~30 archivos) intocables. Tests paralelos cubren ambos backends.

**Archivos**:

- `src/runtime/brain-event-log.ts` (new, ~200 líneas)
- `src/runtime/cli-handlers.ts` (DI param)
- `tests/runtime/brain-event-log.test.ts` (new, ~150 líneas)

### Item 3 — Iron Laws 4-8 runtime enforcement

Iron Laws 1-3 son behavioral (no enforced).

| Iron Law                         | Enforcement                                                                                                           | Hook                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 4. HARD GATES need `ok`          | UserPromptSubmit injecta gate state. PreToolUse rechaza writes si phase está pending_approval.                        | UserPromptSubmit + PreToolUse |
| 5. Pull before patch             | PreToolUse verifica que la última lectura del brain es < 60s antes de Edit/Write.                                     | PreToolUse                    |
| 6. Atomic + rollback             | Hooks existentes cumplen. Test verifica que writes a brain.db abren transaction.                                      | (existing)                    |
| 7. Never commit without approval | PreToolUse rechaza `git commit` / `git push` si último prompt no contiene `commit` / `push` token.                    | PreToolUse                    |
| 8. Output mode                   | UserPromptSubmit ya implementado (buildCaptureReminderBlock). Añadir output_mode line desde `.codi/preferences.json`. | UserPromptSubmit              |

**Archivos**:

- `src/runtime/iron-laws-enforcer.ts` (new, ~120 líneas) — pure functions
- `src/runtime/hook-logic.ts` (extend buildPromptStateBlock)
- `tests/runtime/iron-laws-enforcer.test.ts` (new, ~100 líneas)

### Item 4 — Editable prompt templates (8 patterns)

8 templates `.md.tmpl` en `src/templates/consolidation/p1-repeated-correction.md.tmpl` ... `p8-unused-rule.md.tmpl`.

Cada template: header con role + body con placeholders (`{evidence}`, `{rationale_seed}`, `{artifact_name}`).

`src/runtime/consolidate/prompts.ts` carga templates, sustituye placeholders. Pattern detectors emiten `prompt` field opcional con el texto renderizado.

**Archivos**:

- `src/templates/consolidation/p1...p8.md.tmpl` (8 archivos, ~30 líneas cada)
- `src/runtime/consolidate/prompts.ts` (new, ~80 líneas)
- `src/runtime/consolidate/patterns.ts` (extend con render)
- `tests/runtime/consolidate-prompts.test.ts` (new, ~60 líneas)

### Item 5 — Capabilities Matrix governance

Decisión locked-in: matrix solo gobierna emisiones nuevas. Adapters Tier 2 existentes intocables.

**Cambio**: ninguno funcional. Solo:

- Test regression guard: `src/adapters/cursor`, `windsurf`, `cline`, `copilot`, `gemini` NO importan la matrix.
- Doc-comment en `matrix.ts` explica el contrato opt-in.

**Archivos**:

- `src/core/capabilities/matrix.ts` (extend doc-comment)
- `tests/unit/core/capabilities-governance.test.ts` (new, ~40 líneas)

### Item 6 — LLM provider integration (Gemini + OpenAI)

**Pluggable interface**:

```typescript
// src/runtime/llm/provider.ts
export interface LlmProvider {
  readonly id: "gemini" | "openai";
  generate(opts: GenerateOptions): Promise<GenerateResult>;
}

export interface GenerateOptions {
  readonly system: string;
  readonly user: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface GenerateResult {
  readonly text: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly model: string;
}
```

**Concretos**:

- `src/runtime/llm/gemini.ts` — uses `@google/generative-ai`. Reads `CODI_GEMINI_API_KEY`. Default model `gemini-1.5-flash`.
- `src/runtime/llm/openai.ts` — uses `openai`. Reads `CODI_OPENAI_API_KEY`. Default model `gpt-4o-mini`.

**Selector**:

- `CODI_LLM_PROVIDER=gemini|openai` env var.
- Default: `gemini` (cheaper for the volume of consolidation calls).
- `getDefaultProvider()` lee env, valida key existe, instancia.

**Wiring en consolidation**:

- `/api/v1/consolidation/run-with-llm` reemplaza el 501 stub. Body: `{ patterns?: string[], dryRun?: boolean }`. Response: proposals con `prompt_response` field.
- Cada pattern detector que tenga `prompt` template lo renderiza, llama provider, parsea respuesta como improvement texto, guarda en `proposal.patch.llm_response`.

**Riesgos & mitigation**:

- Network failure → catch + retry once + fallback a "agent" mode (proposals sin LLM enrichment).
- Rate limits → respeta provider's retry-after header. Dejar 1s entre calls por defecto.
- Costos descontrolados → `CODI_LLM_MAX_CALLS_PER_RUN=20` env, default 20.

**Archivos**:

- `src/runtime/llm/provider.ts` (interface)
- `src/runtime/llm/gemini.ts` (~120 líneas)
- `src/runtime/llm/openai.ts` (~120 líneas)
- `src/runtime/llm/registry.ts` (selector)
- `src/runtime/llm/index.ts` (barrel)
- `src/runtime/brain-ui/routes-api.ts` (replace 501 stub)
- `tests/runtime/llm-provider.test.ts` (mocked fetch, contract tests)
- `tests/runtime/llm-consolidation-integration.test.ts` (mocked, end-to-end)
- Deps: `@google/generative-ai` + `openai`

### Item 7 — Diataxis docs (3 documentos)

Per master plan §16, ubicación: `docs/src/content/docs/` (Astro Starlight site).

- **`docs/src/content/docs/guides/upgrade-from-v2.md`** (Diataxis: how-to)
  - Pre-requisitos, comando `codi migrate v2-to-v3 --apply`, qué backupea, qué reescribe, troubleshooting.
- **`docs/src/content/docs/explanation/codi-v3-architecture.md`** (Diataxis: explanation)
  - Mental model: capture-everything → brain → consolidation → re-emit.
  - Schema overview (12 tablas), capture protocol, ExternalSyncer interface, Capabilities Matrix.
  - Mermaid diagrams para flujo session → captures → proposals → accept → package.
- **`docs/src/content/docs/reference/cli-commands.md`** (Diataxis: reference)
  - Listado completo: `codi init`, `add`, `generate`, `migrate v2-to-v3`, `plugin publish`, `brain ui`, `brain export`, etc.
  - Args + flags + exit codes + ejemplos de output.

**Archivos**:

- 3 archivos `.md` (~150-300 líneas cada uno)

### Item 8 — v3.0.0 release prep

**No** ejecuto `npm publish` (CI lo hace en merge a `main`). Solo prep:

1. Bump `package.json::version` → `3.0.0`.
2. CHANGELOG.md `[Unreleased]` → mover bajo `## [3.0.0] - 2026-05-08`. Sección "BREAKING" first.
3. Update `engines.node` si aplica (mantener `>=20`).
4. Verificar `pnpm build && pnpm test && pnpm lint` verde.
5. Push branch. PR contra `main` con título `release: v3.0.0 — codi brain harness`.
6. CI corre coverage gate; ya pasa.
7. Merge → CI ejecuta `prepublishOnly` → `npm publish`.

**Acceptance del release**: branch ready for PR. NO merge en este sprint (lo hace el user vía PR review).

**Archivos**:

- `package.json` (version bump)
- `CHANGELOG.md` (release section)

---

## Execution order (dependencies)

1. **Item 4** prompt templates → calentamiento
2. **Item 6** LLM provider integration → depende de Item 4 (prompts) — el grueso técnico nuevo
3. **Item 1+2** workflows → brain.db → biggest refactor
4. **Item 3** Iron Laws hooks → depende de Item 1
5. **Item 5** matrix governance review → solo doc + test
6. **Item 7** Diataxis docs → necesita features estables (al final)
7. **Item 8** release prep → último (version bump + CHANGELOG)

Cada item: cambio + tests verde + commit conventional atomic.

---

## Acceptance criteria

| Criterio                                      | Verificación                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| Tests verde                                   | `pnpm test` → 0 failures, count ≥ 280 archivos                           |
| Lint clean                                    | `pnpm lint` → 0 errors                                                   |
| Build OK                                      | `pnpm build`                                                             |
| BrainEventLog pasa contract                   | mismos test cases sobre ambos backends                                   |
| 8 prompt templates existen                    | archivos en `src/templates/consolidation/`                               |
| Iron Laws 4-8 enforcer callable               | tests cubren 5 paths                                                     |
| Adapters Tier 2 unchanged                     | git diff vacío en `src/adapters/{cursor,windsurf,cline,copilot,gemini}/` |
| LLM providers wired                           | mocked tests pasan con Gemini + OpenAI                                   |
| `/run-with-llm` retorna 200 con mock provider | integration test                                                         |
| 3 Diataxis docs                               | archivos existen, lint markdown OK                                       |
| `package.json::version === "3.0.0"`           | grep                                                                     |
| CHANGELOG `[3.0.0]` section                   | grep                                                                     |
| Working tree clean                            | `git status` empty                                                       |
| Branch ready for PR                           | last commit es `release: v3.0.0`                                         |

NO incluido en acceptance:

- Branch mergeada (deferred — user hace PR review + merge)
- Tag `v3.0.0` push (CI lo hace post-merge)
- npm publish (CI)
- Dogfood pass real LLM (deferred a post-release)

---

## Risks

| #   | Riesgo                                         | Probabilidad | Mitigación                                            |
| --- | ---------------------------------------------- | ------------ | ----------------------------------------------------- |
| R1  | BrainEventLog rompe tests existentes           | Media        | DI con default = legacy; tests paralelos              |
| R2  | Iron Laws hooks bloquean ops legítimas         | Alta         | Hooks advisory, no blocking; user override via env    |
| R3  | LLM API keys leak en logs                      | Alta         | Provider redacts key; tests verifican redaction       |
| R4  | Gemini/OpenAI rate limits → flaky tests        | Media        | Tests usan mocked fetch, no real API                  |
| R5  | Costos LLM descontrolados en consolidation     | Alta         | `CODI_LLM_MAX_CALLS_PER_RUN=20` default               |
| R6  | Diataxis docs referencian features incompletas | Media        | Escribir AL FINAL, después de items 1-6               |
| R7  | v3.0.0 major bump rompe v2 users sin migration | Alta         | upgrade-from-v2.md + `codi migrate` script ya shipean |
| R8  | CHANGELOG no refleja todo el v3 work           | Media        | Self-review final antes de commit release             |

---

## What's deferred to v3.1

- Postgres mirror + lite/standard/full modes
- Docker compose stack
- vec0 vector embeddings
- Anthropic provider
- `codi consolidation edit-prompt` CLI
- Adapter wiring to Capabilities Matrix (matrix opt-in)
- `codi migrate v2-to-v3 --apply` dogfood pass

Tracked en `docs/20260508_165317_[PLAN]_codi-v3-sprints-4-7-checkpoint.md`.
