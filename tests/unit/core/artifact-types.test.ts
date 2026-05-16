/**
 * CORE-018 — type-level + runtime coverage for the artifact-taxonomy
 * tuples and guards exported from `src/core/artifact-types.ts`.
 *
 * The four unions (ArtifactType, CapabilityType, LedgerEntryType,
 * CapturedArtifactType) each ship with a `as const satisfies readonly X[]`
 * tuple companion. Adding a new union member without extending the tuple
 * fails compile; these tests pin the runtime side of that contract and
 * use `expectTypeOf` to lock the type relationships.
 */

import { describe, it, expect, expectTypeOf } from "vitest";
import {
  ARTIFACT_TYPES,
  CAPABILITY_TYPES,
  CAPTURED_ARTIFACT_TYPES,
  LEDGER_ENTRY_TYPES,
  isArtifactType,
  isCapabilityType,
  isCapturedArtifactType,
  isLedgerEntryType,
  artifactRelativePath,
  type ArtifactType,
  type CapabilityType,
  type CapturedArtifactType,
  type LedgerEntryType,
} from "#src/core/artifact-types.js";

describe("ARTIFACT_TYPES tuple ↔ ArtifactType union", () => {
  it("contains exactly 4 base kinds in declared order", () => {
    expect(ARTIFACT_TYPES).toEqual(["rule", "skill", "agent", "mcp-server"]);
  });

  it("typeof tuple[number] equals ArtifactType", () => {
    expectTypeOf<(typeof ARTIFACT_TYPES)[number]>().toEqualTypeOf<ArtifactType>();
  });
});

describe("CAPABILITY_TYPES tuple ↔ CapabilityType union", () => {
  it("extends ARTIFACT_TYPES with hook + slash-command", () => {
    expect(CAPABILITY_TYPES).toEqual([
      "rule",
      "skill",
      "agent",
      "mcp-server",
      "hook",
      "slash-command",
    ]);
  });

  it("typeof tuple[number] equals CapabilityType", () => {
    expectTypeOf<(typeof CAPABILITY_TYPES)[number]>().toEqualTypeOf<CapabilityType>();
  });

  it("every ArtifactType is also a CapabilityType", () => {
    for (const t of ARTIFACT_TYPES) {
      expect(isCapabilityType(t)).toBe(true);
    }
  });
});

describe("LEDGER_ENTRY_TYPES tuple ↔ LedgerEntryType union", () => {
  it("extends ARTIFACT_TYPES with instruction + settings", () => {
    expect(LEDGER_ENTRY_TYPES).toEqual([
      "rule",
      "skill",
      "agent",
      "mcp-server",
      "instruction",
      "settings",
    ]);
  });

  it("typeof tuple[number] equals LedgerEntryType", () => {
    expectTypeOf<(typeof LEDGER_ENTRY_TYPES)[number]>().toEqualTypeOf<LedgerEntryType>();
  });
});

describe("CAPTURED_ARTIFACT_TYPES tuple ↔ CapturedArtifactType union", () => {
  it("uses legacy `command` (not slash-command) and omits mcp-server", () => {
    expect(CAPTURED_ARTIFACT_TYPES).toEqual(["rule", "skill", "agent", "command"]);
  });

  it("typeof tuple[number] equals CapturedArtifactType", () => {
    expectTypeOf<
      (typeof CAPTURED_ARTIFACT_TYPES)[number]
    >().toEqualTypeOf<CapturedArtifactType>();
  });

  it("does NOT include `mcp-server` (no capture site emits it)", () => {
    expect(CAPTURED_ARTIFACT_TYPES).not.toContain("mcp-server");
  });

  it("uses `command` rather than `slash-command` (brain-DB historical)", () => {
    expect(CAPTURED_ARTIFACT_TYPES).toContain("command");
    expect(CAPTURED_ARTIFACT_TYPES).not.toContain("slash-command");
  });
});

describe("type guards", () => {
  describe("isArtifactType", () => {
    it("accepts every member of ARTIFACT_TYPES", () => {
      for (const t of ARTIFACT_TYPES) expect(isArtifactType(t)).toBe(true);
    });

    it("rejects capability-only members (hook, slash-command)", () => {
      expect(isArtifactType("hook")).toBe(false);
      expect(isArtifactType("slash-command")).toBe(false);
    });

    it("rejects ledger-only members (instruction, settings)", () => {
      expect(isArtifactType("instruction")).toBe(false);
      expect(isArtifactType("settings")).toBe(false);
    });

    it("rejects non-strings and unknown literals", () => {
      expect(isArtifactType("")).toBe(false);
      expect(isArtifactType(null)).toBe(false);
      expect(isArtifactType(undefined)).toBe(false);
      expect(isArtifactType(42)).toBe(false);
      expect(isArtifactType("RULE")).toBe(false); // case-sensitive
    });
  });

  describe("isCapabilityType", () => {
    it("accepts every member of CAPABILITY_TYPES", () => {
      for (const t of CAPABILITY_TYPES) expect(isCapabilityType(t)).toBe(true);
    });

    it("rejects ledger-only members (instruction, settings)", () => {
      expect(isCapabilityType("instruction")).toBe(false);
      expect(isCapabilityType("settings")).toBe(false);
    });

    it("rejects legacy capture `command` (canonical is slash-command)", () => {
      expect(isCapabilityType("command")).toBe(false);
    });
  });

  describe("isLedgerEntryType", () => {
    it("accepts every member of LEDGER_ENTRY_TYPES", () => {
      for (const t of LEDGER_ENTRY_TYPES) expect(isLedgerEntryType(t)).toBe(true);
    });

    it("rejects capability-only members (hook, slash-command)", () => {
      expect(isLedgerEntryType("hook")).toBe(false);
      expect(isLedgerEntryType("slash-command")).toBe(false);
    });
  });

  describe("isCapturedArtifactType", () => {
    it("accepts every member of CAPTURED_ARTIFACT_TYPES", () => {
      for (const t of CAPTURED_ARTIFACT_TYPES) expect(isCapturedArtifactType(t)).toBe(true);
    });

    it("rejects mcp-server (no capture site emits it)", () => {
      expect(isCapturedArtifactType("mcp-server")).toBe(false);
    });

    it("rejects slash-command (capture uses legacy `command`)", () => {
      expect(isCapturedArtifactType("slash-command")).toBe(false);
    });
  });
});

describe("artifactRelativePath", () => {
  it.each([
    ["rule", "x", "rules/x.md"],
    ["skill", "tdd", "skills/tdd/SKILL.md"],
    ["agent", "code-reviewer", "agents/code-reviewer.md"],
    ["mcp-server", "memory", "mcp-servers/memory.yaml"],
  ] as const)("layout for %s/%s → %s", (type, name, expected) => {
    expect(artifactRelativePath(type, name)).toBe(expected);
  });
});
