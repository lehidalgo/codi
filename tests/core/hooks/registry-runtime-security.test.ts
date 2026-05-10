import { describe, it, expect } from "vitest";
import { SECURITY_REMINDER_HOOK } from "#src/core/hooks/registry/runtime/security-reminder.js";

describe("security-reminder runtime hook artifact", () => {
  it("is a runtime bucket artifact", () => {
    expect(SECURITY_REMINDER_HOOK.bucket).toBe("runtime");
  });

  it("subscribes to PreToolUse only", () => {
    expect(SECURITY_REMINDER_HOOK.events).toEqual(["PreToolUse"]);
  });

  it("default-on, opt-in toggleable", () => {
    expect(SECURITY_REMINDER_HOOK.default).toBe(true);
    expect(SECURITY_REMINDER_HOOK.required).toBe(false);
  });

  it("evaluate returns a verdict for safe content", async () => {
    const v = await SECURITY_REMINDER_HOOK.evaluate({
      bucket: "runtime",
      event: "PreToolUse",
      toolName: "Write",
      filePath: "x.ts",
      content: "ok",
      sessionId: "register-test",
      cwd: process.cwd(),
    });
    expect(v.hookName).toBe("security-reminder");
    expect(v.matched).toBe(false);
  });
});
