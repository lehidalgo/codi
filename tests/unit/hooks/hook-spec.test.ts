import { describe, it, expectTypeOf } from "vitest";
import type { HookSpec, PreCommitEmission } from "#src/core/hooks/hook-spec.js";

describe("HookSpec types", () => {
  it("HookSpec requires both shell and preCommit emissions", () => {
    const spec: HookSpec = {
      name: "sample",
      language: "typescript",
      category: "lint",
      files: "**/*.ts",
      stages: ["pre-commit"],
      required: false,
      shell: {
        command: "npx eslint --fix",
        passFiles: true,
        modifiesFiles: true,
        toolBinary: "eslint",
      },
      preCommit: {
        kind: "upstream",
        repo: "https://github.com/example/eslint",
        rev: "v1.0.0",
        id: "eslint",
      },
      installHint: { command: "npm i -D eslint" },
    };
    expectTypeOf(spec).toEqualTypeOf<HookSpec>();
  });

  it("PreCommitEmission discriminates upstream vs local", () => {
    const upstream: PreCommitEmission = {
      kind: "upstream",
      repo: "https://github.com/x/y",
      rev: "v1",
      id: "foo",
    };
    const local: PreCommitEmission = {
      kind: "local",
      entry: "node script.mjs",
      language: "system",
    };
    expectTypeOf(upstream).toEqualTypeOf<PreCommitEmission>();
    expectTypeOf(local).toEqualTypeOf<PreCommitEmission>();
  });
});
