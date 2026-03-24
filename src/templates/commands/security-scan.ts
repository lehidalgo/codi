export const template = `---
name: {{name}}
description: Run a security scan on the codebase
managed_by: codi
---

Use the security-scan skill to analyze this codebase for vulnerabilities.
Run dependency audits, scan for hardcoded secrets, and check OWASP Top 10.
Report findings organized by severity (Critical, High, Medium, Low).
Include file path, line number, and suggested fix for each finding.
`;
