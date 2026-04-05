import { describe, it, expect, vi, beforeEach } from "vitest";

const promptMock = vi.fn();
let capturedOptions: {
  render: () => string;
  validate: (value: string[] | undefined) => string | undefined;
} | null = null;

type KeyHandler = (char: string | undefined, key: { name: string }) => void;
type CursorHandler = (action: string) => void;

const keyHandlers: KeyHandler[] = [];
const cursorHandlers: CursorHandler[] = [];

const mockPromptInstance = {
  cursor: 0,
  value: [] as string[],
  options: [] as Array<{ value: string; group: string | boolean; label?: string }>,
  on(event: string, handler: KeyHandler | CursorHandler) {
    if (event === "key") keyHandlers.push(handler as KeyHandler);
    if (event === "cursor") cursorHandlers.push(handler as CursorHandler);
  },
  prompt: promptMock,
};

vi.mock("@clack/core", () => ({
  getRows: () => 40,
  GroupMultiSelectPrompt: class {
    cursor = mockPromptInstance.cursor;
    options = mockPromptInstance.options;

    constructor(options: typeof capturedOptions) {
      capturedOptions = options;
      mockPromptInstance.cursor = 0;
    }

    on(event: string, handler: KeyHandler | CursorHandler) {
      mockPromptInstance.on(event, handler);
      Object.defineProperty(this, "cursor", {
        get: () => mockPromptInstance.cursor,
        set: (v: number) => {
          mockPromptInstance.cursor = v;
        },
        configurable: true,
      });
      Object.defineProperty(this, "value", {
        get: () => mockPromptInstance.value,
        set: (v: string[]) => {
          mockPromptInstance.value = v;
        },
        configurable: true,
      });
      Object.defineProperty(this, "options", {
        get: () => mockPromptInstance.options,
        configurable: true,
      });
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

function makeOptions() {
  return [
    { value: "Group", group: true as const, label: "Group" },
    { value: "alpha", group: "Group", label: "Alpha" },
    { value: "beta", group: "Group", label: "Beta" },
  ];
}

describe("groupMultiselect", () => {
  beforeEach(() => {
    promptMock.mockReset();
    promptMock.mockResolvedValue(["alpha"]);
    capturedOptions = null;
    keyHandlers.length = 0;
    cursorHandlers.length = 0;
    mockPromptInstance.cursor = 0;
    mockPromptInstance.value = [];
    mockPromptInstance.options = [];
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

  it("renders collapse indicator ▼ on expanded group headers", async () => {
    await groupMultiselect({
      message: "Select items",
      options: { Group: [{ value: "alpha", label: "Alpha" }] },
    });

    const render = capturedOptions?.render;
    const output = render!.call({
      state: "active",
      value: [],
      cursor: 0,
      error: "",
      options: [
        { value: "Group", group: true, label: "Group" },
        { value: "alpha", group: "Group", label: "Alpha" },
      ],
      isGroupSelected: () => false,
    });

    expect(output).toContain("▼");
    expect(output).not.toContain("▶");
  });

  it("renders collapse indicator ▶ and selection count when group is collapsed via Tab", async () => {
    await groupMultiselect({
      message: "Select items",
      options: {
        Group: [
          { value: "alpha", label: "Alpha" },
          { value: "beta", label: "Beta" },
        ],
      },
    });

    const allOptions = [
      { value: "Group", group: true as const, label: "Group" },
      { value: "alpha", group: "Group", label: "Alpha" },
      { value: "beta", group: "Group", label: "Beta" },
    ];

    mockPromptInstance.options = allOptions;
    mockPromptInstance.cursor = 0; // cursor on Group header

    // Fire Tab key to collapse the group
    for (const handler of keyHandlers) {
      handler(undefined, { name: "tab" });
    }

    const render = capturedOptions?.render;
    const output = render!.call({
      state: "active",
      value: ["alpha"],
      cursor: 0,
      error: "",
      options: allOptions,
      isGroupSelected: () => false,
    });

    // Group should be collapsed: ▶ indicator and count shown, children hidden
    expect(output).toContain("▶");
    expect(output).toContain("(1/2)");
    expect(output).not.toContain("Alpha");
    expect(output).not.toContain("Beta");
  });

  it("moves cursor to group header when Tab collapses a group while cursor is on a child", async () => {
    await groupMultiselect({
      message: "Select items",
      options: {
        Group: [
          { value: "alpha", label: "Alpha" },
          { value: "beta", label: "Beta" },
        ],
      },
    });

    const allOptions = makeOptions();
    mockPromptInstance.options = allOptions;
    mockPromptInstance.cursor = 1; // cursor on "alpha" child

    for (const handler of keyHandlers) {
      handler(undefined, { name: "tab" });
    }

    // Cursor should have moved to group header (index 0)
    expect(mockPromptInstance.cursor).toBe(0);
  });

  it("expands group on second Tab press (toggle)", async () => {
    await groupMultiselect({
      message: "Select items",
      options: { Group: [{ value: "alpha", label: "Alpha" }] },
    });

    const allOptions = [
      { value: "Group", group: true as const, label: "Group" },
      { value: "alpha", group: "Group", label: "Alpha" },
    ];
    mockPromptInstance.options = allOptions;
    mockPromptInstance.cursor = 0;

    // First Tab: collapse
    for (const handler of keyHandlers) handler(undefined, { name: "tab" });

    // Second Tab: expand
    for (const handler of keyHandlers) handler(undefined, { name: "tab" });

    // Now alpha should be visible again
    const render = capturedOptions?.render;
    const output = render!.call({
      state: "active",
      value: [],
      cursor: 0,
      error: "",
      options: allOptions,
      isGroupSelected: () => false,
    });

    expect(output).toContain("▼");
    expect(output).toContain("Alpha");
  });

  it("cursor skip handler advances past collapsed children on down movement", async () => {
    await groupMultiselect({
      message: "Select items",
      options: {
        GroupA: [{ value: "alpha", label: "Alpha" }],
        GroupB: [{ value: "beta", label: "Beta" }],
      },
    });

    const allOptions = [
      { value: "GroupA", group: true as const, label: "GroupA" },
      { value: "alpha", group: "GroupA", label: "Alpha" },
      { value: "GroupB", group: true as const, label: "GroupB" },
      { value: "beta", group: "GroupB", label: "Beta" },
    ];
    mockPromptInstance.options = allOptions;
    mockPromptInstance.cursor = 0; // on GroupA header

    // Collapse GroupA via Tab
    for (const handler of keyHandlers) handler(undefined, { name: "tab" });

    // Simulate internal handler moving cursor from 0 to 1 (the collapsed child)
    mockPromptInstance.cursor = 1;

    // Fire cursor handler (down)
    for (const handler of cursorHandlers) handler("down");

    // Cursor should have skipped past collapsed child (index 1) to GroupB (index 2)
    expect(mockPromptInstance.cursor).toBe(2);
  });

  it("'a' key selects all child items when not all are selected", async () => {
    await groupMultiselect({
      message: "Select items",
      options: {
        Group: [
          { value: "alpha", label: "Alpha" },
          { value: "beta", label: "Beta" },
        ],
      },
    });

    mockPromptInstance.options = [
      { value: "Group", group: true as const, label: "Group" },
      { value: "alpha", group: "Group", label: "Alpha" },
      { value: "beta", group: "Group", label: "Beta" },
    ];
    mockPromptInstance.value = ["alpha"]; // only one selected

    for (const handler of keyHandlers) handler("a", { name: "a" });

    expect(mockPromptInstance.value).toEqual(expect.arrayContaining(["alpha", "beta"]));
    expect(mockPromptInstance.value).toHaveLength(2);
  });

  it("'a' key deselects all child items when all are selected", async () => {
    await groupMultiselect({
      message: "Select items",
      options: {
        Group: [
          { value: "alpha", label: "Alpha" },
          { value: "beta", label: "Beta" },
        ],
      },
    });

    mockPromptInstance.options = [
      { value: "Group", group: true as const, label: "Group" },
      { value: "alpha", group: "Group", label: "Alpha" },
      { value: "beta", group: "Group", label: "Beta" },
    ];
    mockPromptInstance.value = ["alpha", "beta"]; // all selected

    for (const handler of keyHandlers) handler("a", { name: "a" });

    expect(mockPromptInstance.value).toHaveLength(0);
  });

  it("'a' key selects across multiple groups", async () => {
    await groupMultiselect({
      message: "Select items",
      options: {
        GroupA: [{ value: "alpha", label: "Alpha" }],
        GroupB: [{ value: "beta", label: "Beta" }],
      },
    });

    mockPromptInstance.options = [
      { value: "GroupA", group: true as const, label: "GroupA" },
      { value: "alpha", group: "GroupA", label: "Alpha" },
      { value: "GroupB", group: true as const, label: "GroupB" },
      { value: "beta", group: "GroupB", label: "Beta" },
    ];
    mockPromptInstance.value = [];

    for (const handler of keyHandlers) handler("a", { name: "a" });

    expect(mockPromptInstance.value).toEqual(expect.arrayContaining(["alpha", "beta"]));
    expect(mockPromptInstance.value).toHaveLength(2);
  });

  it("shows inline guide when withGuide is true", async () => {
    await groupMultiselect({
      message: "Select items",
      options: { Group: [{ value: "alpha", label: "Alpha" }] },
      withGuide: true,
    });

    const render = capturedOptions?.render;
    const output = render!.call({
      state: "active",
      value: [],
      cursor: 0,
      error: "",
      options: [
        { value: "Group", group: true, label: "Group" },
        { value: "alpha", group: "Group", label: "Alpha" },
      ],
      isGroupSelected: () => false,
    });

    expect(output).toContain("space toggle");
    expect(output).toContain("tab fold");
  });

  it("does not show inline guide when withGuide is not set", async () => {
    await groupMultiselect({
      message: "Select items",
      options: { Group: [{ value: "alpha", label: "Alpha" }] },
    });

    const render = capturedOptions?.render;
    const output = render!.call({
      state: "active",
      value: [],
      cursor: 0,
      error: "",
      options: [
        { value: "Group", group: true, label: "Group" },
        { value: "alpha", group: "Group", label: "Alpha" },
      ],
      isGroupSelected: () => false,
    });

    expect(output).not.toContain("space toggle");
  });

  it("initialCollapsed option starts all groups collapsed", async () => {
    await groupMultiselect({
      message: "Select items",
      options: { Group: [{ value: "alpha", label: "Alpha" }] },
      initialCollapsed: true,
    });

    const render = capturedOptions?.render;
    const output = render!.call({
      state: "active",
      value: [],
      cursor: 0,
      error: "",
      options: [
        { value: "Group", group: true, label: "Group" },
        { value: "alpha", group: "Group", label: "Alpha" },
      ],
      isGroupSelected: () => false,
    });

    expect(output).toContain("▶");
    expect(output).not.toContain("Alpha");
  });
});
