# Docker & Deployment Reference

## docker-compose.yml (Local Development)

```yaml
services:
  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:  # Optional: if using caching/queues
    image: redis:7-alpine
    ports:
      - "6379:6379"

  mailhog:  # Optional: local email testing
    image: mailhog/mailhog
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI

volumes:
  postgres_data:
```

---

## Dockerfile — Multi-Stage Build (Python)

```dockerfile
# ── Builder stage ──
FROM python:3.13-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install Python dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# ── Runtime stage ──
FROM python:3.13-slim

WORKDIR /app

# Install runtime-only dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy virtualenv from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY . .

# Set PATH to use virtualenv
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Key points:**
- Multi-stage separates build deps (gcc) from runtime
- `--frozen` ensures lockfile is used exactly
- `--no-dev` excludes dev dependencies in production
- Health check verifies the app responds

---

## Dockerfile — Node/Frontend (if needed)

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Usually not needed if deploying frontend to Vercel/Netlify/Cloudflare Pages.

---

## Railway Configuration

### railway.toml

```toml
[build]
builder = "dockerfile"
dockerfilePath = "backend/Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

### Deploy Command

```bash
railway up --service <service-name>
```

---

## Vercel Configuration

### vercel.json (SPA)

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Why rewrites:** Single-page apps handle routing client-side. All paths must serve index.html.

### Deploy Command

```bash
npx vercel --prod
```

---

## Health Check Endpoint

Every deployed backend MUST have a health check:

```python
# FastAPI example
@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

Used by: Docker HEALTHCHECK, Railway, load balancers, monitoring.

---

## Deployment Checklist

Before first deploy:

- [ ] Dockerfile builds successfully locally: `docker build -t test .`
- [ ] Container runs: `docker run -p 8000:8000 test`
- [ ] Health check responds: `curl localhost:8000/health`
- [ ] All env vars configured in deploy platform
- [ ] Database connection string set
- [ ] CORS origins include production frontend URL
- [ ] Secrets NOT in image (env vars only)
- [ ] Lockfiles committed (deterministic installs)
