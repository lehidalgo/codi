#!/usr/bin/env bash
# Project Quality Guard — Audit Script
# Usage: bash audit-project.sh [project-root]
# Checks for quality infrastructure and reports status.

set -euo pipefail

PROJECT_ROOT="${1:-.}"
cd "$PROJECT_ROOT"

PASS=0
WARN=0
TOTAL=0

check() {
  local label="$1"
  local path="$2"
  local impact="$3"
  TOTAL=$((TOTAL + 1))
  if [ -e "$path" ]; then
    echo "OK: $label — $path exists"
    PASS=$((PASS + 1))
  else
    echo "WARNING: $label MISSING — $impact"
    WARN=$((WARN + 1))
  fi
}

check_any() {
  local label="$1"
  local impact="$2"
  shift 2
  TOTAL=$((TOTAL + 1))
  for path in "$@"; do
    if [ -e "$path" ]; then
      echo "OK: $label — $path exists"
      PASS=$((PASS + 1))
      return
    fi
  done
  echo "WARNING: $label MISSING — $impact"
  WARN=$((WARN + 1))
}

check_content() {
  local label="$1"
  local path="$2"
  local pattern="$3"
  local impact="$4"
  TOTAL=$((TOTAL + 1))
  if [ -e "$path" ] && grep -q "$pattern" "$path" 2>/dev/null; then
    echo "OK: $label — pattern found in $path"
    PASS=$((PASS + 1))
  elif [ -e "$path" ]; then
    echo "WARNING: $label INCOMPLETE — $path exists but $impact"
    WARN=$((WARN + 1))
  else
    echo "WARNING: $label MISSING — $path not found. $impact"
    WARN=$((WARN + 1))
  fi
}

echo "============================================"
echo "  Project Quality Guard — Audit Report"
echo "  Project: $(basename "$(pwd)")"
echo "  Date: $(date +%Y-%m-%d)"
echo "============================================"
echo ""

# ── 1. Git Config ──────────────────────────────
echo "── 1. Git Configuration ──"
check ".gitignore" ".gitignore" "No files excluded from git. node_modules, .env, __pycache__ may be committed."
check ".gitattributes" ".gitattributes" "Line endings not normalized. Cross-OS diffs will have phantom CRLF changes."
check ".editorconfig" ".editorconfig" "No editor-agnostic formatting. Indentation will vary across editors."
echo ""

# ── 2. Security Scanning ──────────────────────
echo "── 2. Security Scanning ──"
check_any "Gitleaks config" "No secrets scanning config. API keys and passwords may leak into git." \
  ".gitleaks.toml" ".gitleaks.yaml"
# Check for bandit in Python projects
if [ -e "pyproject.toml" ] || [ -d "backend" ]; then
  check_any "Bandit config" "No Python security linting. SQL injection, eval(), and other vulns unchecked." \
    ".bandit.yaml" ".bandit" "backend/.bandit.yaml" "backend/.bandit"
fi
echo ""

# ── 3. Pre-commit Hooks ───────────────────────
echo "── 3. Pre-commit Hooks ──"
check_any "Pre-commit config" "No pre-commit hooks configured. No automated quality gate before commits." \
  ".pre-commit-config.yaml" ".pre-commit-config.yml"

# Check if hooks are installed
if [ -d ".git/hooks" ]; then
  if [ -e ".git/hooks/pre-commit" ] && grep -q "pre-commit" ".git/hooks/pre-commit" 2>/dev/null; then
    echo "OK: Pre-commit hooks installed in .git/hooks"
    PASS=$((PASS + 1))
  else
    echo "WARNING: Pre-commit hooks NOT installed — Run 'pre-commit install' to activate hooks"
    WARN=$((WARN + 1))
  fi
  TOTAL=$((TOTAL + 1))
fi
echo ""

# ── 4. Python Tooling ─────────────────────────
if [ -e "pyproject.toml" ] || [ -e "backend/pyproject.toml" ]; then
  echo "── 4. Python Tooling ──"
  PYPROJECT="pyproject.toml"
  [ -e "backend/pyproject.toml" ] && PYPROJECT="backend/pyproject.toml"

  check_content "Ruff config" "$PYPROJECT" "tool.ruff" "ruff not configured. No Python linting/formatting."
  check_content "Mypy config" "$PYPROJECT" "tool.mypy" "mypy not configured. No Python type checking."
  check_content "Pytest config" "$PYPROJECT" "tool.pytest\|pytest" "pytest not configured. No Python testing setup."
  check_content "Coverage config" "$PYPROJECT" "tool.coverage\|coverage" "coverage not configured. No test coverage tracking."

  check_any "Python lockfile" "No lockfile. Installs are non-deterministic across environments." \
    "uv.lock" "backend/uv.lock" "poetry.lock" "backend/poetry.lock" "requirements.txt" "backend/requirements.txt"

  check_any "Makefile (Python)" "No Makefile. Common commands not centralized." \
    "Makefile" "backend/Makefile"
  echo ""
fi

# ── 5. TypeScript/Node Tooling ─────────────────
if [ -e "package.json" ] || [ -e "frontend/package.json" ]; then
  echo "── 5. TypeScript/Node Tooling ──"
  FRONTEND="."
  [ -e "frontend/package.json" ] && FRONTEND="frontend"

  check_any "ESLint config" "No ESLint. No TypeScript/JS linting." \
    "$FRONTEND/eslint.config.js" "$FRONTEND/eslint.config.mjs" "$FRONTEND/.eslintrc.js" "$FRONTEND/.eslintrc.json" "$FRONTEND/.eslintrc"

  check_any "Prettier config" "No Prettier. No automatic code formatting." \
    "$FRONTEND/.prettierrc" "$FRONTEND/.prettierrc.json" "$FRONTEND/.prettierrc.js" "$FRONTEND/prettier.config.js"

  check_any "TypeScript config" "No tsconfig.json. No type checking." \
    "$FRONTEND/tsconfig.json" "tsconfig.json"

  check_any "Node lockfile" "No lockfile. npm/yarn installs are non-deterministic." \
    "$FRONTEND/package-lock.json" "$FRONTEND/yarn.lock" "$FRONTEND/pnpm-lock.yaml" \
    "package-lock.json" "yarn.lock" "pnpm-lock.yaml"

  check_any "Node version pinning" "No .nvmrc. Node version not pinned — may vary across environments." \
    ".nvmrc" "$FRONTEND/.nvmrc" ".node-version" "$FRONTEND/.node-version"
  echo ""
fi

# ── 6. Testing Infrastructure ──────────────────
echo "── 6. Testing Infrastructure ──"

# Python tests
if [ -e "pyproject.toml" ] || [ -e "backend/pyproject.toml" ]; then
  PYPROJECT="pyproject.toml"
  [ -e "backend/pyproject.toml" ] && PYPROJECT="backend/pyproject.toml"
  TESTROOT="."
  [ -d "backend/tests" ] && TESTROOT="backend"

  # Coverage >= 80%
  TOTAL=$((TOTAL + 1))
  if grep -q "fail_under" "$PYPROJECT" 2>/dev/null; then
    COVERAGE_VAL=$(grep "fail_under" "$PYPROJECT" 2>/dev/null | head -1 | grep -o '[0-9]*')
    if [ -n "$COVERAGE_VAL" ] && [ "$COVERAGE_VAL" -ge 80 ] 2>/dev/null; then
      echo "OK: Python coverage minimum — fail_under = $COVERAGE_VAL%"
      PASS=$((PASS + 1))
    else
      echo "WARNING: Python coverage minimum TOO LOW — fail_under = ${COVERAGE_VAL:-?}% (must be >= 80%)"
      WARN=$((WARN + 1))
    fi
  else
    echo "WARNING: Python coverage minimum MISSING — No fail_under in coverage config. Must be >= 80%."
    WARN=$((WARN + 1))
  fi

  # Test fixtures (conftest.py)
  check_any "Test fixtures (conftest.py)" "No conftest.py with shared fixtures. Tests need factory functions for synthetic data." \
    "$TESTROOT/tests/conftest.py" "tests/conftest.py"

  # Unit tests directory
  check_any "Unit tests directory" "No unit tests directory. Pure domain logic is untested." \
    "$TESTROOT/tests/unit" "tests/unit"

  # Smoke tests
  check_any "Smoke tests" "No smoke tests. Deployed endpoints are not verified after deploy." \
    "$TESTROOT/tests/smoke" "tests/smoke"

  # Integration tests directory
  check_any "Integration tests directory" "No integration tests. DB queries and API flows are untested." \
    "$TESTROOT/tests/integration" "tests/integration"

  # Pytest markers
  check_content "Pytest markers (unit/integration)" "$PYPROJECT" "markers" "No pytest markers defined. Tests cannot be run selectively."
fi

# TypeScript tests
if [ -e "package.json" ] || [ -e "frontend/package.json" ]; then
  FRONTEND="."
  [ -e "frontend/package.json" ] && FRONTEND="frontend"

  # Test setup file
  check_any "Frontend test setup" "No test setup file. Testing library matchers not configured." \
    "$FRONTEND/src/test/setup.ts" "$FRONTEND/src/test/setup.tsx" "$FRONTEND/src/setupTests.ts"

  # Test factories
  check_any "Frontend test factories" "No test factories. Tests lack synthetic data generators." \
    "$FRONTEND/src/test/factories.ts" "$FRONTEND/src/test/factories.tsx" "$FRONTEND/src/test/helpers.ts"

  # Check for coverage thresholds in vite config or package.json
  TOTAL=$((TOTAL + 1))
  if grep -rq "thresholds\|coverage" "$FRONTEND/vite.config.ts" 2>/dev/null || \
     grep -q "coverage" "$FRONTEND/package.json" 2>/dev/null; then
    echo "OK: Frontend coverage config — found in vite.config.ts or package.json"
    PASS=$((PASS + 1))
  else
    echo "WARNING: Frontend coverage config MISSING — No coverage thresholds. Must enforce >= 80%."
    WARN=$((WARN + 1))
  fi
fi

# Multi-ecosystem detection
echo ""
echo "── 6b. Multi-Ecosystem Validation ──"

# Terraform
if find . -name "*.tf" -not -path "./.terraform/*" 2>/dev/null | grep -q .; then
  TOTAL=$((TOTAL + 1))
  if find . -name "*.tftest.hcl" -o -name "*_test.tf" 2>/dev/null | grep -q . || \
     grep -rq "terraform.*test\|tflint\|terraform_validate" .pre-commit-config.yaml 2>/dev/null; then
    echo "OK: Terraform testing — tests or validation hooks found"
    PASS=$((PASS + 1))
  else
    echo "WARNING: Terraform files detected but NO terraform test/validate/tflint configured"
    WARN=$((WARN + 1))
  fi
fi

# YAML validation (non-CI yaml files)
YAML_COUNT=$(find . \( -name "*.yaml" -o -name "*.yml" \) -not -path "*/node_modules/*" -not -path "*/.venv/*" -not -path "*/.git/*" -not -path "*/.mypy_cache/*" -not -path "*/.vite/*" -not -path "*/.claude/*" -not -path "*/legacy_code/*" 2>/dev/null | wc -l)
if [ "$YAML_COUNT" -gt 3 ]; then
  TOTAL=$((TOTAL + 1))
  if grep -rq "yamllint\|check-yaml" .pre-commit-config.yaml 2>/dev/null; then
    echo "OK: YAML validation — yamllint or check-yaml hook configured"
    PASS=$((PASS + 1))
  else
    echo "WARNING: $YAML_COUNT YAML files found but no yamllint/check-yaml validation configured"
    WARN=$((WARN + 1))
  fi
fi

# JSON validation
JSON_COUNT=$(find . -name "*.json" -not -path "*/node_modules/*" -not -path "*/.venv/*" -not -path "*/.git/*" -not -path "*/.mypy_cache/*" -not -path "*/.vite/*" -not -path "*/.claude/*" -not -path "*/.ruff_cache/*" -not -path "*/.pytest_cache/*" -not -path "*/legacy_code/*" -not -name "package-lock.json" 2>/dev/null | wc -l)
if [ "$JSON_COUNT" -gt 3 ]; then
  TOTAL=$((TOTAL + 1))
  if grep -rq "check-json\|jsonlint\|pretty-format-json" .pre-commit-config.yaml 2>/dev/null; then
    echo "OK: JSON validation — check-json hook configured"
    PASS=$((PASS + 1))
  else
    echo "WARNING: $JSON_COUNT JSON files found but no check-json validation configured"
    WARN=$((WARN + 1))
  fi
fi

# Airflow DAGs
if [ -d "dags" ] || [ -e "airflow.cfg" ] || find . -name "airflow_dag*.py" 2>/dev/null | grep -q .; then
  TOTAL=$((TOTAL + 1))
  if find . -path "*/test*dag*" -name "*.py" 2>/dev/null | grep -q . || \
     find . -name "test_dag*" 2>/dev/null | grep -q .; then
    echo "OK: Airflow DAG tests — test files found"
    PASS=$((PASS + 1))
  else
    echo "WARNING: Airflow DAGs detected but NO DAG tests found. DAG import errors will go undetected."
    WARN=$((WARN + 1))
  fi
fi

# Go
if find . -name "*.go" -not -path "*/vendor/*" -not -path "*/.vite/*" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.venv/*" -not -path "*/venv/*" 2>/dev/null | grep -q .; then
  TOTAL=$((TOTAL + 1))
  if find . -name "*_test.go" 2>/dev/null | grep -q .; then
    echo "OK: Go tests — *_test.go files found"
    PASS=$((PASS + 1))
  else
    echo "WARNING: Go files detected but NO _test.go files found"
    WARN=$((WARN + 1))
  fi
fi

# Rust
if [ -e "Cargo.toml" ]; then
  TOTAL=$((TOTAL + 1))
  if grep -rq "\#\[test\]\|#\[cfg(test)\]" . --include="*.rs" 2>/dev/null || [ -d "tests" ]; then
    echo "OK: Rust tests — #[test] or tests/ directory found"
    PASS=$((PASS + 1))
  else
    echo "WARNING: Cargo.toml found but NO Rust tests detected"
    WARN=$((WARN + 1))
  fi
fi

# Shell scripts
SH_COUNT=$(find . -name "*.sh" -not -path "*/.venv/*" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.claude/*" 2>/dev/null | wc -l)
if [ "$SH_COUNT" -gt 2 ]; then
  TOTAL=$((TOTAL + 1))
  if grep -rq "shellcheck" .pre-commit-config.yaml 2>/dev/null || command -v shellcheck > /dev/null 2>&1; then
    echo "OK: Shell script validation — shellcheck available or configured"
    PASS=$((PASS + 1))
  else
    echo "WARNING: $SH_COUNT shell scripts found but no shellcheck configured"
    WARN=$((WARN + 1))
  fi
fi

# Dockerfile linting
if find . -name "Dockerfile*" 2>/dev/null | grep -q .; then
  TOTAL=$((TOTAL + 1))
  if grep -rq "hadolint" .pre-commit-config.yaml 2>/dev/null; then
    echo "OK: Dockerfile linting — hadolint configured"
    PASS=$((PASS + 1))
  else
    echo "WARNING: Dockerfile found but no hadolint linting configured"
    WARN=$((WARN + 1))
  fi
fi

# Helm
if [ -d "helm" ] || [ -e "Chart.yaml" ]; then
  TOTAL=$((TOTAL + 1))
  if find . -path "*/tests/*" -name "*.yaml" 2>/dev/null | grep -q . || \
     grep -rq "helm.*lint\|helm.*test" .github/workflows/*.yml 2>/dev/null; then
    echo "OK: Helm tests — test templates or CI lint found"
    PASS=$((PASS + 1))
  else
    echo "WARNING: Helm charts detected but NO helm lint/test configured"
    WARN=$((WARN + 1))
  fi
fi

# Kubernetes manifests
if find . -name "*.k8s.yaml" -o -path "*/k8s/*" -name "*.yaml" 2>/dev/null | grep -q .; then
  TOTAL=$((TOTAL + 1))
  if grep -rq "kubeval\|kubeconform" .pre-commit-config.yaml .github/workflows/*.yml 2>/dev/null; then
    echo "OK: Kubernetes validation — kubeval/kubeconform configured"
    PASS=$((PASS + 1))
  else
    echo "WARNING: Kubernetes manifests found but no kubeval/kubeconform validation"
    WARN=$((WARN + 1))
  fi
fi

# Protobuf
if find . -name "*.proto" 2>/dev/null | grep -q .; then
  TOTAL=$((TOTAL + 1))
  if grep -rq "buf\|protolint" .pre-commit-config.yaml 2>/dev/null || [ -e "buf.yaml" ]; then
    echo "OK: Protobuf validation — buf or protolint configured"
    PASS=$((PASS + 1))
  else
    echo "WARNING: .proto files found but no buf/protolint validation"
    WARN=$((WARN + 1))
  fi
fi

# Ansible
if [ -d "ansible" ] || find . -name "playbook*.yml" 2>/dev/null | grep -q .; then
  TOTAL=$((TOTAL + 1))
  if grep -rq "ansible-lint" .pre-commit-config.yaml 2>/dev/null || [ -e ".ansible-lint" ]; then
    echo "OK: Ansible linting — ansible-lint configured"
    PASS=$((PASS + 1))
  else
    echo "WARNING: Ansible playbooks detected but no ansible-lint configured"
    WARN=$((WARN + 1))
  fi
fi
echo ""

# ── 7. CI/CD ───────────────────────────────────
echo "── 7. CI/CD Pipelines ──"

check_any "CI pipeline" "No CI pipeline. No automated checks on push/PR. Bugs can reach main unchecked." \
  ".github/workflows/ci.yml" ".github/workflows/ci.yaml" \
  ".github/workflows/test.yml" ".github/workflows/test.yaml" \
  ".github/workflows/build.yml" ".github/workflows/build.yaml" \
  ".gitlab-ci.yml" "Jenkinsfile" ".circleci/config.yml"

check_any "Deploy pipeline" "No deploy pipeline. Deployments are manual and error-prone." \
  ".github/workflows/deploy.yml" ".github/workflows/deploy.yaml" \
  ".github/workflows/release.yml" ".github/workflows/release.yaml" \
  "railway.toml" "vercel.json" "fly.toml" "render.yaml" "Procfile"

check_any "Dependabot/Renovate" "No dependency update automation. Stale deps accumulate vulnerabilities." \
  ".github/dependabot.yml" ".github/dependabot.yaml" \
  "renovate.json" ".renovaterc" ".renovaterc.json"

# Pre-commit autoupdate workflow (only if pre-commit config exists)
if [ -e ".pre-commit-config.yaml" ] || [ -e ".pre-commit-config.yml" ]; then
  TOTAL=$((TOTAL + 1))
  if find .github/workflows/ -name "*.yml" -exec grep -l "pre-commit autoupdate\|autoupdate" {} \; 2>/dev/null | grep -q .; then
    echo "OK: Pre-commit autoupdate workflow — automated hook version updates"
    PASS=$((PASS + 1))
  else
    echo "WARNING: Pre-commit hooks exist but NO autoupdate workflow. Hook versions (gitleaks, etc.) will go stale."
    WARN=$((WARN + 1))
  fi
fi
echo ""

# ── 8. Docker & Deploy ────────────────────────
echo "── 8. Docker & Deployment ──"
check_any "Dockerfile" "No Dockerfile. No containerized build." \
  "Dockerfile" "backend/Dockerfile" "docker/Dockerfile"

check_any "Docker Compose" "No docker-compose. Local services (DB, cache) not defined." \
  "docker-compose.yml" "docker-compose.yaml" "compose.yml" "compose.yaml" \
  "backend/docker-compose.yml" "backend/docker-compose.yaml"
echo ""

# ── 9. Environment Management ─────────────────
echo "── 9. Environment Management ──"
check_any ".env.example (backend)" "No .env.example. Required env vars not documented for new developers." \
  ".env.example" "backend/.env.example"

if [ -e "frontend/package.json" ] || [ -e "package.json" ]; then
  check_any ".env.example (frontend)" "No frontend .env example. Frontend env vars not documented." \
    "frontend/.env.local.example" "frontend/.env.example" ".env.local.example"
fi

# Check that .env is gitignored
TOTAL=$((TOTAL + 1))
if [ -e ".gitignore" ] && grep -q "\.env" ".gitignore" 2>/dev/null; then
  echo "OK: .env is in .gitignore"
  PASS=$((PASS + 1))
else
  echo "WARNING: .env may NOT be gitignored — Secrets could be committed to git!"
  WARN=$((WARN + 1))
fi
echo ""

# ── 10. Documentation ─────────────────────────
echo "── 10. Documentation ──"
check_any "README" "No README. Project has no documentation for new developers." \
  "README.md" "README.rst" "README.txt" "README"
echo ""

# ── Summary ────────────────────────────────────
echo "============================================"
echo "  SUMMARY: $PASS passed, $WARN warnings, $TOTAL total checks"
echo "============================================"

if [ "$WARN" -eq 0 ]; then
  echo ""
  echo "All checks passed! Project quality infrastructure is complete."
else
  echo ""
  echo "$WARN item(s) need attention. Review warnings above."
  echo "For each missing item, the corresponding reference file"
  echo "in the skill's references/ directory has implementation templates."
fi
