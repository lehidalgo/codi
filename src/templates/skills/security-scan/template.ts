import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Security analysis workflow. Use to audit codebases for vulnerabilities, hardcoded secrets, OWASP Top 10 risks, and dependency CVEs. Produces severity-ranked findings with actionable fixes.
category: Code Quality
compatibility: [claude-code, cursor, codex]
managed_by: ${PROJECT_NAME}
---

# {{name}}

## When to Use

Use when asked to perform a security audit, scan for vulnerabilities, or check for hardcoded secrets.

## When to Activate

- User asks to audit the codebase for security vulnerabilities
- User wants to scan for hardcoded secrets, API keys, or credentials in source code
- User needs a dependency audit to check for known CVEs
- User asks for an OWASP Top 10 analysis of their application
- User wants to verify input validation and sanitization across endpoints

## Security Scan Process

### Step 1: Dependency Audit

**[SYSTEM]** Run the appropriate dependency audit command based on project type:
- Node.js: \\\`npm audit --json\\\`
- Python: \\\`pip-audit --format=json\\\`
- Rust: \\\`cargo audit --json\\\`
- Java/Maven: \\\`mvn dependency-check:check\\\`
- Go: \\\`govulncheck ./...\\\`

Parse the output and note all known vulnerabilities with their severity.

### Step 2: Scan for Hardcoded Secrets

**[CODING AGENT]** Scan all source files for hardcoded secrets using these patterns:
- API keys: strings matching \\\`[A-Za-z0-9_]{20,}\\\` near keywords like \\\`api_key\\\`, \\\`apiKey\\\`, \\\`API_KEY\\\`
- Tokens: \\\`token\\\`, \\\`bearer\\\`, \\\`jwt\\\`, \\\`secret\\\` assigned to string literals
- Passwords: \\\`password\\\`, \\\`passwd\\\`, \\\`pwd\\\` with hardcoded values
- Connection strings: URLs containing credentials (user:pass@host)
- Private keys: \\\`-----BEGIN (RSA|EC|DSA) PRIVATE KEY-----\\\`
- AWS/GCP/Azure credentials: \\\`AKIA\\\`, \\\`GOOG\\\`, \\\`Az\\\` prefixed strings

Skip test fixtures, examples, and documentation files.

### Step 3: OWASP Top 10:2025 Analysis

**[CODING AGENT]** Check the codebase against OWASP Top 10:2025 categories:

1. **A01 — Broken Access Control** — Missing authorization checks, IDOR/BOLA, CORS misconfiguration, privilege escalation
2. **A02 — Security Misconfiguration** — Debug mode enabled, default credentials, unnecessary features, missing security headers
3. **A03 — Software Supply Chain Failures** — Unverified dependencies, missing lockfile integrity, no SBOM, unsigned artifacts
4. **A04 — Injection** — SQL, NoSQL, OS command, LDAP, template injection via unsanitized input
5. **A05 — Insecure Design** — Missing threat modeling, business logic flaws, insufficient rate limiting
6. **A06 — Vulnerable and Outdated Components** — Dependencies with known CVEs, unmaintained packages
7. **A07 — Authentication Failures** — Weak session management, missing MFA, plaintext passwords, no brute-force protection
8. **A08 — Data Integrity Failures** — Insecure deserialization, unsigned updates, untrusted CI/CD pipelines
9. **A09 — Security Logging and Monitoring Failures** — Missing audit trails, no alerting on suspicious activity
10. **A10 — Mishandling of Exceptional Conditions** — Errors that fail open, unhandled exceptions that leak data or bypass auth

### Step 3b: AI-Generated Code Check

**[CODING AGENT]** If the project uses AI coding assistants:
- Check for prompt injection vectors (user input embedded in LLM prompts)
- Verify LLM outputs are validated before use in SQL, shell, or HTML
- Check that AI agents do not have excessive permissions (credentials, admin APIs)

### Step 3c: Security Headers Check

**[CODING AGENT]** If the project serves HTTP responses, verify:
- Content-Security-Policy is configured
- Strict-Transport-Security is set with appropriate max-age
- X-Content-Type-Options: nosniff is present
- Referrer-Policy is configured
- Permissions-Policy disables unused browser features

### Step 4: Supply Chain Security

**[CODING AGENT]** Check supply chain security:
- Verify lockfile exists and integrity hashes are present — lockfiles without hashes allow tampering
- Check for typosquatted package names — compare against known legitimate packages
- Verify dependencies are not archived or unmaintained (no commits in 12+ months)
- Check for packages with suspicious recent ownership changes
- Verify no packages are severely outdated (2+ major versions behind)
- If container images are used, check for non-root USER and minimal base images (distroless/Alpine)

### Step 5: Input Validation Check

**[CODING AGENT]** Verify input validation at all system boundaries:
- API endpoints: are request bodies validated against schemas?
- File uploads: type, size, and content checks present?
- URL parameters: sanitized before use in queries or file paths?
- Environment variables: validated at startup?
- Database queries: parameterized or using an ORM?

### Step 6: Report Findings

**[CODING AGENT]** Organize findings by severity:

**Critical** — Immediate risk of exploitation:
- Hardcoded secrets in source code
- SQL injection or command injection
- Authentication bypass

**High** — Significant risk requiring prompt action:
- Missing input validation on public endpoints
- Known CVEs in direct dependencies
- Broken access control

**Medium** — Should be addressed in current sprint:
- Outdated dependencies without known CVEs
- Missing rate limiting
- Verbose error messages exposing internals

**Low** — Improve when convenient:
- Missing security headers
- Informational logging gaps
- Minor configuration improvements

For each finding include:
- File path and line number
- Category (secrets, OWASP, dependency, validation)
- Description of the vulnerability
- Suggested fix with code example

## Available Agents

For specialized analysis, delegate to these agents (see \\\`agents/\\\` directory):
- **codi-security-analyzer** — Deep vulnerability analysis with trust boundary mapping
- **codi-code-reviewer** — Broader code quality context for security findings

## Related Skills

- **codi-code-review** — Combined quality and security review of changes
`;
