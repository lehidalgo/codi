import { describe, it, expect, vi, afterEach } from "vitest";
import { printLegend } from "#src/cli/wizard-legend.js";

describe("printLegend", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes a multi-line boxed legend to stdout without throwing", () => {
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    expect(() => printLegend()).not.toThrow();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const output = writes.join("");
    // Boxed structure: ┌ top, │ sides, └ bottom
    expect(output).toContain("┌");
    expect(output).toContain("│");
    expect(output).toContain("└");
    // Hint text content
    expect(output).toContain("space toggle");
    expect(output).toContain("enter confirm");
  });
});
