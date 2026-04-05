import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";
import { registerOnboardCommand } from "#src/cli/onboard.js";

describe("registerOnboardCommand", () => {
  it("registers the onboard command on the program", () => {
    const program = new Command();
    registerOnboardCommand(program);

    const cmd = program.commands.find((c) => c.name() === "onboard");
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toBeTruthy();
  });

  it("writes the onboarding guide to stdout when invoked", async () => {
    const written: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    const program = new Command();
    program.exitOverride(); // prevent process.exit on --help etc.
    registerOnboardCommand(program);

    await program.parseAsync(["node", "codi", "onboard"]);

    process.stdout.write = originalWrite;

    expect(written.length).toBeGreaterThan(0);
    const output = written.join("");
    expect(output).toContain("CODI ONBOARDING GUIDE");
    expect(output).toContain("## ARTIFACT CATALOG");
    expect(output).toContain("## BUILT-IN PRESETS");
    expect(output).toContain("## AGENT PLAYBOOK");
  });
});
