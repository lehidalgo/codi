# PROPUESTA — CODI v4: "Default-First, Opt-In Customization"

- **Fecha:** 2026-05-17
- **Categoría:** PROPOSAL
- **Branch base:** `feature/codi-v3-harness`
- **Estado:** Draft para revisión del usuario
- **Inputs consultados:**
  - Industry research: ThoughtWorks Tech Radar Vol 34 (Apr 2026), DORA 2025, Anthropic best practices, GitGuardian/Cycode, Linux Foundation Agentic AI Foundation
  - Reference setup: `/home/lehidalgo/dev/rl3/capellai-ai-crm/.claude/` (26 rules + 40 skills + 2 agents + 5 commands)
  - Current state: CODI v3 `src/templates/` (29 rules, 46+ skills, 21 agents, 6 presets)

---

## 1. Tesis

> CODI hoy obliga a tomar una **decisión de configuración** antes de funcionar. La propuesta es invertir esa relación: **CODI debe instalarse y funcionar útilmente desde el segundo cero**, sin que el equipo elija nada. Las decisiones (lenguaje específico, framework, compliance, knowledge management) son **add-ons opt-in** sobre la base universal.

**Cambio fundamental:**
| Hoy (v3) | Mañana (v4) |
|---|---|
| `codi init` → wizard → "elige preset (minimal/balanced/strict/fullstack/dev/power-user)" → 4 capas más de decisiones | `codi init` → instala base universal → "¿algún add-on?" (opcional) |
| 6 presets fragmentados, default=balanced | **1 base universal** + add-ons componibles |
| Default = decisión del usuario | Default = baseline de industria 2026 + patrones CODI core |
| Personalización = elegir otro preset | Personalización = añadir/quitar add-ons o editar artifacts |

---

## 2. Por qué cambiar (problemas del modelo actual)

### 2.1 Análisis funcional reciente (audit 2026-05-17)

- 4 de los 6 presets (`minimal`, `balanced`, `strict`, `fullstack`) son básicamente la misma idea con flags ajustados. No hay diferencias de identidad genuinas — solo dosajes de "rigor".
- `codi-dev` y `codi-power-user` son los únicos con identidad diferenciada (dev tools internos vs. workflow daily).
- Default `balanced` deja `security_scan=on` PERO **no instala el rule `codi-security`** (gap funcional). Otros mismatches similares.

### 2.2 Convergencia de industria 2026 (research)

Hay un **baseline universal** que CADA equipo serio activa, según ThoughtWorks Vol 34 + DORA 2025 + Anthropic + Linux Foundation Agentic AI Foundation:

| # | Práctica | Por qué es universal |
|---|---|---|
| 1 | `AGENTS.md` / `CLAUDE.md` committed | Source of truth para AI; 60k+ repos OSS |
| 2 | Pre-commit secret scan (`gitleaks` o `ggshield`) | 28.6M secretos leaked GitHub 2025 (+34% YoY); AI commits leak 2× baseline |
| 3 | CI mirror de pre-commit hooks | `--no-verify` bypass debe fallar en merge gate |
| 4 | Strict type checking (TS/Py/Go) | Feedback loop más fuerte del agente con ground-truth |
| 5 | Linter + formatter con auto-fix (Biome/ruff) | Cero cost, consistencia inmediata |
| 6 | Conventional Commits via `commitlint` | Habilita semver + changelogs automáticos |
| 7 | Branch protection + PR required + no force-push | SOC2 baseline; audit trail cuando agentes commitean |
| 8 | Dependency CVE scan (`dependabot`/`renovate`) | Auto-PR para security updates |
| 9 | Agent permission rules con deny list | Bloquea `rm -rf`, `git push --force`, `curl \| sh` |
| 10 | Per-user/team token budget cap | Cost control mandatory en 2026 |
| 11 | Audit log de tool calls (hooks → SIEM) | Compliance + debug |
| 12 | `.gitignore` de personal overrides | Evita drift por archivos locales committed |

**La pregunta no es "qué preset elijo"; es "cómo aplico estos 12".** CODI v4 debe responder eso por default.

### 2.3 Reference setup (capellai-ai-crm) ya ejecuta el patrón

Capellai NO eligió ningún preset estándar — extendió `codi-dev` con su propio dominio (vault + Obsidian + caveman mode). Los patrones GENERALIZABLES de esa configuración (no los dominio-específicos) son:

| Patrón capellai | Universalizable como default v4 |
|---|---|
| `agent-capability-discovery` rule + inject hook | ✅ Forzar al agente a proponer skills antes de actuar — útil para cualquier equipo |
| `codi-improvement-dev` (continuous artifact loop) | ✅ El observation→capture→refine→contribute es valor core CODI |
| PreToolUse guards estrictos (deny `git push main`, `git config --global`, `.env` writes) | ✅ Universal: nadie debería hacer eso |
| PostToolUse auto-format | ✅ Universal con `lint_on_save: true` |
| Iron Law numbering (referencias cortas a comportamientos largos) | ✅ Patrón de design transferible |
| Evals mandatorios por skill | ✅ Universal |
| 3-layer config (template → consumer → local) | ✅ Universal (es esencialmente la propuesta v4) |
| **Vault/Obsidian/wiki** | ❌ Capellai-specific → add-on `knowledge-vault` |
| **Caveman mode** (token compression) | ❌ Capellai-specific → add-on `output-tone-caveman` |
| **Spanish orthography** | ❌ Capellai-specific → add-on `spanish-i18n` |
| **v1-sprint-gates** | ❌ Capellai-specific → add-on `release-gates` |
| **Wiki agents** (wiki-ingest, wiki-lint) | ❌ Capellai-specific → add-on `knowledge-vault` |

---

## 3. Propuesta arquitectónica v4

### 3.1 Modelo conceptual

```
┌─────────────────────────────────────────────────────────────┐
│  CODI v4 INSTALL                                            │
│                                                             │
│  ┌─────────────────────────────────────────────┐           │
│  │  BASE (auto-instalada, no se elige)         │           │
│  │  ─────────────────────────────────────       │           │
│  │  · 12 industry baseline practices            │           │
│  │  · CODI core patterns (improvement loop,     │           │
│  │    capability discovery, observability)      │           │
│  │  · Universal rules/skills (workflow,         │           │
│  │    security, testing, git, code-style)       │           │
│  └─────────────────────────────────────────────┘           │
│                                                             │
│  ┌─────────────────────────────────────────────┐           │
│  │  ADD-ONS (opt-in, componibles)              │           │
│  │  ─────────────────────────────────────       │           │
│  │  · lang-{typescript,python,go,...}           │           │
│  │  · framework-{nextjs,django,react,...}       │           │
│  │  · workflow-{tdd-strict,spec-driven,...}     │           │
│  │  · knowledge-{vault,markdown,canvas}         │           │
│  │  · compliance-{soc2,hipaa,gdpr,pci-dss}      │           │
│  │  · tone-{caveman,verbose,default}            │           │
│  │  · i18n-{spanish,french,...}                 │           │
│  └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Contenido propuesto de la BASE v4

#### Rules (10 — siempre)

| Rule | Origen v3 | Por qué en BASE |
|---|---|---|
| `codi-workflow` | existing | Human-in-the-loop: understand→search→propose→execute (universal AI pattern) |
| `codi-git-workflow` | existing | Conventional Commits + atomic commits (#6 baseline) |
| `codi-security` | existing | OWASP Top 10 + secrets handling (#2,9 baseline) |
| `codi-testing` | existing | TDD discipline + 80% coverage min (universal) |
| `codi-code-style` | existing | Naming + size limits + single responsibility (universal) |
| `codi-error-handling` | existing | Result types + actionable errors (universal AI-aware) |
| `codi-output-discipline` | existing | Anti-sycophancy + lead-with-answer (universal AI hygiene) |
| `codi-documentation` | existing | Diataxis + JSDoc on public APIs (universal) |
| `codi-improvement` | existing (core-platform) | CODI's killer feature: continuous artifact loop |
| `agent-capability-discovery` | **NEW** (extract from capellai) | Force agent to propose skills before acting |

#### Skills (8 — siempre)

| Skill | Origen v3 | Por qué en BASE |
|---|---|---|
| `codi-verify-evidence` | existing (core-platform) | Phase 0/1 evidence before "done" claim |
| `codi-code-review` | existing | Universal review workflow |
| `codi-commit` | existing | Universal git commit pattern |
| `codi-security-scan` | existing | Activa cuando `security_scan: true` (default) |
| `codi-debugging` | existing | Universal debugging skill |
| `codi-tdd` | existing | TDD red-green-refactor (Anthropic pattern) |
| `codi-dev-session-recovery` | existing (core-platform) | Recover after repeated errors (Anthropic Security Eng pattern) |
| `codi-dev-refine-rules` | existing (core-platform) | Loop closure: feedback → refinement |

#### Agents (3 — siempre)

| Agent | Origen v3 | Por qué en BASE |
|---|---|---|
| `codi-code-reviewer` | existing | Code review universal |
| `codi-test-generator` | existing | Test generation universal |
| `codi-security-analyzer` | existing | Security scan universal |

#### Hooks (always-on, ya OK en v3)

- Conflict marker check ✓
- Staged junk check (`.DS_Store`, etc.) ✓
- File size check ✓
- Secret detection ✓
- Commit msg (conventional commits) ✓
- Skill YAML validate ✓
- Skill resource check ✓
- Doc naming check ✓
- Import depth check ✓
- Artifact validate ✓

**Add para v4:**
- **PreToolUse Bash guard** (deny `git push main`, `git push --force`, `git config --global *`, `pip install *` from agent) — universal safety
- **PreToolUse Edit guard** (`.env` files require vault-cli or user-confirmation) — universal safety
- **PostToolUse auto-format** (Prettier/Black/etc.) — universal hygiene

#### Flags (defaults sensatos, sin "preset" como concepto)

| Flag | Default v4 | Razón |
|---|---|---|
| `test_before_commit` | true | Industry baseline |
| `security_scan` | true | Industry baseline (gitleaks pre-commit) |
| `type_checking` | strict | Industry baseline (#4) |
| `require_tests` | false | "Recomendado" no "obligado" — equipo decide |
| `allow_shell_commands` | true | Default permisivo, deny list cubre lo peligroso |
| `allow_file_deletion` | true | Default permisivo |
| `lint_on_save` | true | Industry baseline (#5) |
| `allow_force_push` | false | Industry baseline (#7) |
| `require_pr_review` | true | Industry baseline (#7) |
| `auto_generate_on_change` | false | Opt-in (causa loops potenciales) |
| `drift_detection` | warn | Sensato default |
| `progressive_loading` | metadata | Sensato default |
| `mcp_allowed_servers` | [] | Opt-in, equipo añade |

### 3.3 Add-ons propuestos (reemplazan presets)

```bash
codi add-on install lang-typescript     # añade codi-typescript rule + tsc strict + ESLint config
codi add-on install framework-nextjs    # añade codi-nextjs rule + Server Components patterns
codi add-on install workflow-tdd-strict # añade strict TDD enforcement
codi add-on install knowledge-vault     # añade Obsidian/wiki skills + canvas + autoresearch
codi add-on install compliance-soc2     # añade audit hooks, retention rules, doc requirements
codi add-on install i18n-spanish        # añade codi-spanish-orthography rule
```

**Catálogo inicial propuesto:**

| Categoría | Add-ons |
|---|---|
| **lang-** | typescript, python, golang, rust, java, kotlin, swift, csharp, php, ruby, dart, shell |
| **framework-** | nextjs, react, django, spring-boot, fastapi, rails, vue |
| **workflow-** | tdd-strict, spec-driven, sprint-gates, pair-programming-ai |
| **knowledge-** | vault, canvas, autoresearch, markdown-discipline |
| **compliance-** | soc2, hipaa, gdpr, pci-dss, eu-ai-act |
| **tone-** | caveman, verbose, default |
| **i18n-** | spanish, french, german, portuguese, japanese |
| **tooling-** | playwright-e2e, vitest, jest, pytest, mcp-servers-curated |

---

## 4. UX change: el nuevo `codi init`

### 4.1 Antes (v3)

```
$ codi init
? Languages: [...select...]
? Agents: [...select...]
? Configuration mode: [preset/custom/zip/github]
? Choose a preset: [minimal/balanced/strict/fullstack/dev/power-user]
? Boolean flags: [...customize...]
? type_checking: [strict/basic/off]
? ... más prompts ...
```

10+ pasos antes de tener algo funcional. Decisión-pesado.

### 4.2 Después (v4)

```
$ codi init
✔ Auto-detecting stack...        typescript, nextjs
✔ Installing CODI base...        10 rules, 8 skills, 3 agents, 15 hooks
✔ Generating CLAUDE.md...        verification token codi-XXXX

✓ Ready. Run `codi onboard` to brief your agent.

Optional add-ons relevant to your stack:
  • framework-nextjs (recommended for your stack)
  • lang-typescript (recommended for your stack)
  • workflow-tdd-strict
  • knowledge-vault

Install with: codi add-on install <name>
```

**1 paso visible al usuario.** Auto-detección de stack → recomendaciones contextuales (opt-in). Si el usuario quiere customizar antes, `codi init --customize` lanza el wizard tipo v3.

### 4.3 Flags CLI para v4

```bash
codi init                                # Base universal, auto-detect stack
codi init --with lang-typescript,framework-nextjs  # Base + add-ons
codi init --customize                    # Wizard tipo v3 (legacy/power-user)
codi init --bare                         # SOLO base mínima sin recomendaciones
```

---

## 5. Migración v3 → v4

### 5.1 Estrategia: layer compatibility

**No hacer breaking change inmediato.** v4 puede coexistir con v3 presets:

| v3 preset | Equivalencia v4 |
|---|---|
| `codi-minimal` | DEPRECATED warning; suggest `codi init --bare` |
| `codi-balanced` | DEPRECATED warning; suggest base default v4 |
| `codi-strict` | DEPRECATED warning; suggest base + workflow-tdd-strict + compliance-soc2 |
| `codi-fullstack` | DEPRECATED warning; suggest base + framework-{lang}-{stack} add-ons |
| `codi-dev` | KEEP (CODI dev workflow, conceptualmente coherente) |
| `codi-power-user` | KEEP (different identity: knowledge/exploration tools) |

Mensaje al user en preset deprecado:
```
[WRN] Preset 'codi-balanced' is deprecated in v4.
[WRN] v4 installs an industry-baseline default directly + add-ons.
[WRN] Run `codi migrate v3-preset-to-v4-base` for guided upgrade.
```

### 5.2 Migración asistida

Nuevo comando `codi migrate v3-preset-to-v4-base`:

1. Detecta qué preset v3 usa el proyecto
2. Compara con base v4 (qué falta, qué sobra)
3. Identifica add-ons equivalentes
4. Genera plan: `migrate-plan.md`
5. User aprueba → ejecuta migración

### 5.3 Roadmap fases

| Fase | Trabajo | Estimación |
|---|---|---|
| **F1 — Define BASE catalogue** | Mover artifacts a `src/templates/base/`; consolidate flags defaults; write CORE_BASE_RULES/SKILLS/AGENTS arrays | 3-5 días |
| **F2 — Implement add-on system** | Add-on registry (similar a preset pero composable); `codi add-on install/remove/list/upgrade` commands | 5-7 días |
| **F3 — Refactor `init.ts`** | Default install = base + auto-detect + opt-in prompt; preserve `--customize` for legacy wizard; tests | 3-5 días |
| **F4 — Migration tooling** | `codi migrate v3-preset-to-v4-base`; deprecation warnings; docs | 2-3 días |
| **F5 — Add-on catalogue seed** | Crear add-ons iniciales (lang-typescript, lang-python, framework-nextjs, knowledge-vault, etc.) | 5-10 días (paralelizable) |
| **F6 — Docs + onboarding** | README new install flow; migration guide v3→v4; add-on catalogue site | 3 días |
| **TOTAL** | | **~3-5 semanas** focal sprint |

---

## 6. Breaking changes + compatibilidad

### 6.1 Breaking changes (v4 mayor)

- `codi init` UX cambia (no más wizard de 10 pasos default)
- `presets/` directory deprecated (codi-dev y codi-power-user permanecen como "legacy presets")
- `CORE_PLATFORM_RULES`/`CORE_PLATFORM_SKILLS` reemplazados por `CORE_BASE_*` (más amplio)
- Algunos flags cambian defaults (`security_scan: true` por default, antes off en minimal)

### 6.2 Compatibilidad backwards

- v3 manifests siguen siendo parseables (compat shim en parser)
- `codi update` detecta v3 install → ofrece migrate
- v3 presets `codi-balanced`/`codi-strict` se ejecutan pero con WARN deprecation
- `codi add` sigue funcionando igual (artifacts individuales)

### 6.3 Lo que NO rompe

- CLI surface principal (`init`, `generate`, `add`, `status`, `verify`, etc.)
- `.codi/` directory layout
- `state.json` schema (no cambia)
- Brain DB schema
- Workflow engine
- Hook system

---

## 7. Open questions (decisiones pendientes)

| # | Pregunta | Opciones |
|---|---|---|
| Q1 | ¿Mantener `codi-dev` y `codi-power-user` como presets o convertirlos también a add-ons? | (a) Mantener como "named bundles of add-ons" (b) Convertir a meta-add-ons (`bundle-dev`, `bundle-power-user`) |
| Q2 | ¿Cómo se llaman los add-ons? `codi add-on install` vs `codi pack install` vs `codi extension install` | UX: `add-on` es claro; `pack` es más corto; `extension` es genérico |
| Q3 | ¿Add-ons vienen built-in o se instalan desde GitHub? | (a) Built-in en `src/templates/addons/` (curated catalogue) (b) GitHub-driven (community-driven) (c) Both |
| Q4 | ¿`codi init` debe auto-instalar add-ons recomendados (sin preguntar) o solo sugerirlos? | (a) Auto-install si auto-detect = high confidence (b) Always ask |
| Q5 | ¿Qué pasa con `flags.yaml` cuando hay add-ons? ¿Cada add-on puede setear flags? | Probablemente sí, con merge semántico (similar a presets actuales) |
| Q6 | ¿Cambio de versión major v3→v4 o feature feature de v3? | Recomendación: **v4 major** porque cambia el contrato UX de init |

---

## 8. Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Breaking change frustra usuarios v3 | Alta | Compat shim + warning + asistente migrate |
| Add-on catalogue inicial pobre vs presets curados | Media | F5 paraleliza creación de 10-15 add-ons antes de release |
| Default base "demasiado opinionado" vs minimal | Media | Mantener `--bare` flag para usuarios que quieren empezar limpio |
| Confusión sobre qué es base vs add-on | Baja | Doc clara + `codi list --base/--addons` separado |
| ROI no claro de migrar v3 → v4 | Baja-Media | Mostrar concretamente el "antes/después" UX en docs |

---

## 9. Síntesis ejecutiva

**Recomiendo aprobar la propuesta con estos puntos clave:**

1. **Eliminar concepto "preset choose-your-own-adventure"** y reemplazar por **"base universal default + add-ons componibles"**.
2. **Base v4 = 10 rules + 8 skills + 3 agents + 15 hooks + sensible flag defaults** que mapean a los 12 baselines de industria 2026.
3. **Add-ons en 8 categorías** (lang/framework/workflow/knowledge/compliance/tone/i18n/tooling) reemplazan la fragmentación de presets.
4. **Migración no-disruptiva** con compat shim + asistente `codi migrate`.
5. **`codi-dev` y `codi-power-user` sobreviven** como bundles legacy (decisión Q1 pendiente).
6. **Roadmap ~3-5 semanas** focal sprint para implementación completa.

**El valor:**
- Tiempo a productividad de equipo nuevo: 10+ decisiones → 0 decisiones
- Consistencia: todos los equipos arrancan con misma baseline (baseline industria)
- Personalización: aditiva, no destructiva (no necesitas elegir BIEN al principio)
- Mantenimiento: 1 base curada + N add-ons independientes vs 6 presets con flags entrelazados

---

## 10. Próximos pasos sugeridos

1. **Revisar esta propuesta** y resolver las 6 open questions
2. **Aprobar o pivotar** la dirección general
3. Si aprobada: crear `[PLAN]_codi-v4-implementation.md` con fases F1-F6 desglosadas + assignments
4. Crear branch `feature/codi-v4-base-architecture`
5. Empezar por F1 (catalogue) + F2 (add-on system) en paralelo (no dependientes)

---

## Apéndice A — Inventario de capellai patterns y su destino v4

| Capellai artifact | v4 destination |
|---|---|
| `agent-capability-discovery` rule | **BASE** (universal pattern) |
| `codi-improvement-dev` rule | **BASE** (rename `codi-improvement`) |
| `codi-typescript` rule | add-on `lang-typescript` |
| `codi-nextjs` rule | add-on `framework-nextjs` |
| `codi-react` rule | add-on `framework-react` |
| `codi-python` rule | add-on `lang-python` |
| `codi-capture-everything` rule | **BASE** (capture markers core to CODI) |
| `codi-spanish-orthography` rule | add-on `i18n-spanish` |
| `codi-contribution-discipline` rule | add-on `workflow-contribution-discipline` |
| `caveman` skill + `output-tone-policy` rule | add-on `tone-caveman` |
| Wiki/Obsidian/canvas skills (15+) | add-on `knowledge-vault` (bundle) |
| `dev-vault-discipline` rule | add-on `knowledge-vault` |
| `v1-sprint-gates` rule | add-on `workflow-sprint-gates` |
| PreToolUse guards (`guard-bash.sh`, `guard-write.sh`) | **BASE** (universal safety) |
| PostToolUse `auto-format.sh` | **BASE** (universal hygiene) |
| `setup-pre-commit` skill | **BASE** (already in CODI; just ensure shipped) |

---

## Apéndice B — Sources de industry research

- ThoughtWorks Tech Radar Vol 34 (Apr 2026) — https://www.thoughtworks.com/en-us/radar
- DORA 2025 State of AI-Assisted Software Development — https://dora.dev/dora-report-2025/
- Anthropic Claude Code Best Practices — https://code.claude.com/docs/en/best-practices
- AGENTS.md open standard — https://agents.md/
- Linux Foundation Agentic AI Foundation (Dec 2025) — https://openai.com/index/agentic-ai-foundation/
- GitGuardian — Local Guardrails for AI Coding — https://blog.gitguardian.com/local-guardrails-for-secrets-security/
- Maxim — Securing Claude Code (PII, audit, SSO) — https://www.getmaxim.ai/articles/securing-claude-code-in-production
