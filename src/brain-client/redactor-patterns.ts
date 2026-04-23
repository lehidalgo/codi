export interface RedactionPattern {
  name: string;
  regex: RegExp;
  replacement: string;
}

/**
 * Initial redaction pattern set. Extend by adding entries here + a test case
 * in `redactor-patterns.test.ts`. Patterns are applied top-to-bottom; put
 * more-specific patterns (e.g. anthropic_key) before less-specific ones
 * (e.g. openai_key) that would also match.
 */
export const REDACTION_PATTERNS: RedactionPattern[] = [
  {
    name: "anthropic_key",
    regex: /sk-ant-[A-Za-z0-9_-]{32,}/g,
    replacement: "[REDACTED:anthropic_key]",
  },
  {
    name: "openai_key",
    regex: /sk-[A-Za-z0-9_-]{32,}/g,
    replacement: "[REDACTED:openai_key]",
  },
  {
    name: "google_key",
    regex: /AIza[A-Za-z0-9_-]{35}/g,
    replacement: "[REDACTED:google_key]",
  },
  {
    name: "github_pat",
    regex: /gh[opusr]_[A-Za-z0-9]{36,}/g,
    replacement: "[REDACTED:github_pat]",
  },
  {
    name: "slack_token",
    regex: /xox[abprs]-[A-Za-z0-9-]{10,}/g,
    replacement: "[REDACTED:slack_token]",
  },
  {
    name: "aws_access_key",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    replacement: "[REDACTED:aws_access_key]",
  },
  {
    name: "jwt",
    regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    replacement: "[REDACTED:jwt]",
  },
  {
    name: "ssh_private_key_header",
    regex: /-----BEGIN (OPENSSH|RSA|DSA|EC) PRIVATE KEY-----/g,
    replacement: "[REDACTED:ssh_private_key]",
  },
  {
    name: "bearer_token_header",
    regex: /[Aa]uthorization:\s*[Bb]earer\s+[A-Za-z0-9._-]+/g,
    replacement: "Authorization: Bearer [REDACTED]",
  },
  {
    name: "url_password",
    regex: /:\/\/[^\s:/@]+:[^@\s]+@/g,
    replacement: "://[REDACTED]@",
  },
  {
    name: "email",
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    replacement: "[REDACTED:email]",
  },
  {
    name: "long_hex",
    regex: /\b[A-Fa-f0-9]{32,}\b/g,
    replacement: "[REDACTED:hex]",
  },
];
