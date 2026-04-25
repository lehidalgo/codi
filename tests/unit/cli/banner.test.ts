import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printWelcomeBanner, printCompactBanner } from "#src/cli/banner.js";

describe("banner", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let output: string;

  beforeEach(() => {
    output = "";
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  describe("printWelcomeBanner", () => {
    it("writes ASCII art to stdout on wide terminals", () => {
      Object.defineProperty(process.stdout, "columns", {
        value: 80,
        configurable: true,
      });

      printWelcomeBanner({
        detectedStack: ["typescript"],
        detectedAgents: ["claude-code"],
      });

      expect(output).toContain("██");
      expect(output).toContain("Stack");
      expect(output).toContain("typescript");
      expect(output).toContain("claude-code");
    });

    it("includes version string", () => {
      Object.defineProperty(process.stdout, "columns", {
        value: 80,
        configurable: true,
      });

      printWelcomeBanner({});

      expect(output).toMatch(/v\d+\.\d+\.\d+/);
    });

    it("shows 'none detected' when stack and agents are empty", () => {
      Object.defineProperty(process.stdout, "columns", {
        value: 80,
        configurable: true,
      });

      printWelcomeBanner({ detectedStack: [], detectedAgents: [] });

      expect(output).toContain("none detected");
    });

    it("renders inside a rounded box on wide terminals", () => {
      Object.defineProperty(process.stdout, "columns", {
        value: 120,
        configurable: true,
      });

      printWelcomeBanner({
        detectedStack: ["typescript"],
        detectedAgents: ["claude-code"],
      });

      // Top corners + bottom corners + vertical sides
      expect(output).toContain("╭");
      expect(output).toContain("╮");
      expect(output).toContain("╰");
      expect(output).toContain("╯");
      expect(output).toContain("│");
      expect(output).toContain("─");
    });

    it("falls back to text header on narrow terminals", () => {
      Object.defineProperty(process.stdout, "columns", {
        value: 40,
        configurable: true,
      });

      printWelcomeBanner({ detectedStack: ["python"] });

      expect(output).not.toContain("██████");
      expect(output).toContain("Codi");
      expect(output).toContain("python");
    });

    it("shows subtitle instead of status lines when no stack/agents provided", () => {
      Object.defineProperty(process.stdout, "columns", {
        value: 80,
        configurable: true,
      });

      printWelcomeBanner({ subtitle: "Command Center" });

      expect(output).toContain("██");
      expect(output).toContain("Command Center");
      expect(output).not.toContain("Stack");
      expect(output).not.toContain("Agents");
    });
  });

  describe("printCompactBanner", () => {
    it("writes styled header with title", () => {
      printCompactBanner("Command Center");

      expect(output).toContain("Codi");
      expect(output).toContain("Command Center");
    });
  });
});
