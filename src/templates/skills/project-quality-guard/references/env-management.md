# Environment Management Reference

## The .env Pattern

```
.env              ← Real secrets (GITIGNORED — never committed)
.env.example      ← Placeholder documentation (committed — shows required vars)
.env.local        ← Frontend secrets (GITIGNORED)
.env.local.example← Frontend placeholder docs (committed)
config.py         ← Defaults: empty strings "" or safe local values
```

**NON-NEGOTIABLE:** `.env` and `.env.local` must be in `.gitignore`. No exceptions.

---

## Backend .env.example Template

```bash
# ── Database ──
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_dev

# ── Authentication ──
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx

# ── Email ──
RESEND_API_KEY=re_xxx
# SMTP fallback (optional)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=

# ── Storage ──
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# ── App Config ──
ENVIRONMENT=development
CORS_ORIGINS=["http://localhost:5173"]
```

**Rules:**
- Placeholder values use `xxx` or descriptive format hints
- Local-dev safe values OK (localhost DB URL)
- NEVER include real credentials, even for dev services
- Group by feature/service with comments

---

## Frontend .env.local.example Template

```bash
# ── Authentication ──
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx

# ── API ──
VITE_API_URL=http://localhost:8000

# ── Storage (public) ──
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=xxx
```

**CRITICAL: The VITE_ prefix rule:**
- Only `VITE_` prefixed vars are exposed to the frontend bundle
- NEVER put secrets (API keys, DB URLs) with `VITE_` prefix
- `VITE_` vars are public — visible in browser source code

---

## Python Config Pattern (Pydantic Settings)

```python
# app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Defaults are empty or safe local values
    database_url: str = ""
    clerk_secret_key: str = ""
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()
```

**Rules:**
- Defaults must be `""` for secrets — never real values
- Defaults can be safe local values for non-secrets (localhost URLs)
- Use `model_config` to specify `.env` file location

---

## Checking .env Coverage

When auditing, verify:

1. **Every var in .env.example exists in config.py/Settings** — no undocumented vars
2. **Every required var in Settings has no default** — forces explicit configuration
3. **No real secrets in .env.example** — only placeholders
4. **Both .env and .env.local in .gitignore** — verified by audit script
5. **Frontend vars with VITE_ are public-safe** — no secrets exposed

---

## New Developer Setup

After cloning, developers must:

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with real credentials

# Frontend
cp frontend/.env.local.example frontend/.env.local
# Edit frontend/.env.local with real credentials
```

Document this in README Quick Start section.
