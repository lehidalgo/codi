import { styleText } from "node:util";
import type { Key } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { GroupMultiSelectPrompt, getRows } from "@clack/core";
import {
  S_BAR,
  S_BAR_END,
  S_CHECKBOX_ACTIVE,
  S_CHECKBOX_INACTIVE,
  S_CHECKBOX_SELECTED,
  symbol,
} from "@clack/prompts";

interface GroupMultiSelectOption<Value> {
  label?: string;
  value: Value;
  hint?: string;
  disabled?: boolean;
}

interface GroupMultiSelectOptions<Value> {
  message: string;
  options: Record<string, GroupMultiSelectOption<Value>[]>;
  initialValues?: Value[];
  required?: boolean;
  cursorAt?: Value;
  selectableGroups?: boolean;
  groupSpacing?: number;
  initialCollapsed?: boolean;
  input?: Readable;
  output?: Writable;
  signal?: AbortSignal;
  withGuide?: boolean;
}

type FlatOption<Value> = GroupMultiSelectOption<Value> & { group: string | boolean };
type ItemState =
  | "active"
  | "active-selected"
  | "selected"
  | "inactive"
  | "group-active"
  | "group-active-selected"
  | "submitted"
  | "cancelled";

function renderItem<Value>(
  option: FlatOption<Value>,
  state: ItemState,
  allOptions: FlatOption<Value>[],
  selectableGroups: boolean,
  groupSpacing: number,
  index: number,
  collapseIndicator?: string,
  collapsedSuffix?: string,
): string {
  const rawLabel = option.label ?? String(option.value);
  const label = collapseIndicator ? `${collapseIndicator} ${rawLabel}` : rawLabel;
  const suffix = collapsedSuffix ? ` ${styleText("dim", collapsedSuffix)}` : "";
  const isChild = typeof option.group === "string";
  const next = allOptions[index + 1] ?? { group: true };
  const branch = isChild
    ? selectableGroups
      ? `${next.group === true ? S_BAR_END : S_BAR} `
      : "  "
    : "";
  const spacing =
    groupSpacing > 0 && !isChild ? `\n${styleText("cyan", S_BAR).repeat(groupSpacing)}  ` : "";
  const hint =
    state === "active" || state === "active-selected"
      ? option.hint
        ? ` ${styleText("dim", `(${option.hint})`)}`
        : ""
      : "";
  const inactivePrefix =
    isChild || selectableGroups ? `${styleText("dim", S_CHECKBOX_INACTIVE)} ` : "";

  switch (state) {
    case "active":
      return `${spacing}${styleText("dim", branch)}${styleText("blue", S_CHECKBOX_ACTIVE)} ${styleText("blue", label)}${suffix}${hint}`;
    case "active-selected":
      return `${spacing}${styleText("dim", branch)}${styleText("blue", S_CHECKBOX_SELECTED)} ${styleText("blue", label)}${suffix}${hint}`;
    case "selected":
      return `${spacing}${styleText("dim", branch)}${styleText("green", S_CHECKBOX_SELECTED)} ${styleText("dim", label)}${suffix}`;
    case "group-active":
      return `${spacing}${branch}${styleText("blue", S_CHECKBOX_ACTIVE)} ${styleText("dim", label)}${suffix}`;
    case "group-active-selected":
      return `${spacing}${branch}${styleText("blue", S_CHECKBOX_SELECTED)} ${styleText("dim", label)}${suffix}`;
    case "submitted":
      return styleText("dim", rawLabel);
    case "cancelled":
      return styleText(["strikethrough", "dim"], rawLabel);
    case "inactive":
      return `${spacing}${styleText("dim", branch)}${inactivePrefix}${styleText("dim", label)}${suffix}`;
  }
}

export function groupMultiselect<Value>(
  opts: GroupMultiSelectOptions<Value>,
): Promise<Value[] | symbol> {
  const selectableGroups = opts.selectableGroups ?? true;
  const required = opts.required ?? false;
  const groupSpacing = opts.groupSpacing ?? 0;

  const collapsedGroups = new Set<string>(opts.initialCollapsed ? Object.keys(opts.options) : []);

  type PromptOption = GroupMultiSelectOption<Value> & { group: string | boolean };

  const outputStream = (opts.output ?? process.stdout) as unknown as Writable;

  const prompt = new GroupMultiSelectPrompt<GroupMultiSelectOption<Value>>({
    ...opts,
    selectableGroups,
    required,
    validate(value) {
      if (required && (!value || value.length === 0)) {
        return "Please select at least one option.";
      }
    },
    render() {
      const header = `${styleText("gray", S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;
      const cyanBar = styleText("cyan", S_BAR);
      const selected = this.value ?? [];

      // Build visible options (exclude children of collapsed groups)
      const visibleOptions: Array<{ option: PromptOption; originalIndex: number }> = [];
      for (let i = 0; i < this.options.length; i++) {
        const option = this.options[i]!;
        const isCollapsedChild =
          typeof option.group === "string" && collapsedGroups.has(option.group);
        if (!isCollapsedChild) {
          visibleOptions.push({ option, originalIndex: i });
        }
      }

      const lines = visibleOptions.map(({ option, originalIndex }, visIndex) => {
        const isSelected =
          selected.includes(option.value) ||
          (option.group === true && this.isGroupSelected(String(option.value)));
        const isCursor = originalIndex === this.cursor;
        const isGroupFocus =
          !isCursor &&
          typeof option.group === "string" &&
          this.options[this.cursor]?.value === option.group;

        const state: ItemState = isGroupFocus
          ? isSelected
            ? "group-active-selected"
            : "group-active"
          : isCursor && isSelected
            ? "active-selected"
            : isCursor
              ? "active"
              : isSelected
                ? "selected"
                : "inactive";

        // Build collapse indicator and suffix for group headers
        let collapseIndicator: string | undefined;
        let collapsedSuffix: string | undefined;
        if (option.group === true) {
          const groupName = String(option.value);
          const isCollapsed = collapsedGroups.has(groupName);
          collapseIndicator = isCollapsed ? "▶" : "▼";
          if (isCollapsed) {
            const groupChildren = this.options.filter((o) => o.group === groupName);
            const selectedCount = groupChildren.filter((o) => selected.includes(o.value)).length;
            collapsedSuffix =
              selectedCount > 0
                ? `(${selectedCount}/${groupChildren.length})`
                : `(${groupChildren.length})`;
          }
        }

        const visibleNeighbors = visibleOptions.map((v) => v.option);
        const rendered = renderItem(
          option,
          this.state === "submit" ? "submitted" : this.state === "cancel" ? "cancelled" : state,
          visibleNeighbors,
          selectableGroups,
          groupSpacing,
          visIndex,
          collapseIndicator,
          collapsedSuffix,
        );
        return `${visIndex !== 0 && !rendered.startsWith("\n") ? "  " : ""}${rendered}`;
      });

      if (this.state === "submit") {
        const summary = this.options
          .filter((option) => selected.includes(option.value))
          .map((option) =>
            renderItem(
              option,
              "submitted",
              this.options,
              selectableGroups,
              groupSpacing,
              this.options.indexOf(option),
            ),
          );
        const selectedText = summary.length > 0 ? `  ${summary.join(styleText("dim", ", "))}` : "";
        return `${header}${styleText("gray", S_BAR)}${selectedText}`;
      }

      if (this.state === "cancel") {
        const summary = this.options
          .filter((option) => selected.includes(option.value))
          .map((option) =>
            renderItem(
              option,
              "cancelled",
              this.options,
              selectableGroups,
              groupSpacing,
              this.options.indexOf(option),
            ),
          );
        const selectedText = summary.join(styleText("dim", ", "));
        return `${header}${styleText("gray", S_BAR)}  ${selectedText}${selectedText ? `\n${styleText("gray", S_BAR)}` : ""}`;
      }

      const footer = this.state === "error" ? this.error : "";
      const guideText = "space toggle · a all · tab fold · ↑↓ move · enter confirm · ^c back";
      const guideInner = styleText(["dim", "white"], ` ${guideText} `);
      const guideTop = styleText("dim", `┌${"─".repeat(guideText.length + 2)}┐`);
      const guideMid = `${styleText("dim", "│")}${guideInner}${styleText("dim", "│")}`;
      const guideBot = styleText("dim", `└${"─".repeat(guideText.length + 2)}┘`);
      const guide = opts.withGuide
        ? `\n${cyanBar}  ${guideTop}\n${cyanBar}  ${guideMid}\n${cyanBar}  ${guideBot}`
        : "";
      const footerBlock = footer
        ? `\n${styleText("yellow", S_BAR_END)}  ${styleText("yellow", footer)}\n`
        : `\n${styleText("cyan", S_BAR_END)}\n`;

      // Viewport: clamp lines to terminal height so cursor is always visible
      const termRows = getRows(outputStream);
      // overhead = 2 header + 1 guide (optional) + 2 footer
      const overhead = 4 + (opts.withGuide ? 1 : 0);
      const available = Math.max(3, termRows - overhead);

      let visibleLines = lines;
      let topIndicator = "";
      let bottomIndicator = "";

      if (lines.length > available) {
        const cursorVisIndex = visibleOptions.findIndex(
          ({ originalIndex }) => originalIndex === this.cursor,
        );
        // Reserve 1 slot each for top/bottom indicators when needed
        const hasAbove = (winStart: number) => winStart > 0;
        const hasBelow = (winEnd: number) => winEnd < lines.length;

        // Compute initial window centered on cursor
        let winSize = available;
        let winStart = Math.max(0, cursorVisIndex - Math.floor(winSize / 2));
        let winEnd = Math.min(lines.length, winStart + winSize);
        winStart = Math.max(0, winEnd - winSize);

        // Shrink window to make room for indicators
        if (hasAbove(winStart)) winSize--;
        if (hasBelow(winEnd)) winSize--;

        // Recompute with shrunk window
        winStart = Math.max(0, cursorVisIndex - Math.floor(winSize / 2));
        winEnd = Math.min(lines.length, winStart + winSize);
        winStart = Math.max(0, winEnd - winSize);

        if (winStart > 0) {
          topIndicator = `  ${styleText("dim", `▲ ${winStart} more above`)}\n${cyanBar}`;
        }
        if (winEnd < lines.length) {
          bottomIndicator = `\n${cyanBar}  ${styleText("dim", `▼ ${lines.length - winEnd} more below`)}`;
        }

        visibleLines = lines.slice(winStart, winEnd);
      }

      const body = `${cyanBar}${visibleLines[0]?.startsWith("\n") ? "" : "  "}${visibleLines.join(`\n${cyanBar}`)}`;
      return `${header}${topIndicator ? `${cyanBar}${topIndicator}` : ""}${body}${bottomIndicator}${guide}${footerBlock}`;
    },
  });

  // Toggle select/deselect all on "a" key
  prompt.on("key", (char: string | undefined) => {
    if (char !== "a") return;

    const childValues = prompt.options
      .filter((o) => typeof o.group === "string")
      .map((o) => o.value);
    const currentValues = prompt.value ?? [];
    const allSelected = childValues.every((v) => currentValues.includes(v));

    if (allSelected) {
      prompt.value = [];
    } else {
      prompt.value = [...new Set([...currentValues, ...childValues])];
    }
  });

  // Toggle collapse on Tab key
  prompt.on("key", (_char: string | undefined, key: Key) => {
    if (key.name !== "tab") return;

    const currentOption = prompt.options[prompt.cursor];
    if (!currentOption) return;

    let groupName: string;
    if (currentOption.group === true) {
      groupName = String(currentOption.value);
    } else if (typeof currentOption.group === "string") {
      groupName = currentOption.group;
    } else {
      return;
    }

    if (collapsedGroups.has(groupName)) {
      collapsedGroups.delete(groupName);
    } else {
      collapsedGroups.add(groupName);
      // If cursor is on a child of this group, move it to the group header
      if (typeof currentOption.group === "string") {
        const headerIndex = prompt.options.findIndex(
          (o) => o.group === true && String(o.value) === groupName,
        );
        if (headerIndex !== -1) {
          prompt.cursor = headerIndex;
        }
      }
    }
  });

  // After cursor movement, skip over collapsed children
  prompt.on("cursor", (action) => {
    if (action !== "up" && action !== "down" && action !== "left" && action !== "right") return;

    const direction = action === "up" || action === "left" ? -1 : 1;
    const len = prompt.options.length;

    let iterations = 0;
    while (iterations < len) {
      const opt = prompt.options[prompt.cursor];
      if (!opt) break;

      if (typeof opt.group === "string" && collapsedGroups.has(opt.group)) {
        prompt.cursor =
          direction === 1 ? (prompt.cursor + 1) % len : (prompt.cursor - 1 + len) % len;
        iterations++;
      } else {
        break;
      }
    }
  });

  return prompt.prompt() as Promise<Value[] | symbol>;
}
