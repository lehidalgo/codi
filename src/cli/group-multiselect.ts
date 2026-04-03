import { styleText } from "node:util";
import type { Readable, Writable } from "node:stream";
import { GroupMultiSelectPrompt } from "@clack/core";
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
): string {
  const label = option.label ?? String(option.value);
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
      return `${spacing}${styleText("dim", branch)}${styleText("blue", S_CHECKBOX_ACTIVE)} ${styleText("blue", label)}${hint}`;
    case "active-selected":
      return `${spacing}${styleText("dim", branch)}${styleText("green", S_CHECKBOX_SELECTED)} ${styleText("blue", label)}${hint}`;
    case "selected":
      return `${spacing}${styleText("dim", branch)}${styleText("green", S_CHECKBOX_SELECTED)} ${styleText("dim", label)}`;
    case "group-active":
      return `${spacing}${branch}${styleText("blue", S_CHECKBOX_ACTIVE)} ${styleText("dim", label)}`;
    case "group-active-selected":
      return `${spacing}${branch}${styleText("green", S_CHECKBOX_SELECTED)} ${styleText("dim", label)}`;
    case "submitted":
      return styleText("dim", label);
    case "cancelled":
      return styleText(["strikethrough", "dim"], label);
    case "inactive":
      return `${spacing}${styleText("dim", branch)}${inactivePrefix}${styleText("dim", label)}`;
  }
}

export function groupMultiselect<Value>(
  opts: GroupMultiSelectOptions<Value>,
): Promise<Value[] | symbol> {
  const selectableGroups = opts.selectableGroups ?? true;
  const required = opts.required ?? false;
  const groupSpacing = opts.groupSpacing ?? 0;

  return new GroupMultiSelectPrompt<GroupMultiSelectOption<Value>>({
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
      const lines = this.options.map((option, index, allOptions) => {
        const isSelected =
          selected.includes(option.value) ||
          (option.group === true && this.isGroupSelected(String(option.value)));
        const isCursor = index === this.cursor;
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

        const rendered = renderItem(
          option,
          this.state === "submit" ? "submitted" : this.state === "cancel" ? "cancelled" : state,
          allOptions,
          selectableGroups,
          groupSpacing,
          index,
        );
        return `${index !== 0 && !rendered.startsWith("\n") ? "  " : ""}${rendered}`;
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
      const footerBlock = footer
        ? `\n${styleText("yellow", S_BAR_END)}  ${styleText("yellow", footer)}\n`
        : `\n${styleText("cyan", S_BAR_END)}\n`;

      return `${header}${cyanBar}${lines[0]?.startsWith("\n") ? "" : "  "}${lines.join(`\n${cyanBar}`)}${footerBlock}`;
    },
  }).prompt() as Promise<Value[] | symbol>;
}
