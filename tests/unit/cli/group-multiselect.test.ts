import { describe, it, expect, vi, beforeEach } from "vitest";

const promptMock = vi.fn();
let capturedOptions: {
  render: () => string;
  validate: (value: string[] | undefined) => string | undefined;
} | null = null;

vi.mock("@clack/core", () => ({
  GroupMultiSelectPrompt: class {
    constructor(options: typeof capturedOptions) {
      capturedOptions = options;
    }

    prompt() {
      return promptMock();
    }
  },
}));

vi.mock("@clack/prompts", () => ({
  S_BAR: "|",
  S_BAR_END: "\\",
  S_CHECKBOX_ACTIVE: "[*]",
  S_CHECKBOX_INACTIVE: "[ ]",
  S_CHECKBOX_SELECTED: "[+]",
  symbol: (state: string) => `<${state}>`,
}));

import { groupMultiselect } from "#src/cli/group-multiselect.js";

describe("groupMultiselect", () => {
  beforeEach(() => {
    promptMock.mockReset();
    promptMock.mockResolvedValue(["alpha"]);
    capturedOptions = null;
  });

  it("returns the prompt result and validates required selections", async () => {
    const result = await groupMultiselect({
      message: "Select items",
      options: { Group: [{ value: "alpha", label: "Alpha" }] },
      required: true,
    });

    expect(result).toEqual(["alpha"]);
    expect(capturedOptions).not.toBeNull();
    expect(capturedOptions?.validate([])).toContain("Please select at least one option");
    expect(capturedOptions?.validate(["alpha"])).toBeUndefined();
  });

  it("shows hints only for the active item", async () => {
    await groupMultiselect({
      message: "Select items",
      options: { Group: [{ value: "alpha", label: "Alpha", hint: "Helpful hint" }] },
    });

    const render = capturedOptions?.render;
    expect(render).toBeDefined();

    const activeOutput = render!.call({
      state: "active",
      value: [],
      cursor: 1,
      error: "",
      options: [
        { value: "Group", group: true, label: "Group" },
        { value: "alpha", group: "Group", label: "Alpha", hint: "Helpful hint" },
      ],
      isGroupSelected: () => false,
    });
    expect(activeOutput).toContain("Helpful hint");

    const selectedOutput = render!.call({
      state: "active",
      value: ["alpha"],
      cursor: 0,
      error: "",
      options: [
        { value: "Group", group: true, label: "Group" },
        { value: "alpha", group: "Group", label: "Alpha", hint: "Helpful hint" },
      ],
      isGroupSelected: () => false,
    });
    expect(selectedOutput).not.toContain("Helpful hint");
  });
});
