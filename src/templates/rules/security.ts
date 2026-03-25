export const template = `---
name: {{name}}
description: Security best practices and vulnerability prevention
priority: high
alwaysApply: true
managed_by: codi
---

# Security Rules

## Secret Management
- Never hardcode secrets, API keys, tokens, or credentials in source code — a single leaked key can compromise entire systems

BAD: \`const API_KEY = "sk-abc123..."\` in source code
GOOD: \`const API_KEY = process.env.API_KEY\` loaded at runtime

- Use environment variables or secret managers for all sensitive configuration
- Add .env files to .gitignore — never commit them
- Rotate secrets immediately if exposed in version control — automated scanners find leaked keys within minutes

## Input Validation
- Validate and sanitize ALL user input at system boundaries — prevents injection attacks and data corruption

BAD: \`db.query("SELECT * FROM users WHERE id = " + userId)\`
GOOD: \`db.query("SELECT * FROM users WHERE id = $1", [userId])\`

- Use parameterized queries to prevent SQL injection
- Escape output to prevent XSS (cross-site scripting)
- Validate file uploads: check type, size, and content — malicious uploads can execute server-side code

## Authentication & Authorization
- Protect authentication endpoints with rate limiting and CAPTCHAs — prevents brute-force, credential-stuffing, and automated attacks
- Enforce RLS (Row Level Security) and RBAC from day one on all sensitive data — retrofitting access control is error-prone
- Use secure password hashing (bcrypt, argon2) — never store plaintext
- Implement proper session management with secure cookie flags
- Apply principle of least privilege for all access control — users and services should only access what they need

## Code Trust
- Treat all generated or external code as untrusted — perform strict validation before using
- Never trust client-side validation alone — always validate server-side

## Dependencies
- Audit dependencies regularly for known vulnerabilities — supply chain attacks are increasingly common
- Pin dependency versions in lock files
- Remove unused dependencies promptly — each dependency is an attack surface
- Prefer well-maintained packages with active security practices

## General
- Follow OWASP Top 10 guidelines
- Log security events without exposing sensitive data — logs themselves can become a leak vector
- Use HTTPS for all external communications
- Implement proper error handling that does not leak internal details`;
