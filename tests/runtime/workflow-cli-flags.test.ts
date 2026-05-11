/**
 * CLI-flag adapter coverage for every workflow type. Each builder converts
 * Commander `WorkflowRunFlags` into a typed adaptation, validates enums,
 * and delegates to its resolver. Failure cases must return an `Error`
 * (not throw) so the CLI can format the message.
 */

import { describe, it, expect } from "vitest";
import { buildBugFixAdaptation } from "#src/runtime/workflows/bug-fix/cli-flags.js";
import { buildFeatureAdaptation } from "#src/runtime/workflows/feature/cli-flags.js";
import { buildRefactorAdaptation } from "#src/runtime/workflows/refactor/cli-flags.js";
import { buildMigrationAdaptation } from "#src/runtime/workflows/migration/cli-flags.js";
import { buildProjectAdaptation } from "#src/runtime/workflows/project/cli-flags.js";

describe("buildBugFixAdaptation", () => {
  it("returns undefined when no bug-fix flag supplied", () => {
    expect(buildBugFixAdaptation({})).toBeUndefined();
  });

  it("returns adaptation when --profile=quick is supplied", () => {
    const result = buildBugFixAdaptation({ profile: "quick" });
    expect(result).not.toBeInstanceOf(Error);
    expect(result).toBeDefined();
  });

  it("returns Error on unknown --profile", () => {
    const r = buildBugFixAdaptation({ profile: "yolo" });
    expect(r).toBeInstanceOf(Error);
    expect((r as Error).message).toContain("yolo");
  });

  it("returns Error on unknown --severity", () => {
    const r = buildBugFixAdaptation({ severity: "P9" });
    expect(r).toBeInstanceOf(Error);
    expect((r as Error).message).toContain("P9");
  });

  it("returns Error on unknown --scope", () => {
    const r = buildBugFixAdaptation({ scope: "everywhere" });
    expect(r).toBeInstanceOf(Error);
  });

  it("returns Error on unknown --execute-mode", () => {
    const r = buildBugFixAdaptation({ executeMode: "magic" });
    expect(r).toBeInstanceOf(Error);
  });

  it("threads booleans through unchanged", () => {
    const r = buildBugFixAdaptation({
      profile: "standard",
      reproducerExists: true,
      rootCauseKnown: false,
      grill: true,
      interactive: true,
    });
    expect(r).not.toBeInstanceOf(Error);
  });
});

describe("buildFeatureAdaptation", () => {
  it("returns undefined when no feature flag supplied", () => {
    expect(buildFeatureAdaptation({})).toBeUndefined();
  });

  it("returns adaptation on valid --profile=standard", () => {
    const r = buildFeatureAdaptation({ profile: "standard" });
    expect(r).not.toBeInstanceOf(Error);
  });

  it("returns Error on bad --profile", () => {
    const r = buildFeatureAdaptation({ profile: "nope" });
    expect(r).toBeInstanceOf(Error);
  });

  it("returns Error on bad --complexity", () => {
    const r = buildFeatureAdaptation({ complexity: "huge" });
    expect(r).toBeInstanceOf(Error);
  });

  it("returns Error on bad --scope", () => {
    const r = buildFeatureAdaptation({ scope: "everywhere" });
    expect(r).toBeInstanceOf(Error);
  });

  it("returns Error on bad --execute-mode", () => {
    const r = buildFeatureAdaptation({ executeMode: "magic" });
    expect(r).toBeInstanceOf(Error);
  });

  it("threads tddStrict / designExists / grill / interactive", () => {
    const r = buildFeatureAdaptation({
      profile: "deep",
      tddStrict: true,
      designExists: true,
      grill: true,
      interactive: false,
    });
    expect(r).not.toBeInstanceOf(Error);
  });
});

describe("buildRefactorAdaptation", () => {
  it("returns undefined when no refactor flag supplied", () => {
    expect(buildRefactorAdaptation({})).toBeUndefined();
  });

  it("returns adaptation on valid --kind=deadcode", () => {
    const r = buildRefactorAdaptation({ kind: "deadcode" });
    expect(r).not.toBeInstanceOf(Error);
  });

  it("returns Error on bad --profile", () => {
    const r = buildRefactorAdaptation({ profile: "nope" });
    expect(r).toBeInstanceOf(Error);
  });

  it("returns Error on bad --kind", () => {
    const r = buildRefactorAdaptation({ kind: "magic" });
    expect(r).toBeInstanceOf(Error);
  });

  it("returns Error on bad --scope", () => {
    const r = buildRefactorAdaptation({ scope: "huge" });
    expect(r).toBeInstanceOf(Error);
  });

  it("returns Error on bad --execute-mode", () => {
    const r = buildRefactorAdaptation({ executeMode: "magic" });
    expect(r).toBeInstanceOf(Error);
  });
});

describe("buildMigrationAdaptation", () => {
  it("returns undefined when no migration flag supplied", () => {
    expect(buildMigrationAdaptation({})).toBeUndefined();
  });

  it("returns adaptation on valid --risk-level=medium", () => {
    const r = buildMigrationAdaptation({ riskLevel: "medium" });
    expect(r).not.toBeInstanceOf(Error);
  });

  it("returns Error on bad --profile", () => {
    const r = buildMigrationAdaptation({ profile: "nope" });
    expect(r).toBeInstanceOf(Error);
  });

  it("returns Error on bad --risk-level", () => {
    const r = buildMigrationAdaptation({ riskLevel: "catastrophic" });
    expect(r).toBeInstanceOf(Error);
  });

  it("returns Error on bad --execute-mode", () => {
    const r = buildMigrationAdaptation({ executeMode: "magic" });
    expect(r).toBeInstanceOf(Error);
  });

  it("threads rollbackTested through", () => {
    const r = buildMigrationAdaptation({
      profile: "data",
      rollbackTested: true,
    });
    expect(r).not.toBeInstanceOf(Error);
  });
});

describe("buildProjectAdaptation", () => {
  it("returns undefined when no project flag supplied", () => {
    expect(buildProjectAdaptation({})).toBeUndefined();
  });

  it("returns adaptation on valid --mode=greenfield", () => {
    const r = buildProjectAdaptation({ mode: "greenfield" });
    expect(r).not.toBeInstanceOf(Error);
  });

  it("returns Error on bad --profile", () => {
    const r = buildProjectAdaptation({ profile: "nope" });
    expect(r).toBeInstanceOf(Error);
  });

  it("returns Error on bad --mode", () => {
    const r = buildProjectAdaptation({ mode: "magic" });
    expect(r).toBeInstanceOf(Error);
  });

  it("threads noSheet through", () => {
    const r = buildProjectAdaptation({ profile: "no-sheet", noSheet: true });
    expect(r).not.toBeInstanceOf(Error);
  });
});
