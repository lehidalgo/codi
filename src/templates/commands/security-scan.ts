import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Run a comprehensive security scan on the codebase
managed_by: ${PROJECT_NAME}
---

Use the security-scan skill to analyze this codebase for vulnerabilities.

## Three-Agent Parallel Audit
Launch THREE parallel analysis agents for comprehensive coverage:

### Agent 1: Security Expert
- Detect credential exfiltration (env vars, .env files, config files)
- Find data exfiltration (code uploads to external endpoints)
- Identify backdoors (hidden endpoints, reverse shells)
- Detect obfuscated code (base64 encoding, eval/exec with dynamic strings)
- Find suspicious network calls (unusual domains, hardcoded IPs)

### Agent 2: Network Analysis
- Find all HTTP client library usage (requests, httpx, fetch, axios, etc.)
- Detect outbound socket connections and webhook implementations
- Identify telemetry/analytics code
- Check for environment variables being transmitted externally

### Agent 3: Dependency Analysis
- Read dependency files (package.json, pyproject.toml, requirements.txt, Cargo.toml, go.mod)
- Check for typosquatting in package names
- Identify unusual or unnecessary packages
- Look for post-install hooks that execute arbitrary code

## Report Format
Organize findings with:
- **Executive Summary** with risk level: LOW / MEDIUM / HIGH / CRITICAL
- Findings by category: Credentials, Data Exfiltration, Backdoors, Network, Obfuscated Code, Dependencies
- File path, line number, and suggested fix for each finding
- Recommendations prioritized by severity
`;
