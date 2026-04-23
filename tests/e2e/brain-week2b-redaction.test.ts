/**
 * Redaction validation — feeds realistic (fake) secrets into the L3 path
 * and verifies the redactor scrubs them before anything leaves the process.
 */
import { describe, it, expect } from "vitest";
import { redactTranscript } from "#src/brain-client/redactor.js";
import { REDACTION_PATTERNS } from "#src/brain-client/redactor-patterns.js";

describe("Redaction guardrails (privacy-critical)", () => {
  const FAKE_OPENAI = "sk-proj-aaaabbbbccccddddeeeeffffgggghhhhiiii";
  const FAKE_ANTHROPIC = "sk-ant-api03-aaaabbbbccccddddeeeeffffgggghhhhiiii";
  const FAKE_GOOGLE = "AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  const FAKE_GITHUB = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";
  const FAKE_SLACK = "xoxb-DEMO0000-DEMO0000-NOTREALsamplevalue";
  const FAKE_JWT =
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  const FAKE_AWS = "AKIAIOSFODNN7EXAMPLE";
  const FAKE_EMAIL = "developer@company.example";
  const HOME = "/home/developer";

  it("scrubs all secret types in a single transcript", () => {
    const raw = `
session transcript:
  env: OPENAI_API_KEY=${FAKE_OPENAI}
  env: ANTHROPIC_API_KEY=${FAKE_ANTHROPIC}
  env: GOOGLE_API_KEY=${FAKE_GOOGLE}
  env: GITHUB_TOKEN=${FAKE_GITHUB}
  env: SLACK_BOT_TOKEN=${FAKE_SLACK}
  response: Authorization: Bearer ${FAKE_JWT}
  iam: ${FAKE_AWS}
  support: ${FAKE_EMAIL} called
  db: postgres://admin:secret123@db.example.com/app
  path: ${HOME}/secret/config.yaml
`;
    const { redacted, counts } = redactTranscript(raw, REDACTION_PATTERNS, HOME);

    // Nothing sensitive survives.
    expect(redacted).not.toContain(FAKE_OPENAI);
    expect(redacted).not.toContain(FAKE_ANTHROPIC);
    expect(redacted).not.toContain(FAKE_GOOGLE);
    expect(redacted).not.toContain(FAKE_GITHUB);
    expect(redacted).not.toContain(FAKE_SLACK);
    expect(redacted).not.toContain(FAKE_JWT);
    expect(redacted).not.toContain(FAKE_AWS);
    expect(redacted).not.toContain(FAKE_EMAIL);
    expect(redacted).not.toContain("secret123");
    expect(redacted).not.toContain(HOME);

    // Counts record the hit counts only — never the matched content.
    expect(counts.anthropic_key).toBeGreaterThanOrEqual(1);
    expect(counts.openai_key).toBeGreaterThanOrEqual(1);
    expect(counts.google_key).toBeGreaterThanOrEqual(1);
    expect(counts.github_pat).toBeGreaterThanOrEqual(1);
    expect(counts.slack_token).toBeGreaterThanOrEqual(1);
    expect(counts.jwt).toBeGreaterThanOrEqual(1);
    expect(counts.aws_access_key).toBe(1);
    expect(counts.email).toBeGreaterThanOrEqual(1);
    expect(counts.url_password).toBe(1);
    expect(counts.home_path).toBeGreaterThanOrEqual(1);

    // Privacy invariant: counts serialization must not contain any secret.
    const blob = JSON.stringify(counts);
    for (const secret of [
      FAKE_OPENAI,
      FAKE_ANTHROPIC,
      FAKE_GOOGLE,
      FAKE_GITHUB,
      FAKE_SLACK,
      FAKE_JWT,
      FAKE_AWS,
      FAKE_EMAIL,
      "secret123",
      HOME,
    ]) {
      expect(blob).not.toContain(secret);
    }
  });

  it("redaction is idempotent (running twice produces the same output)", () => {
    const raw = `key ${FAKE_OPENAI} user ${FAKE_EMAIL}`;
    const once = redactTranscript(raw, REDACTION_PATTERNS, "/home/me").redacted;
    const twice = redactTranscript(once, REDACTION_PATTERNS, "/home/me").redacted;
    expect(twice).toBe(once);
  });

  it("multiple occurrences of the same secret are each redacted", () => {
    const raw = `first ${FAKE_OPENAI} then again ${FAKE_OPENAI} and ${FAKE_OPENAI}`;
    const { redacted, counts } = redactTranscript(raw, REDACTION_PATTERNS, "");
    expect(redacted.match(/\[REDACTED:openai_key\]/g)?.length).toBe(3);
    expect(counts.openai_key).toBe(3);
  });

  it("secret adjacent to text boundary (no whitespace) still redacts", () => {
    const raw = `prefix${FAKE_GITHUB}suffix`;
    const { redacted } = redactTranscript(raw, REDACTION_PATTERNS, "");
    expect(redacted).not.toContain(FAKE_GITHUB);
    expect(redacted).toContain("[REDACTED:github_pat]");
  });

  it("redactor never emits the secret in the redaction marker", () => {
    const raw = `key ${FAKE_OPENAI}`;
    const { redacted } = redactTranscript(raw, REDACTION_PATTERNS, "");
    expect(redacted).toBe("key [REDACTED:openai_key]");
  });

  it("does not over-redact innocent content", () => {
    const raw = "this is just plain english with no secrets in it";
    const { redacted, counts } = redactTranscript(raw, REDACTION_PATTERNS, "/home/me");
    expect(redacted).toBe(raw);
    expect(Object.keys(counts)).toEqual([]);
  });
});
