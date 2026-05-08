import { describe, it, expect } from "vitest";
import { classifyChange } from "#src/runtime/classifier.js";
import {
  computeDiffStats,
  diffOnlyAddsImports,
  diffTouchesExports,
  isAdrFile,
  isContextFile,
  isMigrationFile,
  isPackageManifest,
  isSchemaFile,
  isTestFile,
} from "#src/runtime/classifier-rules.js";

describe("classifier rules — file kind detection", () => {
  it("detects test files in multiple conventions", () => {
    expect(isTestFile("src/foo.test.ts")).toBe(true);
    expect(isTestFile("src/foo.spec.tsx")).toBe(true);
    expect(isTestFile("__tests__/foo.ts")).toBe(true);
    expect(isTestFile("tests/foo.ts")).toBe(true);
    expect(isTestFile("test_foo.py")).toBe(true);
    expect(isTestFile("foo_test.py")).toBe(true);
    expect(isTestFile("src/foo.ts")).toBe(false);
    expect(isTestFile("src/test-helpers.ts")).toBe(false);
  });

  it("detects package manifest files", () => {
    expect(isPackageManifest("package.json")).toBe(true);
    expect(isPackageManifest("pnpm-lock.yaml")).toBe(true);
    expect(isPackageManifest("yarn.lock")).toBe(true);
    expect(isPackageManifest("Cargo.toml")).toBe(true);
    expect(isPackageManifest("pyproject.toml")).toBe(true);
    expect(isPackageManifest("uv.lock")).toBe(true);
    expect(isPackageManifest("go.mod")).toBe(true);
    expect(isPackageManifest("src/package.json")).toBe(true);
    expect(isPackageManifest("src/foo.json")).toBe(false);
  });

  it("detects migration files", () => {
    expect(isMigrationFile("migrations/001_init.sql")).toBe(true);
    expect(isMigrationFile("db/migrations/x.ts")).toBe(true);
    expect(isMigrationFile("prisma/migrations/foo.sql")).toBe(true);
    expect(isMigrationFile("alembic/versions/abc.py")).toBe(true);
    expect(isMigrationFile("src/foo.sql")).toBe(true);
    expect(isMigrationFile("src/foo.ts")).toBe(false);
  });

  it("detects ADR files", () => {
    expect(isAdrFile("docs/adr/0001-foo.md")).toBe(true);
    expect(isAdrFile("docs/adr/README.md")).toBe(true);
    expect(isAdrFile("docs/adr/sub/foo.md")).toBe(false);
    expect(isAdrFile("docs/foo.md")).toBe(false);
  });

  it("detects CONTEXT.md", () => {
    expect(isContextFile("docs/CONTEXT.md")).toBe(true);
    expect(isContextFile("docs/context.md")).toBe(true);
    expect(isContextFile("CONTEXT.md")).toBe(false);
  });

  it("detects schema files", () => {
    expect(isSchemaFile("schemas/event.schema.json")).toBe(true);
    expect(isSchemaFile("src/event.schema.json")).toBe(true);
    expect(isSchemaFile("prisma/schema.prisma")).toBe(true);
    expect(isSchemaFile("src/schemas/foo.ts")).toBe(true);
    expect(isSchemaFile("src/foo.ts")).toBe(false);
  });
});

describe("classifier rules — diff shape detection", () => {
  it("detects diff that only adds imports", () => {
    const diff = computeDiffStats(
      "",
      `import { foo } from "./bar";\nimport { baz } from "./qux";\n`,
    );
    expect(diffOnlyAddsImports(diff)).toBe(true);
  });

  it("rejects diff with non-import additions", () => {
    const diff = computeDiffStats("", `import { foo } from "./bar";\nconst x = foo();\n`);
    expect(diffOnlyAddsImports(diff)).toBe(false);
  });

  it("detects diff that touches exports", () => {
    const diff = computeDiffStats("", `export function newFoo() { return 1; }\n`);
    expect(diffTouchesExports(diff)).toBe(true);
  });

  it("detects diff that adds a class export", () => {
    const diff = computeDiffStats("", `export class Bar {}\n`);
    expect(diffTouchesExports(diff)).toBe(true);
  });

  it("detects export changes via removed lines (e.g., deleted public function)", () => {
    const diff = computeDiffStats(`export function deletedFn() {}\n`, ``);
    expect(diffTouchesExports(diff)).toBe(true);
  });

  it("does not flag pure-internal changes as export modification", () => {
    const diff = computeDiffStats(
      `function helper() { return 1; }\n`,
      `function helper() { return 2; }\n`,
    );
    expect(diffTouchesExports(diff)).toBe(false);
  });
});

describe("classifyChange — full classifier", () => {
  const baseInput = (overrides: Partial<Parameters<typeof classifyChange>[0]>) => ({
    file_path: "src/foo.ts",
    old_content: "",
    new_content: "",
    files_in_plan: [] as string[],
    ...overrides,
  });

  it("flags test files as scope-expansion (high)", () => {
    const result = classifyChange(
      baseInput({
        file_path: "src/foo.test.ts",
        new_content: "test('x', () => {});\n",
      }),
    );
    expect(result.category).toBe("scope-expansion");
    expect(result.confidence).toBe("high");
  });

  it("flags package.json as scope-expansion", () => {
    const result = classifyChange(
      baseInput({
        file_path: "package.json",
        old_content: "{}",
        new_content: '{"name":"x"}',
      }),
    );
    expect(result.category).toBe("scope-expansion");
    expect(result.suggested_elevation).toBeNull();
  });

  it("flags migration with elevation suggestion", () => {
    const result = classifyChange(
      baseInput({
        file_path: "migrations/001_init.sql",
        new_content: "CREATE TABLE x();",
      }),
    );
    expect(result.category).toBe("scope-expansion");
    expect(result.suggested_elevation?.workflow_type).toBe("migration");
  });

  it("flags ADR with elevation to refactor", () => {
    const result = classifyChange(
      baseInput({
        file_path: "docs/adr/0008-x.md",
        new_content: "# ADR\n",
      }),
    );
    expect(result.category).toBe("scope-expansion");
    expect(result.suggested_elevation?.workflow_type).toBe("refactor");
  });

  it("flags CONTEXT.md as scope-expansion", () => {
    const result = classifyChange(
      baseInput({
        file_path: "docs/CONTEXT.md",
        new_content: "# Context\n",
      }),
    );
    expect(result.category).toBe("scope-expansion");
  });

  it("permits files in plan as incidental", () => {
    const result = classifyChange(
      baseInput({
        file_path: "src/in-plan.ts",
        new_content: "const x = 1;",
        files_in_plan: ["src/in-plan.ts"],
      }),
    );
    expect(result.category).toBe("incidental");
    expect(result.reason).toContain("plan scope");
  });

  it("flags export changes outside plan as scope-expansion", () => {
    const result = classifyChange(
      baseInput({
        file_path: "src/utils.ts",
        new_content: "export function newFn() {}\n",
      }),
    );
    expect(result.category).toBe("scope-expansion");
    expect(result.reason).toContain("public exports");
  });

  it("treats import-only additions as incidental high", () => {
    const result = classifyChange(
      baseInput({
        file_path: "src/utils.ts",
        old_content: "function existing() {}\n",
        new_content: 'import { x } from "./x";\nfunction existing() {}\n',
      }),
    );
    expect(result.category).toBe("incidental");
    expect(result.confidence).toBe("high");
  });

  it("auto-escalates type-assertion-only changes (low confidence) to scope-expansion", () => {
    const result = classifyChange(
      baseInput({
        file_path: "src/utils.ts",
        old_content: "const x = foo as string;",
        new_content: "const x = foo as number;",
      }),
    );
    expect(result.category).toBe("scope-expansion");
    expect(result.confidence).toBe("low");
    expect(result.reason).toContain("auto-escalated");
  });

  it("auto-escalates small diffs without new identifiers (low confidence)", () => {
    const result = classifyChange(
      baseInput({
        file_path: "src/utils.ts",
        old_content: "function existing() { return 1; }",
        new_content: "function existing() { return 2; }",
      }),
    );
    expect(result.category).toBe("scope-expansion");
    expect(result.confidence).toBe("low");
  });

  it("flags larger non-export changes as scope-expansion (conservative default)", () => {
    const result = classifyChange(
      baseInput({
        file_path: "src/utils.ts",
        old_content: "",
        new_content:
          "function newOne() { return 1; }\nfunction newTwo() { return 2; }\nfunction newThree() { return 3; }\nfunction newFour() { return 4; }\nfunction newFive() { return 5; }\nfunction newSix() { return 6; }",
      }),
    );
    expect(result.category).toBe("scope-expansion");
  });

  it("treats no-change as incidental", () => {
    const result = classifyChange(
      baseInput({
        file_path: "src/foo.ts",
        old_content: "x",
        new_content: "x",
      }),
    );
    expect(result.category).toBe("incidental");
    expect(result.diff_stats.lines_changed).toBe(0);
  });

  it("never returns confidence: low without auto-escalating to scope-expansion", () => {
    // Property: if confidence is low, category MUST be scope-expansion.
    const samples = [
      { file_path: "a.ts", old_content: "x as A", new_content: "x as B" },
      { file_path: "b.ts", old_content: "f()", new_content: "g()" },
    ];
    for (const s of samples) {
      const result = classifyChange({ ...s, files_in_plan: [] });
      if (result.confidence === "low") {
        expect(result.category).toBe("scope-expansion");
      }
    }
  });
});
