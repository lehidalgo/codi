# Security Scanning Reference

## Gitleaks — Secrets Detection

Scans staged files before each commit. 150+ built-in rules for AWS keys, GCP tokens, GitHub PATs, SSH keys, JWTs, etc.

### Minimal .gitleaks.toml

```toml
title = "Gitleaks config"

[allowlist]
paths = [
  '''\.env\.example$''',
  '''\.venv[/\\]''',
  '''node_modules[/\\]''',
  '''__pycache__[/\\]''',
  '''legacy_code[/\\]''',
  '''tests?[/\\]''',
]
```

### Custom Rules (add as needed)

```toml
[[rules]]
id = "hardcoded-password-assignment"
description = "Hardcoded password in assignment"
regex = '''(?i)password\s*=\s*['"][^'"]{8,}['"]'''
tags = ["password", "hardcoded"]

[[rules]]
id = "hardcoded-token-assignment"
description = "Hardcoded token in assignment"
regex = '''(?i)token\s*=\s*['"][^'"]{8,}['"]'''
tags = ["token", "hardcoded"]

[[rules]]
id = "connection-string-with-password"
description = "Connection string with embedded password"
regex = '''(?i)(postgres|mysql|mongodb|redis)://[^:]+:[^@]+@'''
tags = ["connection-string", "password"]
```

### Provider-Specific Rules

```toml
# Supabase
[[rules]]
id = "supabase-url-with-password"
description = "Supabase connection string with credentials"
regex = '''(?i)supabase[^'"]*password[^'"]*'''
tags = ["supabase"]

# Resend
[[rules]]
id = "resend-api-key"
description = "Resend API key"
regex = '''re_[a-zA-Z0-9]{20,}'''
tags = ["resend"]

# Clerk
[[rules]]
id = "clerk-secret-key"
description = "Clerk secret key"
regex = '''sk_(test|live)_[a-zA-Z0-9]{20,}'''
tags = ["clerk"]
```

### False Positive Handling

- Add path to `[allowlist].paths` for entire files
- Add to `[rules.allowlist].paths` for rule-specific exceptions
- Windows paths use `\` — use `[/\\]` in regex for cross-OS compatibility

---

## Bandit — Python Security Linting

Detects: `eval()`, `exec()`, SQL injection, `subprocess(shell=True)`, hardcoded passwords, insecure HTTP, etc.

### .bandit.yaml

```yaml
# Severity: -l (low+), -ll (medium+), -lll (high only)
# Using medium+ to reduce noise while catching real issues
skips:
  - B101  # assert used in tests (not production)
  - B311  # random — not used for crypto

exclude_dirs:
  - tests
  - alembic
  - scripts
  - .venv
```

### Usage

```bash
# Manual full scan
bandit -r app/ -ll

# Single file
bandit app/api/v1/routers/auth.py -ll

# Show details (not quiet)
bandit -r app/ -ll --format custom --msg-template "{abspath}:{line}: {test_id}: {msg}"
```

### Silencing False Positives

```python
# On a specific line:
result = subprocess.run(cmd)  # nosec B603

# NEVER use blanket ignore:
result = subprocess.run(cmd)  # nosec  ← BAD: silences ALL checks
```

---

## Secrets Management Rules

**NON-NEGOTIABLE:**

1. Secrets ONLY in `.env` (backend) or `.env.local` (frontend)
2. Both files MUST be in `.gitignore`
3. Config defaults must be empty strings `""` or safe local-dev values
4. `.env.example` may have placeholders (`API_KEY=xxx`), never real secrets
5. Frontend: only `VITE_` prefixed vars are exposed to bundle — never put secrets with this prefix
