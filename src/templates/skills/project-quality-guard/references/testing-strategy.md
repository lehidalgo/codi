# Testing Strategy Reference

## Minimum Coverage: 80% — NON-NEGOTIABLE

Every project must enforce 80% minimum code coverage. If coverage drops below 80%, the build should fail.

---

## Test Types Required

Every project needs **all four** test types. If a type doesn't apply (e.g., no DB = no integration tests), document why.

| Type | What it tests | Needs DB/Network | Speed | Required |
|------|---------------|-------------------|-------|----------|
| **Unit** | Pure domain logic, utils, calculations | No | Fast | Always |
| **Fixture** | Data consistency, seed data, factories | Depends | Fast-Medium | Always |
| **Smoke** | Deployed endpoints respond correctly | Yes (live server) | Fast | When deployed |
| **Integration** | DB queries, API flows, endpoint chains | Yes (test DB) | Slow | When DB/APIs exist |

---

## 1. Fixture Tests with Synthetic Data

**Every test suite MUST use fixtures with synthetic (factory-generated) data.** Never use production data. Never hardcode test values inline — centralize them in `conftest.py` or factory files.

### Python — conftest.py Fixtures

```python
# tests/conftest.py
import pytest
from uuid import uuid4
from datetime import date, datetime
from decimal import Decimal


# ── Factory Functions ──────────────────────────
def make_user(
    *,
    id: str | None = None,
    email: str = "test@example.com",
    name: str = "Test User",
) -> dict:
    """Factory for user data. Override only what you need."""
    return {
        "id": id or str(uuid4()),
        "email": email,
        "name": name,
        "created_at": datetime.now(),
    }


def make_clinic(
    *,
    id: str | None = None,
    name: str = "Test Clinic",
    goal: float = 3000.0,
    salary: float = 500.0,
    commission_rate: float = 0.3,
) -> dict:
    """Factory for clinic data with financial defaults."""
    return {
        "id": id or str(uuid4()),
        "name": name,
        "goal": goal,
        "salary": salary,
        "commission_rate": commission_rate,
    }


def make_income(
    *,
    clinic_id: str | None = None,
    gross_amount: float = 100.0,
    net_amount: float = 80.0,
    treatment_date: date | None = None,
) -> dict:
    """Factory for income entries."""
    return {
        "clinic_id": clinic_id or str(uuid4()),
        "gross_amount": gross_amount,
        "net_amount": net_amount,
        "treatment_date": treatment_date or date.today(),
    }


# ── Pytest Fixtures ────────────────────────────
@pytest.fixture
def sample_user() -> dict:
    return make_user()


@pytest.fixture
def sample_clinic() -> dict:
    return make_clinic()


@pytest.fixture
def sample_incomes() -> list[dict]:
    """3 months of synthetic income data."""
    return [
        make_income(gross_amount=1000, net_amount=800, treatment_date=date(2026, 1, 15)),
        make_income(gross_amount=1200, net_amount=960, treatment_date=date(2026, 2, 10)),
        make_income(gross_amount=900, net_amount=720, treatment_date=date(2026, 3, 5)),
    ]
```

### TypeScript — Test Factories

```typescript
// src/test/factories.ts

export function makeUser(overrides?: Partial<User>): User {
  return {
    id: crypto.randomUUID(),
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeClinic(overrides?: Partial<Clinic>): Clinic {
  return {
    id: crypto.randomUUID(),
    name: 'Test Clinic',
    goal: 3000,
    salary: 500,
    commissionRate: 0.3,
    ...overrides,
  };
}

export function makeIncome(overrides?: Partial<Income>): Income {
  return {
    id: crypto.randomUUID(),
    clinicId: crypto.randomUUID(),
    grossAmount: 100,
    netAmount: 80,
    treatmentDate: new Date().toISOString().split('T')[0],
    ...overrides,
  };
}
```

### Fixture Rules

- **Factory pattern:** `make_<entity>()` with sensible defaults and keyword overrides
- **Override only what matters:** Each test overrides only the fields relevant to what it's testing
- **No production data:** All values are synthetic. Use realistic but fake values.
- **Centralized:** Factories in `conftest.py` (Python) or `src/test/factories.ts` (TS)
- **Composable:** Factories can reference each other for related data

---

## 2. Unit Tests

Test pure domain logic. No DB, no network, no external services.

### What to Unit Test

- Domain calculations (IRPF, projections, commissions)
- Utility functions (date helpers, formatters, validators)
- Schema validation (Pydantic models, Zod schemas)
- State transformations (reducers, mappers)
- Business rules (rule resolution, eligibility checks)

### Python Example

```python
# tests/unit/test_calculations.py
import pytest

@pytest.mark.unit
class TestIRPFCalculation:
    def test_zero_base_returns_zero_tax(self):
        result = calculate_irpf(taxable_base=0)
        assert result.tax_due == 0
        assert result.effective_rate == 0

    def test_known_bracket_amount(self):
        result = calculate_irpf(taxable_base=30000)
        assert result.tax_due > 0
        assert 0 < result.effective_rate < 1

    def test_negative_base_raises(self):
        with pytest.raises(ValueError):
            calculate_irpf(taxable_base=-100)
```

### TypeScript Example

```typescript
// src/utils/format.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate } from './format';

describe('formatCurrency', () => {
  it('formats positive amounts with euro symbol', () => {
    expect(formatCurrency(1234.56)).toBe('1.234,56 €');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('0,00 €');
  });
});
```

### Unit Test Markers

```python
# pyproject.toml
[tool.pytest.ini_options]
markers = [
    "unit: Unit tests — no DB, no network, fast",
    "integration: Integration tests — needs DB",
    "fixture: Fixture/seed data validation",
    "smoke: Smoke tests — hits live endpoints",
]
```

---

## 3. Smoke Tests

Verify that deployed/running services respond correctly. Lightweight — just check health, basic endpoints, and response shapes.

### Python Smoke Tests

```python
# tests/smoke/test_api_health.py
import pytest
import httpx

BASE_URL = "http://localhost:8000"

@pytest.mark.smoke
class TestSmoke:
    def test_health_endpoint(self):
        r = httpx.get(f"{BASE_URL}/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_docs_accessible(self):
        r = httpx.get(f"{BASE_URL}/docs")
        assert r.status_code == 200

    def test_api_requires_auth(self):
        r = httpx.get(f"{BASE_URL}/api/v1/clinics")
        assert r.status_code in (401, 403)
```

### TypeScript Smoke Tests (Frontend)

```typescript
// src/App.smoke.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App smoke', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeTruthy();
  });
});
```

### Smoke Test Rules

- Fast — each test < 5 seconds
- No setup/teardown of data — test against existing state
- Check: status codes, response shapes, basic content
- Don't check: specific data values (those are integration/unit tests)
- Run after deploy to verify the service is alive

---

## 4. Integration Tests

Test real DB queries, API endpoint flows, and external service interactions.

### Python Integration Tests

```python
# tests/integration/test_clinics_api.py
import pytest
from httpx import AsyncClient

@pytest.mark.integration
class TestClinicsAPI:
    async def test_create_and_list_clinics(
        self, async_client: AsyncClient, sample_user: dict
    ):
        # Create
        response = await async_client.post(
            "/api/v1/clinics",
            json={"name": "Integration Test Clinic", "goal": 5000},
        )
        assert response.status_code == 201
        clinic_id = response.json()["id"]

        # List
        response = await async_client.get("/api/v1/clinics")
        assert response.status_code == 200
        clinics = response.json()
        assert any(c["id"] == clinic_id for c in clinics)

    async def test_soft_delete_excludes_from_list(
        self, async_client: AsyncClient, sample_clinic: dict
    ):
        # Delete
        await async_client.delete(f"/api/v1/clinics/{sample_clinic['id']}")

        # Verify excluded
        response = await async_client.get("/api/v1/clinics")
        clinics = response.json()
        assert not any(c["id"] == sample_clinic["id"] for c in clinics)
```

### Integration Test Infrastructure

```python
# tests/integration/conftest.py
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

@pytest.fixture(scope="session")
def db_engine():
    """Real PostgreSQL for integration tests."""
    engine = create_async_engine(
        "postgresql+asyncpg://test:test@localhost:5432/test_db"
    )
    yield engine

@pytest.fixture(autouse=True)
async def clean_db(db_session: AsyncSession):
    """Rollback after each test — clean state."""
    yield
    await db_session.rollback()
```

### Integration Test Rules

- Use a **real test database** (PostgreSQL, not SQLite for PG-specific features)
- **Rollback after each test** — tests must not pollute each other
- **Synthetic data via fixtures** — use factory functions, not production dumps
- Run in CI with a service container (PostgreSQL in GitHub Actions)
- Slower than unit tests — run separately with marker: `pytest -m integration`

---

## Coverage Configuration

### Python (pyproject.toml)

```toml
[tool.coverage.run]
source = ["app"]
omit = [
    "app/main.py",          # Entry point / event loop setup
    "app/**/webhooks.py",   # External webhook handlers
    "app/infrastructure/database/session.py",  # DB session setup
]

[tool.coverage.report]
fail_under = 80
show_missing = true
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "if __name__ == .__main__.",
]
```

### TypeScript (vite.config.ts)

```typescript
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'text-summary'],
    thresholds: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
    exclude: [
      'src/test/**',
      'src/main.tsx',
      'src/vite-env.d.ts',
    ],
  },
},
```

### Coverage Commands

```bash
# Python
pytest --cov=app --cov-report=term-missing --cov-fail-under=80

# TypeScript
npx vitest run --coverage
```

---

## Test Directory Structure

### Python

```
tests/
  conftest.py              # Shared fixtures + factory functions
  unit/
    conftest.py            # Unit-specific fixtures (mocks)
    test_calculations.py
    test_domain_logic.py
    test_utils.py
  integration/
    conftest.py            # DB engine, async client, clean_db
    test_clinics_api.py
    test_income_queries.py
  smoke/
    test_api_health.py
  fixtures/
    test_seed_data.py      # Validate seed data integrity
```

### TypeScript

```
src/
  test/
    setup.ts               # Testing library setup
    factories.ts            # Factory functions for synthetic data
  components/
    Button.tsx
    Button.test.tsx         # Co-located with component
  utils/
    format.ts
    format.test.ts          # Co-located with util
  hooks/
    useClinic.ts
    useClinic.test.ts       # Co-located with hook
```

---

## Audit Checklist for Testing

When auditing a project's test infrastructure, check:

- [ ] **Coverage config exists** with `fail_under = 80` (or `thresholds: 80`)
- [ ] **conftest.py / factories.ts exists** with factory functions for main entities
- [ ] **Unit test directory** exists with tests for domain logic
- [ ] **Smoke test** exists (at minimum: health endpoint check)
- [ ] **Integration test directory** exists (if project uses DB)
- [ ] **Pytest markers** defined (unit, integration, fixture, smoke)
- [ ] **CI runs tests** — unit tests required, integration tests if DB available
- [ ] **Pre-commit runs unit tests** — fast feedback before commit
- [ ] **No production data** in test fixtures — all synthetic
- [ ] **Tests are isolated** — each test cleans up after itself (rollback/cleanup)
- [ ] **Non-code artifacts validated** — YAML, JSON, Terraform, Dockerfiles, etc.

---

## Multi-Ecosystem Testing

**The universal rule: if the project has code or config in ANY language/framework, that code MUST have tests and validation.** This is not limited to Python and TypeScript.

### Detection → Testing Matrix

When auditing, detect the ecosystem and enforce the corresponding test strategy:

| Detected By | Ecosystem | Required Testing | Tool |
|-------------|-----------|-----------------|------|
| `*.tf` files | **Terraform** | `terraform validate` + `terraform test` + `tflint` | terraform, tflint |
| `*.yaml`/`*.yml` (non-CI) | **YAML configs** | Schema validation + syntax check | yamllint, yq |
| `*.json` (configs/schemas) | **JSON configs** | Schema validation + syntax check | jsonlint, ajv |
| `dags/` or `airflow.cfg` | **Airflow** | DAG load test + task unit tests | pytest + airflow |
| `*.go` files | **Go** | `go test ./...` + `go vet` + coverage | go test |
| `*.rs` + `Cargo.toml` | **Rust** | `cargo test` + `cargo clippy` | cargo |
| `*.java` + `pom.xml` | **Java/Maven** | `mvn test` + JaCoCo coverage | maven |
| `*.java` + `build.gradle` | **Java/Gradle** | `gradle test` + JaCoCo | gradle |
| `*.rb` + `Gemfile` | **Ruby** | `bundle exec rspec` + SimpleCov | rspec |
| `*.sh` scripts | **Shell** | `shellcheck` + bats tests | shellcheck, bats |
| `Dockerfile` | **Docker** | `hadolint` + build test | hadolint |
| `docker-compose*.yml` | **Docker Compose** | `docker-compose config` (validate) | docker-compose |
| `helm/` or `Chart.yaml` | **Helm** | `helm lint` + `helm template` test | helm |
| `k8s/` or `*.k8s.yaml` | **Kubernetes** | `kubeval` / `kubeconform` validation | kubeval |
| `*.proto` | **Protobuf** | `buf lint` + `buf breaking` | buf |
| `*.sql` migrations | **SQL** | Migration up/down test + rollback | alembic, flyway |
| `*.graphql` | **GraphQL** | Schema validation + query tests | graphql-inspector |
| `ansible/` or `playbook*.yml` | **Ansible** | `ansible-lint` + molecule tests | ansible-lint |
| `Pulumi.yaml` | **Pulumi** | `pulumi preview` + unit tests | pulumi |

### Terraform Testing

```bash
# Validation (always run)
terraform init -backend=false
terraform validate
terraform fmt -check

# Linting
tflint --init
tflint

# Native tests (Terraform 1.6+)
terraform test

# Pre-commit hook
- repo: https://github.com/antonbabenko/pre-commit-terraform
  hooks:
    - id: terraform_validate
    - id: terraform_fmt
    - id: terraform_tflint
```

### YAML Validation

```bash
# Syntax check all YAML files
yamllint -d "{extends: default, rules: {line-length: {max: 150}}}" .

# Validate against schema (if schema exists)
yq eval '.' file.yaml > /dev/null  # Parse check

# Pre-commit hook
- repo: https://github.com/adrienverge/yamllint
  hooks:
    - id: yamllint
      args: [-d, "{extends: default, rules: {line-length: {max: 150}}}"]
```

### JSON Validation

```bash
# Syntax check
python -m json.tool file.json > /dev/null
# or
npx jsonlint file.json

# Schema validation (if JSON Schema exists)
npx ajv validate -s schema.json -d data.json

# Pre-commit hook
- repo: https://github.com/pre-commit/pre-commit-hooks
  hooks:
    - id: check-json
    - id: pretty-format-json
      args: [--autofix]
```

### Airflow DAG Testing

```python
# tests/test_dags.py
import pytest
from airflow.models import DagBag

@pytest.fixture(scope="session")
def dag_bag():
    return DagBag(dag_folder="dags/", include_examples=False)

class TestDAGs:
    def test_no_import_errors(self, dag_bag):
        """All DAGs must load without import errors."""
        assert len(dag_bag.import_errors) == 0, \
            f"DAG import errors: {dag_bag.import_errors}"

    def test_all_dags_have_tags(self, dag_bag):
        """All DAGs must have at least one tag."""
        for dag_id, dag in dag_bag.dags.items():
            assert dag.tags, f"DAG {dag_id} has no tags"

    def test_no_cycles(self, dag_bag):
        """No DAG should have circular dependencies."""
        for dag_id, dag in dag_bag.dags.items():
            assert not dag.test_cycle(), f"DAG {dag_id} has a cycle"
```

### Shell Script Testing

```bash
# Linting (always)
shellcheck scripts/*.sh

# Unit tests with bats
# tests/test_script.bats
@test "backup script creates output file" {
    run ./scripts/backup.sh --dry-run
    [ "$status" -eq 0 ]
    [[ "$output" == *"backup complete"* ]]
}

# Pre-commit hook
- repo: https://github.com/shellcheck-py/shellcheck-py
  hooks:
    - id: shellcheck
```

### Dockerfile Linting

```bash
# Lint Dockerfiles
hadolint Dockerfile
hadolint backend/Dockerfile

# Pre-commit hook
- repo: https://github.com/hadolint/hadolint
  hooks:
    - id: hadolint
```

### Go Testing

```bash
go test ./... -v -race -coverprofile=coverage.out
go tool cover -func=coverage.out  # Check coverage
go vet ./...                       # Static analysis
golangci-lint run                  # Comprehensive linting
```

### Rust Testing

```bash
cargo test                         # Run all tests
cargo clippy -- -D warnings        # Linting (treat warnings as errors)
cargo tarpaulin --out Html         # Coverage report
```

---

## Universal Testing Principle

**If code or config exists in the project, it MUST be tested or validated.** The audit should:

1. **Detect** every ecosystem present (scan for file extensions, config files)
2. **Check** if the corresponding test/validation tooling is configured
3. **Warn** if testing is missing for any detected ecosystem
4. **Ask** if the user wants to set it up

This applies even to ecosystems not listed above. If the project has `.lua` files, there should be lua tests. If it has `.dart` files, there should be dart tests. The principle is universal — the specific tools change per ecosystem.
