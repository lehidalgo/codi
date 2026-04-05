# CI/CD Pipelines Reference

## GitHub Actions — CI Pipeline

Must mirror local pre-commit checks. If it passes locally, it MUST pass in CI.

### Full-Stack CI (.github/workflows/ci.yml)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4

      - name: Set up Python
        run: uv python install 3.13

      - name: Install dependencies
        run: uv sync --frozen

      - name: Ruff check (lint)
        run: uv run ruff check app/

      - name: Ruff format (verify)
        run: uv run ruff format --check app/

      - name: Mypy (type check)
        run: uv run mypy app

      - name: Alembic migrate
        run: uv run alembic upgrade head
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

      - name: Pytest (unit)
        run: uv run pytest tests/unit -m unit -x -q

      - name: Pytest (integration)
        run: uv run pytest tests/integration -m integration -x -q
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: ESLint
        run: npm run lint

      - name: Prettier check
        run: npm run format:check

      - name: Vitest
        run: npm test
```

### Python-Only CI

Remove the `frontend` job from above.

### Node-Only CI

Remove the `backend` job and postgres service from above.

---

## Deploy Pipeline (.github/workflows/deploy.yml)

```yaml
name: Deploy

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
  workflow_dispatch:  # Manual trigger

jobs:
  deploy-backend:
    if: ${{ github.event.workflow_run.conclusion == 'success' || github.event_name == 'workflow_dispatch' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Option A: Railway
      - name: Deploy to Railway
        run: railway up --service backend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

      # Option B: Docker + custom host
      # - name: Build and push Docker image
      #   run: |
      #     docker build -t myapp-backend ./backend
      #     docker push registry.example.com/myapp-backend:latest

  deploy-frontend:
    if: ${{ github.event.workflow_run.conclusion == 'success' || github.event_name == 'workflow_dispatch' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Option A: Vercel
      - name: Deploy to Vercel
        run: npx vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: frontend

      # Option B: Netlify, Cloudflare Pages, etc.
```

---

## Pipeline Continuity Checklist

Verify these match between local and CI:

| Check | Local (pre-commit) | CI (GitHub Actions) |
|-------|-------------------|---------------------|
| Line endings | mixed-line-ending hook | .gitattributes (auto) |
| Secrets | gitleaks hook | (optional: gitleaks action) |
| Python lint | ruff check | ruff check (same config) |
| Python format | ruff format --check | ruff format --check |
| Python types | mypy | mypy (same config) |
| Python tests | pytest unit | pytest unit + integration |
| TS lint | eslint | eslint |
| TS format | prettier --check | prettier --check |
| TS types | tsc --noEmit | tsc --noEmit |
| TS tests | vitest run | vitest run |

**Gap detection:** If a tool runs locally but not in CI (or vice versa), that's a pipeline gap. Fix it.

---

## Dependabot (.github/dependabot.yml)

```yaml
version: 2
updates:
  # Python dependencies
  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "weekly"
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]

  # npm dependencies
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"

  # GitHub Actions versions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

**Why:** Stale dependencies are a top source of vulnerabilities. Dependabot opens PRs automatically when updates are available.

---

## Pre-commit Autoupdate Workflow

Dependabot doesn't cover pre-commit hook versions. Use a dedicated workflow to keep them current.

See `[[/references/pre-commit-hooks.md]]` → "Automated Weekly Autoupdate" section for the full workflow template.

**Key points:**
- Runs weekly (Tuesday cron) + manual dispatch
- Bumps `rev:` in `.pre-commit-config.yaml` via `pre-commit autoupdate`
- Opens a PR (not auto-merge) — hook updates can introduce stricter rules
- Uses `peter-evans/create-pull-request@v7`
