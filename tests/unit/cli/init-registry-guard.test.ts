import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("#src/core/scaffolder/template-registry-check.js", () => ({
  checkTemplateRegistry: vi.fn().mockReturnValue([]),
}));

import { checkTemplateRegistry } from "#src/core/scaffolder/template-registry-check.js";
import { initHandler } from "#src/cli/init.js";

const mockCheckRegistry = vi.mocked(checkTemplateRegistry);

describe("initHandler — registry check guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRegistry.mockReturnValue([]);
  });

  it("calls process.exit(1) when registry has errors", async () => {
    mockCheckRegistry.mockReturnValueOnce([
      'rule "codi-broken": failed to load or empty content',
    ]);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number) => {
        throw new Error("process.exit");
      });

    await expect(
      initHandler("/tmp/test-project", { force: false }),
    ).rejects.toThrow("process.exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
