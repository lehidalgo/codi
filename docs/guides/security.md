# Security Guide

**Date**: 2026-03-25
**Document**: security.md

This guide covers security best practices for using codi in development workflows. It addresses secret management, artifact authoring, hook security, MCP server trust, dependency auditing, and OWASP considerations for CLI tools.

## Trust Boundaries

```mermaid
flowchart TD
    subgraph Trusted["Trusted Zone (Your Repository)"]
        A[".codi/ directory"]
        B["Generated files<br>CLAUDE.md, .cursorrules"]
        C["codi CLI"]
    end

    subgraph SemiTrusted["Semi-Trusted Zone"]
        D["MCP servers"]
        E["Pre-commit hooks"]
        F["Remote presets<br>codi update --from"]
    end

    subgraph Untrusted["Untrusted Zone"]
        G["npm packages"]
        H["AI agent responses"]
        I["User input to agents"]
    end

    A --> B
    C --> A
    D -->|validated| C
    E -->|sandboxed| C
    F -->|one-way pull| A
    G -->|audited| C
    H -->|verified via codi verify| B
    I -->|sanitized by rules| H
```

Understanding trust boundaries is critical. Codi generates files that AI agents read and follow. A compromised rule or skill can influence agent behavior across your entire project.

## Secret Management in Codi Configs

### The golden rule

**Never store secrets in `.codi/` files.** The `.codi/` directory is committed to version control. Any secret placed here will be exposed in your repository history.

### What NOT to put in codi configuration

| Prohibited | Example | Where it belongs |
|-----------|---------|-----------------|
| API keys | `OPENAI_API_KEY=sk-...` | Environment variable or secret manager |
| Tokens | `GITHUB_TOKEN=ghp_...` | CI secret store (GitHub Secrets, GitLab Variables) |
| Passwords | `DB_PASSWORD=...` | Vault, AWS Secrets Manager, or `.env` (gitignored) |
| Private keys | `-----BEGIN RSA PRIVATE KEY-----` | File system with restricted permissions |
| Connection strings | `postgres://user:pass@host/db` | Environment variable |

### Safe patterns for codi configuration

Reference secrets by name, never by value:

```yaml
# .codi/mcp.yaml - SAFE: references environment variable names
servers:
  database:
    command: npx
    args: ["@modelcontextprotocol/server-postgres"]
    env:
      DATABASE_URL: "${DATABASE_URL}"  # Resolved at runtime, not stored
```

```markdown
<!-- .codi/rules/custom/api-usage.md - SAFE: instructs about secrets -->
---
managed_by: user
description: API usage guidelines
---

# API Usage

- Always read API keys from environment variables
- Never hardcode credentials in source code
- Use `process.env.API_KEY` pattern for all secret access
```

### Verifying no secrets in config

```bash
# Run codi doctor to check for potential secrets
codi doctor

# The doctor command scans for common secret patterns in .codi/ files
```

## Secure Artifact Authoring

### Rules

Rules are instructions that AI agents follow. A malicious or carelessly written rule can cause agents to:

- Expose sensitive data in generated code
- Bypass security controls
- Execute dangerous commands

**Authoring checklist:**

1. Never include real credentials, even as examples. Use placeholders like `YOUR_API_KEY_HERE`.
2. Never instruct agents to disable security features (e.g., "skip SSL verification").
3. Review rules for prompt injection patterns that could override agent safety constraints.
4. Keep rules focused on behavior, not on accessing external systems.

### Skills

Skills define reusable workflows. They have more power than rules because they can include step-by-step instructions agents execute.

**Skill security rules:**

1. Skills should not reference file paths outside the project directory.
2. Skills should not instruct agents to install packages without version pinning.
3. Skills should not include commands that modify system configuration.
4. Review skills for command injection risks (e.g., unsanitized variable interpolation in shell commands).

### Agents

Agent definitions configure specialized AI agent personas. Security considerations:

1. Apply the principle of least privilege. Agent definitions should restrict scope to the minimum necessary.
2. Do not grant agents access to production systems through their configuration.
3. Review agent tool permissions carefully, especially for MCP server access.

## Hook Security

Codi can install pre-commit hooks that run checks before code is committed. Understanding what hooks can and cannot do is important for security.

### What hooks can do

| Capability | Example |
|-----------|---------|
| Run type checking | `tsc --noEmit` |
| Scan for secrets | Pattern matching against staged files |
| Check file sizes | Enforce `max_file_lines` flag |
| Validate commit messages | Conventional commit format check |
| Check codi version | Ensure team uses consistent version |

### What hooks cannot do

| Limitation | Reason |
|-----------|--------|
| Access network | Hooks run locally, no outbound calls by default |
| Modify unstaged files | Hooks only inspect staged content |
| Bypass git operations | Hooks advise (exit code), they do not prevent `--no-verify` |
| Run privileged operations | Hooks run as the current user |

### Hook sandbox model

```mermaid
flowchart LR
    subgraph "Pre-Commit Hook Scope"
        A[Read staged files] --> B[Run checks]
        B --> C{Pass?}
        C -->|Yes| D[Allow commit]
        C -->|No| E[Block commit]
    end

    subgraph "Out of Scope"
        F[Network access]
        G[System modification]
        H[Unstaged files]
    end

    B -.->|No access| F
    B -.->|No access| G
    B -.->|No access| H
```

### Hook file permissions

Codi generates hook scripts with mode `0o755` (owner read/write/execute, group and others read/execute). The scripts are written to:

- `.husky/pre-commit` (if husky is detected)
- `.git/hooks/pre-commit` (standalone mode)
- `.pre-commit-config.yaml` (if pre-commit framework is detected)
- `.lefthook.yml` (if lefthook is detected)

Review generated hook scripts before committing. They are plain-text shell and Node.js scripts.

## MCP Server Security

MCP (Model Context Protocol) servers extend AI agent capabilities. Codi distributes MCP configuration to each agent in `.codi/mcp.yaml`.

### Trusted vs untrusted servers

| Trust Level | Criteria | Examples |
|------------|----------|---------|
| **Trusted** | Official, audited, from known publishers | `@modelcontextprotocol/server-*`, first-party servers |
| **Semi-trusted** | Open source, community-maintained, reviewed | Community MCP servers with public source code |
| **Untrusted** | Unknown origin, closed source, unreviewed | Arbitrary npm packages claiming MCP support |

### MCP security checklist

1. **Audit server source code** before adding to `.codi/mcp.yaml`.
2. **Pin server versions** to prevent supply chain attacks:
   ```yaml
   servers:
     postgres:
       command: npx
       args: ["@modelcontextprotocol/server-postgres@1.2.3"]  # Pinned version
   ```
3. **Limit server permissions** to the minimum required scope.
4. **Never pass secrets directly** in MCP server configuration. Use environment variable references.
5. **Review server capabilities** to understand what data it can access.
6. **Monitor server updates** for security advisories.

### MCP trust decision flow

```mermaid
flowchart TD
    A[New MCP Server] --> B{Source code available?}
    B -->|No| C[Do not use]
    B -->|Yes| D{Published by known org?}
    D -->|Yes| E{Version pinned?}
    D -->|No| F{Community reviewed?}
    F -->|No| C
    F -->|Yes| E
    E -->|No| G[Pin version first]
    E -->|Yes| H{Requires sensitive access?}
    G --> H
    H -->|Yes| I[Audit code thoroughly]
    H -->|No| J[Add to mcp.yaml]
    I --> J
```

## Dependency Auditing

### npm audit

Run regular dependency audits:

```bash
# Check for known vulnerabilities
npm audit

# Fix automatically where possible
npm audit fix

# Generate audit report
npm audit --json > audit-report.json
```

### codi doctor checks

`codi doctor` performs several security-related checks:

| Check | What it validates |
|-------|------------------|
| Config validity | `.codi/` structure is well-formed |
| Version match | Installed codi version matches `requiredVersion` |
| Drift detection | Generated files have not been tampered with |
| Artifact integrity | Source files are parseable and complete |

```bash
# Run all doctor checks
codi doctor

# CI mode with non-zero exit on failure
codi doctor --ci
```

### Dependency hygiene practices

1. **Pin all dependency versions** in `package-lock.json`. Commit the lock file.
2. **Enable automated security updates** (Dependabot, Renovate) for your repository.
3. **Remove unused dependencies** to reduce attack surface.
4. **Review new dependencies** before adding them: check download counts, maintenance activity, and known vulnerabilities.

## Pre-Commit Secret Scanning

Codi includes a built-in secret scanner that runs as a pre-commit hook when the `security_scan` flag is enabled.

### How the scanner works

The scanner checks staged files against a set of regex patterns for common secret formats:

| Pattern | Detects |
|---------|---------|
| `api[_-]?key\s*[:=]\s*['"][^'"]{8,}` | API keys |
| `secret\|password\|passwd\|pwd\s*[:=]\s*['"][^'"]{8,}` | Passwords and secrets |
| `token\|bearer\s*[:=]\s*['"][^'"]{8,}` | Authentication tokens |
| `-----BEGIN (RSA\|EC\|DSA )?PRIVATE KEY-----` | Private keys |
| `ghp_[a-zA-Z0-9]{36}` | GitHub personal access tokens |
| `sk-[a-zA-Z0-9]{32,}` | OpenAI/Stripe secret keys |
| `AKIA[0-9A-Z]{16}` | AWS access key IDs |

### Enabling secret scanning

```yaml
# .codi/flags.yaml
security_scan: true
```

Then reinitialize hooks:

```bash
codi init
# or regenerate
codi generate
```

### Scanner limitations

The built-in scanner is a first line of defense, not a comprehensive solution. For production environments, complement it with dedicated tools:

| Tool | Strengths |
|------|-----------|
| [Gitleaks](https://github.com/gitleaks/gitleaks) | Comprehensive regex rules, supports custom patterns, scans git history |
| [TruffleHog](https://github.com/trufflesecurity/trufflehog) | Entropy-based detection, verifies credentials against live APIs |
| [git-secrets](https://github.com/awslabs/git-secrets) | AWS-focused, lightweight, provider-specific patterns |
| [Talisman](https://github.com/thoughtworks/talisman) | Pattern and entropy detection, checksum-based ignores |

### Combining codi with external scanners

```yaml
# .pre-commit-config.yaml (if using pre-commit framework)
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  # Codi's own hooks are auto-configured via codi init
```

## OWASP Considerations for CLI Tools

The OWASP Top 10 applies to CLI tools differently than web applications, but the principles remain relevant.

### Applicable OWASP categories

| OWASP Category | CLI Relevance | Codi Mitigation |
|---------------|---------------|-----------------|
| **A01: Broken Access Control** | File permissions on generated configs | Hook scripts set with `0o755`; configs are user-readable |
| **A02: Cryptographic Failures** | Hashing for drift detection | SHA-256 content hashing via `hashContent()` |
| **A03: Injection** | Command execution in hooks | Hook templates use parameterized commands, not string interpolation |
| **A04: Insecure Design** | Configuration that weakens security | `codi doctor` flags risky configurations |
| **A05: Security Misconfiguration** | Overly permissive flags | Presets provide secure defaults; `strict` preset enforces all checks |
| **A06: Vulnerable Components** | npm dependency vulnerabilities | `npm audit` integration; version pinning |
| **A07: Authentication Failures** | Token verification | `codi verify` validates agent loaded correct config |
| **A08: Data Integrity Failures** | Tampered generated files | Drift detection via content hashing |
| **A09: Logging Failures** | Missing audit trail | `codi compliance --ci --json` produces structured reports |
| **A10: SSRF** | Remote config fetching | `codi update --from` is one-way pull only; no outbound callbacks |

### Secure defaults in codi

Codi ships with the `strict` preset that enables maximum security:

```bash
# Initialize with strict security defaults
codi init --preset strict
```

The strict preset enables:
- `security_scan: true` — Pre-commit secret scanning
- `require_tests: true` — Tests required before commit
- `type_checking: true` — Type checking on staged files
- `max_file_lines: 500` — Strict file size limits

## Security Checklist for Codi Deployments

Use this checklist when deploying codi in a new project or team.

### Initial setup

- [ ] Run `codi init` with `--preset strict` for security-sensitive projects
- [ ] Verify `.codi/` directory does not contain any secrets: `codi doctor`
- [ ] Confirm `.env` and secret files are in `.gitignore`
- [ ] Enable `security_scan` flag in `flags.yaml`
- [ ] Pin codi version in `package.json` devDependencies

### Artifact review

- [ ] Review all rules for prompt injection patterns
- [ ] Review all skills for command injection risks
- [ ] Verify no real credentials appear in examples (use placeholders)
- [ ] Ensure agent definitions follow least-privilege principle

### MCP configuration

- [ ] Audit all MCP server source code
- [ ] Pin MCP server versions in `mcp.yaml`
- [ ] Use environment variable references for all secrets
- [ ] Remove unused MCP servers

### CI/CD integration

- [ ] Add `codi ci` to pull request validation pipeline
- [ ] Add `codi compliance --ci` to main branch pipeline
- [ ] Store CI secrets in platform secret store (not in repo)
- [ ] Enable drift detection to catch unauthorized config changes

### Ongoing maintenance

- [ ] Run `npm audit` weekly or enable automated security updates
- [ ] Review dependency updates before merging
- [ ] Rotate any secrets that may have been exposed
- [ ] Update codi to latest version for security patches
- [ ] Review hook scripts after `codi init` or `codi update`

### Security review flow

```mermaid
flowchart TD
    A[New codi deployment] --> B[Initialize with strict preset]
    B --> C[Review all artifacts]
    C --> D{Secrets found?}
    D -->|Yes| E[Remove and rotate]
    D -->|No| F[Configure MCP servers]
    E --> F
    F --> G[Audit MCP server code]
    G --> H[Pin all versions]
    H --> I[Setup CI pipeline]
    I --> J[Enable drift detection]
    J --> K[Document security decisions]
    K --> L[Schedule recurring audits]
```

## Incident Response

If a secret is accidentally committed through codi configuration:

1. **Rotate the secret immediately.** Do not wait to clean history.
2. **Remove the secret** from `.codi/` files.
3. **Run `codi generate`** to regenerate output files without the secret.
4. **Clean git history** using `git filter-repo` or BFG Repo-Cleaner.
5. **Audit access logs** to determine if the secret was exploited.
6. **Add the pattern** to your secret scanner to prevent recurrence.

```bash
# After removing the secret from source
codi generate
codi doctor  # Verify clean
git add .codi/ CLAUDE.md .cursorrules
git commit -m "fix: remove exposed secret from codi configuration"
```

## Related Documentation

- [Architecture](../architecture.md) — Hook system and error handling internals
- [CI Integration](ci-integration.md) — Basic CI setup and exit codes
- [Cloud CI Guide](cloud-ci.md) — Full pipeline examples for GitHub Actions, GitLab CI, Azure DevOps
- [Artifact Lifecycle](artifact-lifecycle.md) — How artifacts are managed and updated
- [Writing Artifacts](writing-rules.md) — Authoring rules, skills, and agents safely
