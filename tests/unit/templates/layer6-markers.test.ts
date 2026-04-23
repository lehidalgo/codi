import { describe, it, expect } from "vitest";
import { template as brainstorm } from "#src/templates/skills/brainstorming/index.js";
import { template as branchFinish } from "#src/templates/skills/branch-finish/index.js";
import { template as debugging } from "#src/templates/skills/debugging/index.js";

describe("Layer 6 skill-completion markers", () => {
  const cases: Array<[string, string]> = [
    ["brainstorming", brainstorm],
    ["branch-finish", branchFinish],
    ["debugging", debugging],
  ];

  it.each(cases)(
    "%s template instructs agent to emit CODI-DECISION on completion",
    (_name, tpl) => {
      expect(tpl).toContain("<CODI-DECISION@v1>");
      expect(tpl).toContain("</CODI-DECISION@v1>");
    },
  );
});
