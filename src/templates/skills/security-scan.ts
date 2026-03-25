export const template = `---
name: {{name}}
description: Security analysis workflow. Use to audit codebases for vulnerabilities, hardcoded secrets, OWASP Top 10 risks, and dependency CVEs. Produces severity-ranked findings with actionable fixes.
compatibility: [claude-code, cursor, codex]
managed_by: codi
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

### Step 3: OWASP Top 10 Analysis

**[CODING AGENT]** Check the codebase against OWASP Top 10 categories:

1. **Injection** — SQL, NoSQL, OS command, LDAP injection via unsanitized input
2. **Broken Authentication** — Weak session management, missing rate limiting, plaintext passwords
3. **Sensitive Data Exposure** — Unencrypted PII, missing HTTPS, verbose error messages
4. **XML External Entities (XXE)** — Unsafe XML parsing configurations
5. **Broken Access Control** — Missing authorization checks, IDOR vulnerabilities
6. **Security Misconfiguration** — Debug mode enabled, default credentials, open CORS
7. **Cross-Site Scripting (XSS)** — Unescaped user input rendered in HTML/JS
8. **Insecure Deserialization** — Untrusted data deserialized without validation
9. **Known Vulnerabilities** — Outdated dependencies with published CVEs
10. **Insufficient Logging** — Missing audit trails for security events

### Step 4: Review Dependency Versions

**[CODING AGENT]** Check all dependencies for:
- Packages with known CVEs not caught by the audit tool
- Severely outdated packages (2+ major versions behind)
- Packages that are unmaintained or archived
- Packages with suspicious download counts or recent ownership changes

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
`;
