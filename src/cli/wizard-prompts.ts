import { styleText } from "node:util";
import type { Key } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { SelectPrompt, MultiSelectPrompt, ConfirmPrompt } from "@clack/core";
import {
  S_BAR,
  S_BAR_END,
  S_CHECKBOX_ACTIVE,
  S_CHECKBOX_INACTIVE,
  S_CHECKBOX_SELECTED,
  S_RADIO_ACTIVE,
  S_RADIO_INACTIVE,
  symbol,
} from "@clack/prompts";

// ─── Shared guide ────────────────────────────────────────────────────────────

const SELECT_GUIDE = "↑↓ move · enter confirm · b back · ctrl+c exit";
const MULTISELECT_GUIDE = "space toggle · a all · ↑↓ move · enter confirm · b back · ctrl+c exit";

function buildGuide(bar: string, text: string): string {
  const inner = styleText(["dim", "white"], ` ${text} `);
  const top = styleText("dim", `┌${"─".repeat(text.length + 2)}┐`);
  const mid = `${styleText("dim", "│")}${inner}${styleText("dim", "│")}`;
  const bot = styleText("dim", `└${"─".repeat(text.length + 2)}┘`);
  return `\n${bar}  ${top}\n${bar}  ${mid}\n${bar}  ${bot}`;
}

function makeBackController(signal?: AbortSignal): AbortController {
  const ctrl = new AbortController();
  if (signal) {
    signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return ctrl;
}

function addNavigationKeys(
  prompt: { on(event: "key", handler: (char: string | undefined, key: Key) => void): void },
  back: AbortController,
): void {
  prompt.on("key", (char: string | undefined, key: Key) => {
    if (key.ctrl && key.name === "c") {
      process.stdout.write("\n");
      process.exit(0);
    }
    if (char === "b" || key.name === "backspace") {
      back.abort();
    }
  });
}

// ─── wizardSelect ─────────────────────────────────────────────────────────────

interface SelectOption<Value> {
  label?: string;
  value: Value;
  hint?: string;
  disabled?: boolean;
}

export interface WizardSelectOptions<Value> {
  message: string;
  options: SelectOption<Value>[];
  initialValue?: Value;
  input?: Readable;
  output?: Writable;
  signal?: AbortSignal;
}

export function wizardSelect<Value>(opts: WizardSelectOptions<Value>): Promise<Value | symbol> {
  const back = makeBackController(opts.signal);

  const prompt = new SelectPrompt<SelectOption<Value>>({
    options: opts.options,
    initialValue: opts.initialValue,
    input: opts.input,
    output: opts.output,
    signal: back.signal,
    render() {
      const gray = styleText("gray", S_BAR);
      const cyan = styleText("cyan", S_BAR);
      const header = `${gray}\n${symbol(this.state)}  ${opts.message}\n`;

      if (this.state === "submit") {
        const opt = this.options[this.cursor];
        const label = opt?.label ?? String(opt?.value ?? "");
        return `${header}${gray}  ${styleText("dim", label)}`;
      }

      if (this.state === "cancel") {
        const opt = this.options[this.cursor];
        const label = opt?.label ?? String(opt?.value ?? "");
        return `${header}${gray}  ${styleText(["strikethrough", "dim"], label)}\n${gray}`;
      }

      const items = this.options
        .map((opt, i) => {
          const label = opt.label ?? String(opt.value ?? "");
          const hint = opt.hint && i === this.cursor ? ` ${styleText("dim", `(${opt.hint})`)}` : "";
          if (i === this.cursor) {
            return `${cyan}  ${styleText("cyan", S_RADIO_ACTIVE)} ${label}${hint}`;
          }
          return `${cyan}  ${styleText("dim", S_RADIO_INACTIVE)} ${styleText("dim", label)}`;
        })
        .join("\n");

      const guide = buildGuide(cyan, SELECT_GUIDE);
      const error =
        this.state === "error"
          ? `\n${styleText("yellow", S_BAR_END)}  ${styleText("yellow", this.error)}\n`
          : `\n${styleText("cyan", S_BAR_END)}\n`;

      return `${header}${items}${guide}${error}`;
    },
  });

  addNavigationKeys(prompt, back);
  return prompt.prompt() as Promise<Value | symbol>;
}

// ─── wizardMultiselect ────────────────────────────────────────────────────────

interface MultiSelectOption<Value> {
  label?: string;
  value: Value;
  hint?: string;
  disabled?: boolean;
}

export interface WizardMultiselectOptions<Value> {
  message: string;
  options: MultiSelectOption<Value>[];
  initialValues?: Value[];
  required?: boolean;
  input?: Readable;
  output?: Writable;
  signal?: AbortSignal;
}

export function wizardMultiselect<Value>(
  opts: WizardMultiselectOptions<Value>,
): Promise<Value[] | symbol> {
  const back = makeBackController(opts.signal);

  const prompt = new MultiSelectPrompt<MultiSelectOption<Value>>({
    options: opts.options,
    initialValues: opts.initialValues,
    required: opts.required ?? false,
    input: opts.input,
    output: opts.output,
    signal: back.signal,
    validate(value) {
      if (opts.required && (!value || value.length === 0)) {
        return "Please select at least one option.";
      }
    },
    render() {
      const gray = styleText("gray", S_BAR);
      const cyan = styleText("cyan", S_BAR);
      const header = `${gray}\n${symbol(this.state)}  ${opts.message}\n`;
      const selected = this.value ?? [];

      if (this.state === "submit") {
        const summary =
          this.options
            .filter((o) => selected.includes(o.value))
            .map((o) => styleText("dim", o.label ?? String(o.value ?? "")))
            .join(styleText("dim", ", ")) || styleText("dim", "none");
        return `${header}${gray}  ${summary}`;
      }

      if (this.state === "cancel") {
        const summary =
          this.options
            .filter((o) => selected.includes(o.value))
            .map((o) => styleText(["strikethrough", "dim"], o.label ?? String(o.value ?? "")))
            .join(styleText("dim", ", ")) || "";
        return `${header}${gray}  ${summary}\n${gray}`;
      }

      const items = this.options
        .map((opt, i) => {
          const label = opt.label ?? String(opt.value ?? "");
          const isSelected = selected.includes(opt.value);
          const isCursor = i === this.cursor;
          if (isCursor && isSelected) {
            return `${cyan}  ${styleText("blue", S_CHECKBOX_SELECTED)} ${styleText("blue", label)}`;
          }
          if (isCursor) {
            return `${cyan}  ${styleText("blue", S_CHECKBOX_ACTIVE)} ${styleText("blue", label)}`;
          }
          if (isSelected) {
            return `${cyan}  ${styleText("green", S_CHECKBOX_SELECTED)} ${styleText("dim", label)}`;
          }
          return `${cyan}  ${styleText("dim", S_CHECKBOX_INACTIVE)} ${styleText("dim", label)}`;
        })
        .join("\n");

      const guide = buildGuide(cyan, MULTISELECT_GUIDE);
      const error =
        this.state === "error"
          ? `\n${styleText("yellow", S_BAR_END)}  ${styleText("yellow", this.error)}\n`
          : `\n${styleText("cyan", S_BAR_END)}\n`;

      return `${header}${items}${guide}${error}`;
    },
  });

  addNavigationKeys(prompt, back);
  return prompt.prompt() as Promise<Value[] | symbol>;
}

// ─── wizardConfirm ────────────────────────────────────────────────────────────

export interface WizardConfirmOptions {
  message: string;
  initialValue?: boolean;
  input?: Readable;
  output?: Writable;
  signal?: AbortSignal;
}

export function wizardConfirm(opts: WizardConfirmOptions): Promise<boolean | symbol> {
  const back = makeBackController(opts.signal);

  const prompt = new ConfirmPrompt({
    active: "yes",
    inactive: "no",
    initialValue: opts.initialValue,
    signal: back.signal,
    render(this: Omit<ConfirmPrompt, "prompt">) {
      const gray = styleText("gray", S_BAR);
      const cyan = styleText("cyan", S_BAR);
      const header = `${gray}\n${symbol(this.state)}  ${opts.message}\n`;
      // cursor === 0 → yes (true), cursor === 1 → no (false)
      const isYes = this.cursor === 0;

      if (this.state === "submit") {
        return `${header}${gray}  ${styleText("dim", isYes ? "yes" : "no")}`;
      }

      if (this.state === "cancel") {
        return `${header}${gray}  ${styleText(["strikethrough", "dim"], isYes ? "yes" : "no")}\n${gray}`;
      }

      const yes = isYes
        ? `${styleText("green", S_RADIO_ACTIVE)} yes`
        : `${styleText("dim", S_RADIO_INACTIVE)} ${styleText("dim", "yes")}`;
      const no = !isYes
        ? `${styleText("green", S_RADIO_ACTIVE)} no`
        : `${styleText("dim", S_RADIO_INACTIVE)} ${styleText("dim", "no")}`;

      const guide = buildGuide(cyan, SELECT_GUIDE);
      return `${header}${cyan}  ${yes}  /  ${no}${guide}\n${styleText("cyan", S_BAR_END)}\n`;
    },
  });

  addNavigationKeys(prompt, back);
  return prompt.prompt() as Promise<boolean | symbol>;
}
