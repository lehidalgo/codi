import { describe, it, expect } from "vitest";
import { REDACTION_PATTERNS } from "#src/brain-client/redactor-patterns.js";

describe("REDACTION_PATTERNS", () => {
  it("each pattern has name + regex + replacement", () => {
    for (const p of REDACTION_PATTERNS) {
      expect(typeof p.name).toBe("string");
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.regex).toBeInstanceOf(RegExp);
      expect(typeof p.replacement).toBe("string");
      expect(p.replacement).toContain("[REDACTED");
    }
  });

  const cases: Array<[string, string]> = [
    ["sk-proj-abcdefghijklmnopqrstuvwxyz1234567890", "openai_key"],
    ["sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890", "anthropic_key"],
    ["AIzaSyD1234567890abcdefghijklmnopqrstuvw", "google_key"],
    ["ghp_1234567890abcdefghijklmnopqrstuv1234", "github_pat"],
    ["xoxb-DEMO0000-DEMO0000-NOTREALslacktokensample", "slack_token"],
    ["AKIAIOSFODNN7EXAMPLE", "aws_access_key"],
    [
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      "jwt",
    ],
    ["https://user:pass@host.example.com", "url_password"],
    ["someone@example.com", "email"],
  ];

  it.each(cases)("%s matches %s pattern", (sample, patternName) => {
    const p = REDACTION_PATTERNS.find((x) => x.name === patternName);
    expect(p).toBeDefined();
    const re = new RegExp(p!.regex.source, p!.regex.flags.replace("g", ""));
    expect(re.test(sample)).toBe(true);
  });
});
