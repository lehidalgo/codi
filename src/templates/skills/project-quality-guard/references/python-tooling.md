# Python Tooling Reference

## uv — Package Manager

10-100x faster than pip. Deterministic lockfile. Drop-in replacement.

```bash
uv sync                  # Install deps from lockfile
uv add <package>         # Add dependency
uv add --dev <package>   # Add dev dependency
uv run <command>         # Run in virtualenv
uv lock                  # Update lockfile
```

**Rules:**
- Always `uv run` to execute scripts (never bare `python`)
- Always commit `uv.lock` to git
- In CI/Docker: `uv sync --frozen` (install from lock, fail if outdated)

---

## Ruff — Linter + Formatter

Replaces: flake8, isort, pycodestyle, pyflakes, black, pyupgrade.

### pyproject.toml Config

```toml
[tool.ruff]
target-version = "py313"     # Match your Python version
line-length = 100

[tool.ruff.lint]
select = [
  "E",   # pycodestyle errors
  "F",   # pyflakes (unused imports, undefined vars)
  "I",   # isort (import ordering)
  "N",   # PEP 8 naming conventions
  "UP",  # pyupgrade (modern syntax)
  "B",   # flake8-bugbear (common bugs)
  "SIM", # flake8-simplify (simplifications)
]
ignore = [
  "E501",  # line too long (SQLAlchemy/FastAPI generate long lines)
]

[tool.ruff.lint.per-file-ignores]
"app/main.py" = ["E402"]  # imports after sys.path setup
"tests/**" = ["S101"]     # assert allowed in tests

[tool.ruff.lint.isort]
known-first-party = ["app"]
```

### Commands

```bash
ruff check app/        # Lint
ruff format app/       # Format
ruff check --fix app/  # Auto-fix (~60% of issues)
```

---

## mypy — Type Checking

### pyproject.toml Config

```toml
[tool.mypy]
python_version = "3.13"   # Match your Python version
strict = true              # All strict checks enabled
plugins = ["sqlalchemy.ext.mypy.plugin"]  # If using SQLAlchemy

# Exclude auto-generated or utility code
exclude = ["alembic/", "scripts/"]

# Per-package overrides for missing stubs
[[tool.mypy.overrides]]
module = ["some_untyped_library.*"]
ignore_missing_imports = true
```

**`strict = true` enables:**
- `disallow_untyped_defs` — all functions need type hints
- `disallow_any_generics` — no bare `List`, must be `list[str]`
- `warn_return_any` — warns on returning `Any`
- `check_untyped_defs` — checks function bodies even without hints

### Silencing Errors

```python
# Specific error code (preferred):
value: int = some_call()  # type: ignore[assignment]

# NEVER use blanket ignore:
value = some_call()  # type: ignore  # ← BAD
```

---

## pytest — Testing

### pyproject.toml Config

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
markers = [
  "unit: Unit tests (no DB needed)",
  "integration: Integration tests (needs DB)",
]
asyncio_mode = "auto"  # If using pytest-asyncio
filterwarnings = ["ignore::DeprecationWarning"]

[tool.coverage.run]
source = ["app"]
omit = [
  "app/main.py",
  "app/**/webhooks.py",
]

[tool.coverage.report]
fail_under = 80
show_missing = true
```

### Commands

```bash
pytest tests/unit -m unit -x -q              # Unit tests, stop on first fail
pytest tests/integration -m integration       # Integration tests
pytest --cov=app --cov-report=term-missing   # With coverage
```

### Test Organization

```
tests/
  unit/           # No DB, no network — fast
    test_domain.py
    test_utils.py
  integration/    # Needs DB — slower
    test_api.py
    test_queries.py
  conftest.py     # Shared fixtures
```

---

## Alembic — Database Migrations

```bash
alembic revision --autogenerate -m "add users table"  # Create migration
alembic upgrade head                                   # Apply all
alembic downgrade -1                                   # Revert last
alembic history                                        # View history
```

**Rules:**
- Never edit migrations already applied in production
- Always review auto-generated migrations before applying
- Test migrations with `upgrade head` then `downgrade -1` then `upgrade head`

---

## Makefile — Command Shortcuts

```makefile
.PHONY: install dev lint type-check test test-unit test-integration migrate seed

install:
	uv sync

dev:
	docker-compose up -d db
	uv run uvicorn app.main:app --reload --port 8000

lint:
	uv run ruff check app/
	uv run ruff format --check app/

type-check:
	uv run mypy app

test-unit:
	uv run pytest tests/unit -m unit -x -q

test-integration:
	uv run pytest tests/integration -m integration

test: test-unit test-integration

migrate:
	uv run alembic upgrade head

seed:
	uv run python scripts/seed_data.py
```
