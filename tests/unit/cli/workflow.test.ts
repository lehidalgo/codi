/**
 * F9 — `codi workflow` subcommand surface tests.
 *
 * Verifies the registrar wires every subcommand without throwing, and that
 * each subcommand carries the expected required flags. End-to-end behavior
 * is covered indirectly by the runtime cli-handlers tests; these are the
 * shape contract tests.
 */

import { describe, it, expect } from "vitest";
import { Command } from "commander";
import { registerWorkflowCommand } from "#src/cli/workflow.js";

function buildProgram(): Command {
  const program = new Command();
  // Mirror the global flags used by handleOutput so tests don't blow up.
  program
    .option("-j, --json", "Output as JSON")
    .option("-v, --verbose", "Verbose output")
    .option("-q, --quiet", "Suppress non-essential output")
    .option("--no-color", "Disable colored output");
  registerWorkflowCommand(program);
  return program;
}

function findCommand(program: Command, ...path: string[]): Command | undefined {
  let cur: Command | undefined = program;
  for (const seg of path) {
    cur = cur?.commands.find((c) => c.name() === seg);
    if (!cur) return undefined;
  }
  return cur;
}

describe("registerWorkflowCommand — subcommand surface", () => {
  it("exposes a top-level `workflow` command", () => {
    const program = buildProgram();
    const wf = findCommand(program, "workflow");
    expect(wf).toBeDefined();
    expect(wf?.description()).toContain("Brain-backed workflow lifecycle");
  });

  it("registers every documented subcommand", () => {
    const program = buildProgram();
    const wf = findCommand(program, "workflow");
    const names = wf?.commands.map((c) => c.name()).sort() ?? [];
    expect(names).toEqual(
      [
        "abandon",
        "advance",
        "convert",
        "elevate",
        "handover",
        "phase-ref",
        "quick",
        "recover",
        "run",
        "scope",
        "stats",
        "status",
        "transition",
      ].sort(),
    );
  });

  it("scope group registers propose / approve / reject", () => {
    const program = buildProgram();
    const scope = findCommand(program, "workflow", "scope");
    const names = scope?.commands.map((c) => c.name()).sort() ?? [];
    expect(names).toEqual(["approve", "propose", "reject"]);
  });

  it("`run` requires <type> and <task> positional args", () => {
    const program = buildProgram();
    const run = findCommand(program, "workflow", "run");
    const usage = run?.usage() ?? "";
    expect(usage).toContain("<type>");
    expect(usage).toContain("<task>");
  });

  it("`abandon` requires --reason", () => {
    const program = buildProgram();
    const abandon = findCommand(program, "workflow", "abandon");
    const opts = abandon?.options ?? [];
    const reason = opts.find((o) => o.long === "--reason");
    expect(reason).toBeDefined();
    expect(reason?.required).toBe(true);
  });

  it("`scope propose` requires --file and --reason", () => {
    const program = buildProgram();
    const propose = findCommand(program, "workflow", "scope", "propose");
    const opts = propose?.options ?? [];
    const file = opts.find((o) => o.long === "--file");
    const reason = opts.find((o) => o.long === "--reason");
    expect(file?.required).toBe(true);
    expect(reason?.required).toBe(true);
  });

  it("`handover` requires --to and --reason", () => {
    const program = buildProgram();
    const ho = findCommand(program, "workflow", "handover");
    const opts = ho?.options ?? [];
    expect(opts.find((o) => o.long === "--to")?.required).toBe(true);
    expect(opts.find((o) => o.long === "--reason")?.required).toBe(true);
  });

  it("`transition` exposes mutually-exclusive intent flags", () => {
    const program = buildProgram();
    const t = findCommand(program, "workflow", "transition");
    const longs = (t?.options ?? []).map((o) => o.long);
    expect(longs).toEqual(expect.arrayContaining(["--to", "--approve", "--reject", "--reason"]));
  });

  it("`elevate` exposes the elevation flag set", () => {
    const program = buildProgram();
    const e = findCommand(program, "workflow", "elevate");
    const longs = (e?.options ?? []).map((o) => o.long);
    expect(longs).toEqual(
      expect.arrayContaining(["--trigger", "--reason", "--approve", "--reject"]),
    );
  });
});
