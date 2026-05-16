# Codi — Team workflow model (validated via grilling)

- **Date**: 2026-05-09 19:55
- **Document**: 20260509*195526*[PLAN]\_codi-team-workflow-model.md
- **Category**: PLAN

> Outcome of grilling session on 2026-05-09. Defines the canonical model for Codi as a team-collaboration tool for squads of 2–8 devs working with coding agents. Anchors all subsequent implementation work.

---

## 1. Decision tree (closed)

| #   | Decisión                       | Resultado                                                                                |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| 1   | Target                         | Squad 2–8 devs                                                                           |
| 2   | Propagación de standards       | Repo + git remote arbitrario                                                             |
| 3   | Dolor #1 a resolver            | Drift + onboarding                                                                       |
| 4   | Postura ante drift             | Warn local + opt-in CI gate                                                              |
| 5   | Qué es un preset               | Bundle de `.codi/` (rules + skills + agents + workflows + hooks + mcp + flags)           |
| 6   | Granularidad de override local | Edit directo + git-merge nativo en conflict                                              |
| 7   | Versionado del git source      | Tag semver + lockfile (patrón npm/Cargo)                                                 |
| 8   | Onboarding del dev nuevo       | TODO committed; `git clone && claude` funciona al instante                               |
| 9   | Concepto "hub"                 | NO existe como entidad. Es cualquier git repo que el equipo elija como fuente de presets |

---

## 2. Modelo canónico

### 2.1 Tres niveles de Codi

```
┌─────────────────────────────────────────────────────────┐
│  src/templates/  ← defaults built-in de la lib Codi     │
└─────────────────────────────────────────────────────────┘
              │ codi init / codi update --from-source
              ▼
┌─────────────────────────────────────────────────────────┐
│  .codi/         ← source-of-truth del proyecto          │
│                  (committed al repo)                    │
└─────────────────────────────────────────────────────────┘
              │ codi generate (idempotente)
              ▼
┌─────────────────────────────────────────────────────────┐
│  .claude/, .codex/, .cursor/, ...                       │
│                ← traducción al lenguaje de cada agente  │
│                  (también committed)                    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Fuentes de inicialización de `.codi/`

- Defaults built-in (`balanced`, `strict`, `fullstack`, etc.)
- Cualquier git repo que el equipo elija (la cosa que llamábamos "hub" es solo esto)

### 2.3 Reglas de oro

1. `.codi/` siempre vive en el repo, committed.
2. `.claude/`, `.codex/` también committed → dev nuevo no necesita correr `codi generate`.
3. `codi generate` es idempotente — cualquier dev lo corre cuando edita `.codi/`.
4. El "hub" es solo un git repo. Sin comandos especiales, sin magia.
5. Customización para 1 proyecto → edit directo en `.codi/` del repo.
6. Customización para todos los proyectos del squad → PR al git repo de presets.
7. Conflicts en update → `git mergetool` nativo (cero tooling propietario).

---

## 3. Flow real del equipo

### Setup inicial (1 vez por repo, tech lead)

```bash
codi init
# wizard pregunta: ¿default Codi, preset built-in, o git repo?
# si git repo: input "github:acme/codi-presets@v1.2.0"
# genera .codi/codi.yaml con `extends:` + .codi/codi.lock con SHA
# genera .codi/, .claude/, .codex/ — todo committed al primer commit
```

### Día a día (cualquier dev)

```bash
git pull
codi generate    # solo si .codi/ cambió en el pull
# Listo. Agentes leen .claude/.codex/ actualizados.
```

### Actualizar desde el git repo de presets (cualquier dev)

```bash
codi update --from-source
# lee `extends:` del .codi/codi.yaml
# clona el repo, baja al @vX.Y.Z declarado o pregunta si bumpear
# resuelve conflicts (git mergetool si hay overrides locales)
# regenera .claude/.codex/
# resultado: archivos modificados → git commit + push
# resto del equipo: git pull + codi generate
```

### Customización local (cualquier dev)

```bash
vim .codi/rules/security.md
codi generate
git commit -am "chore: customize security rule for this repo"
# cambio queda local al repo. Marcado `managed_by: user` en manifest.
```

### Promover al repo de presets (cualquier dev)

```bash
codi contribute --to-source
# wizard selecciona qué artifacts customizados promover
# abre PR contra el git repo declarado en `extends:`
# cuando el PR mergea + se libera v1.3.0 → demás repos pueden bumpear
```

---

## 4. Decisión repo vs git source de presets

| Caso                             | Dónde editar                       | Por qué                                        |
| -------------------------------- | ---------------------------------- | ---------------------------------------------- |
| Customización para ESTE proyecto | `.codi/` del repo                  | No tiene sentido subirlo al git source         |
| Standard transversal del squad   | PR al git source                   | Reutilización justifica la promoción           |
| Experimento previo a adoptarlo   | Repo primero, después PR al source | Validar antes de propagar                      |
| Fix urgente que afecta a 1 repo  | Repo                               | Velocidad                                      |
| Squad con 1–2 repos              | Solo repo, sin git source          | Mantener un git source para 1 repo es overhead |
| Squad con 3+ repos similares     | Repo + git source                  | Cambio en source propaga a N                   |

---

## 5. Gap: lo que existe vs lo que falta construir

### Ya implementado en el código

| Capacidad                     | Archivo                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Pull desde git repo           | `src/cli/preset-github.ts` → `installFromGithub`                                        |
| Lockfile read/write           | `src/core/preset/preset-registry.ts` → `readLockFile`/`writeLockFile`                   |
| Conflict resolver             | `src/cli/update.ts` → `resolveConflicts` con `keep-current\|keep-incoming\|interactive` |
| PR upstream                   | `src/cli/contribute.ts` → `contributeHandler` con `gh CLI`                              |
| Flags merge respetando locked | `src/cli/preset-github.ts` → `mergePresetFlagsFromGithub`                               |
| Wizard `codi init`            | `src/cli/init-wizard.ts`                                                                |
| Adapters por agente           | `src/adapters/` (claude-code, codex, cursor, cline, copilot, windsurf)                  |

### Faltante o incompleto

| Capacidad                                                                               | Naturaleza      | Prioridad |
| --------------------------------------------------------------------------------------- | --------------- | --------- |
| Sintaxis declarativa estable `extends:` en `.codi/codi.yaml`                            | Estandarización | T1        |
| Comando alias `codi update --from-source` que envuelva `installFromGithub` con UX clara | UX/naming       | T1        |
| Comando alias `codi contribute --to-source` (renaming de `--to-hub`)                    | UX/naming       | T1        |
| Wizard `codi init` con opción "extends desde git repo" como primera pregunta visible    | UX              | T1        |
| Documentación clara: "el hub es cualquier git repo"                                     | Docs            | T1        |
| `codi audit --source` — drift entre `.codi/`, lockfile y último tag remoto              | Feature nueva   | T1        |
| Modo `--git-mergetool` en conflict resolver                                             | Feature pequeña | T2        |
| GitHub Action template para CI weekly opt-in                                            | Plantilla       | T2        |
| Notificación en issue tracker cuando hay updates                                        | Feature media   | T2        |

---

## 6. 3 acciones T1 (próximas 4 semanas)

### Acción 1 — Estandarizar `extends:` + alias de comandos (esfuerzo: bajo)

- Sintaxis canónica en `.codi/codi.yaml`:
  ```yaml
  name: acme-mobile
  extends: github:acme/codi-presets@v1.2.0
  ```
- Aliases CLI:
  - `codi update --from-source` → wrapper de `installFromGithub` que lee `extends:` automáticamente
  - `codi contribute --to-source` → renaming de `--to-hub` para alinear lenguaje
- Documentación en README: "El git source es cualquier repo git que el equipo adopte"

### Acción 2 — Wizard `codi init` con opción git source (esfuerzo: bajo)

- Primera pregunta del wizard: ¿qué fuente de presets?
  - Default Codi (built-in `balanced`)
  - Preset built-in (selector entre `minimal`, `strict`, `fullstack`, etc.)
  - Git repo (input `github:org/repo@vX.Y.Z` con autocomplete de tags)
- Cuando se elige git repo: guardar `extends:` en `.codi/codi.yaml` + crear lockfile

### Acción 3 — `codi audit --source` (esfuerzo: medio)

- Lee `extends:` y `.codi/codi.lock`
- Compara contra último tag del git source (via `git ls-remote --tags`)
- Output simple tipo `git status`:
  ```
  Source:       acme/codi-presets@v1.2.0
  Lock SHA:     a1b2c3d
  Latest tag:   v1.3.0  ← updates available
  Local edits:  2 artifacts (managed_by: user)
                - rules/security.md
                - skills/deploy.md
  Drift:        warn (severity: minor — bump available, no overrides conflict)
  ```
- Sin enforcing — solo informativo. Exit 0 siempre.

---

## 7. Lo que NO se construye (anti-features)

- Comando `codi hub init` o concepto especial "hub" → no existe
- Marketplace cerrado de presets → no necesario, GitHub repos públicos es suficiente
- Pre-commit hook que bloquee drift `.codi/`↔`.claude/` → no es drift real, `codi generate` resuelve trivial
- Notificaciones invasivas en cada `codi <cmd>` → fatiga de notificaciones
- Resolver multi-hub jerárquico org→squad→repo → over-engineering para squad 2–8
- Agente propio del equipo en hub git → vendor lock-in, mantener Codi agnóstico

---

## 8. Métricas de éxito (para validar el modelo en 3 meses)

- ≥3 squads externos adoptando Codi con git repo de presets compartido
- Tiempo medio de onboarding de dev nuevo en repo Codi-managed: <15 min
- Tasa de updates desde git source aplicados sin conflictos: >70%
- Issues abiertos por confusión sobre "qué es el hub" → 0 (porque no existe)
- Friction reportada en encuesta de squad: ≤2/5

---

## 9. Próximo paso operativo

Validar las 3 acciones T1 contra restricciones reales (capacidad de equipo, dependencias técnicas) y desglosar Acción 1 en tasks atómicas siguiendo el workflow `feature` de Codi.
