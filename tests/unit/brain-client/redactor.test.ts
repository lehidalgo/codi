import { describe, it, expect } from "vitest";
import { redactTranscript } from "#src/brain-client/redactor.js";
import { REDACTION_PATTERNS } from "#src/brain-client/redactor-patterns.js";

describe("redactTranscript", () => {
  it("redacts every pattern and returns hit counts", () => {
    const raw = "key sk-ant-abcdefghijklmnopqrstuvwxyz1234567890 and email user@example.com";
    const { redacted, counts } = redactTranscript(raw, REDACTION_PATTERNS, "/home/me");
    expect(redacted).not.toContain("user@example.com");
    expect(redacted).not.toContain("sk-ant-abcdefghijklmnopqrstuvwxyz1234567890");
    expect(counts.anthropic_key).toBe(1);
    expect(counts.email).toBe(1);
  });

  it("redacts HOME-relative paths (computed at call site)", () => {
    const raw = "error in /home/me/secret/file.txt";
    const { redacted, counts } = redactTranscript(raw, REDACTION_PATTERNS, "/home/me");
    expect(redacted).not.toContain("/home/me/");
    expect(redacted).toContain("[REDACTED:home_path]");
    expect(counts.home_path).toBe(1);
  });

  it("PRIVACY: counts object never contains matched secret content", () => {
    const secret = "sk-proj-aaaabbbbccccddddeeeeffffgggghhhh1234";
    const raw = `my key is ${secret} please redact`;
    const { counts } = redactTranscript(raw, REDACTION_PATTERNS, "/home/me");
    const serialized = JSON.stringify(counts);
    expect(serialized).not.toContain("sk-proj-");
    expect(serialized).not.toContain("aaaabbbb");
    expect(serialized).not.toContain(secret);
    expect(counts.openai_key).toBe(1);
  });

  it("PRIVACY: counts never contain home-path content", () => {
    const raw = "/home/alice/.ssh/id_rsa";
    const { counts } = redactTranscript(raw, REDACTION_PATTERNS, "/home/alice");
    const serialized = JSON.stringify(counts);
    expect(serialized).not.toContain("alice");
    expect(serialized).not.toContain(".ssh");
    expect(counts.home_path).toBe(1);
  });

  it("empty transcript returns empty counts", () => {
    const { redacted, counts } = redactTranscript("", REDACTION_PATTERNS, "/home/me");
    expect(redacted).toBe("");
    expect(counts).toEqual({});
  });

  it("homeDir='' skips home-path redaction", () => {
    const raw = "/home/me/x is fine";
    const { redacted, counts } = redactTranscript(raw, REDACTION_PATTERNS, "");
    expect(redacted).toBe(raw);
    expect(counts.home_path).toBeUndefined();
  });
});
