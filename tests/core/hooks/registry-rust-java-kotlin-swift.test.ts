import { describe, it, expect } from "vitest";
import { RUST_HOOKS } from "#src/core/hooks/registry/rust.js";
import { JAVA_HOOKS } from "#src/core/hooks/registry/java.js";
import { KOTLIN_HOOKS } from "#src/core/hooks/registry/kotlin.js";
import { SWIFT_HOOKS } from "#src/core/hooks/registry/swift.js";
import { isGitHook } from "#src/core/hooks/hook-artifact.js";

const allRegistries = [
  { name: "rust", arr: RUST_HOOKS },
  { name: "java", arr: JAVA_HOOKS },
  { name: "kotlin", arr: KOTLIN_HOOKS },
  { name: "swift", arr: SWIFT_HOOKS },
];

describe("rust / java / kotlin / swift registries shape", () => {
  for (const { name, arr } of allRegistries) {
    it(`${name}: every entry is a valid GitHookArtifact`, () => {
      for (const h of arr) {
        expect(h.bucket).toBe("git");
        expect(isGitHook(h)).toBe(true);
        expect(h.description.length).toBeGreaterThan(0);
        expect(h.version).toBe("1");
        expect(h.managed_by).toBe("codi");
        expect(h.default).toBe(true);
      }
    });
  }

  it("counts match expectations", () => {
    expect(RUST_HOOKS).toHaveLength(2);
    expect(JAVA_HOOKS).toHaveLength(2);
    expect(KOTLIN_HOOKS).toHaveLength(2);
    expect(SWIFT_HOOKS).toHaveLength(2);
  });
});
