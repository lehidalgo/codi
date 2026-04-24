import pc from "picocolors";
import { PROJECT_NAME_DISPLAY, PROJECT_TAGLINE } from "../constants.js";
import { VERSION } from "../index.js";

const CODI_ASCII_ART = [
  " ██████╗  ██████╗ ██████╗ ██╗       ██████╗██╗     ██╗",
  "██╔════╝ ██╔═══██╗██╔══██╗██║      ██╔════╝██║     ██║",
  "██║      ██║   ██║██║  ██║██║█████╗██║     ██║     ██║",
  "██║      ██║   ██║██║  ██║██║╚════╝██║     ██║     ██║",
  "╚██████╗ ╚██████╔╝██████╔╝██║      ╚██████╗███████╗██║",
  " ╚═════╝  ╚═════╝ ╚═════╝ ╚═╝       ╚═════╝╚══════╝╚═╝",
];

const MIN_WIDTH_FOR_ART = 50;
const BOX_HORIZONTAL_PADDING = 2;
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

interface WelcomeBannerOptions {
  subtitle?: string;
  detectedStack?: string[];
  detectedAgents?: string[];
}

function visibleLength(s: string): number {
  return s.replace(ANSI_REGEX, "").length;
}

function wrapInBox(lines: string[]): string[] {
  const inner = lines.reduce((max, l) => Math.max(max, visibleLength(l)), 0);
  const horizontal = "─".repeat(inner + BOX_HORIZONTAL_PADDING * 2);
  const top = pc.cyan(`╭${horizontal}╮`);
  const bottom = pc.cyan(`╰${horizontal}╯`);
  const side = pc.cyan("│");
  const padSpaces = " ".repeat(BOX_HORIZONTAL_PADDING);
  const padded = lines.map((line) => {
    const fill = " ".repeat(inner - visibleLength(line));
    return `${side}${padSpaces}${line}${fill}${padSpaces}${side}`;
  });
  return [top, ...padded, bottom];
}

function formatStatusLine(label: string, items: string[] | undefined): string {
  const hasItems = items && items.length > 0;
  const dot = hasItems ? pc.green("●") : pc.dim("●");
  const value = hasItems ? items.join(", ") : "none detected";
  const styledValue = hasItems ? value : pc.dim(value);
  return `${dot} ${pc.bold(label)}  ${styledValue}`;
}

export function printWelcomeBanner(options: WelcomeBannerOptions): void {
  const cols = process.stdout.columns ?? 80;
  const content: string[] = [];

  if (cols >= MIN_WIDTH_FOR_ART) {
    for (const artLine of CODI_ASCII_ART) {
      content.push(pc.cyan(artLine));
    }
  } else {
    content.push(pc.bold(pc.cyan(`${PROJECT_NAME_DISPLAY}-CLI`)));
  }

  content.push("");
  content.push(
    `${pc.dim(PROJECT_TAGLINE)}${" ".repeat(Math.max(1, 50 - PROJECT_TAGLINE.length))}${pc.dim(`v${VERSION}`)}`,
  );
  const hasStatus = options.detectedStack || options.detectedAgents;
  if (hasStatus) {
    content.push("");
    content.push(formatStatusLine("Stack: ", options.detectedStack));
    content.push(formatStatusLine("Agents:", options.detectedAgents));
  } else if (options.subtitle) {
    content.push(pc.bold(options.subtitle));
  }

  // Compute box width and decide whether the terminal can fit it.
  const widest = content.reduce((max, l) => Math.max(max, visibleLength(l)), 0);
  const boxedWidth = widest + BOX_HORIZONTAL_PADDING * 2 + 2; // sides

  const out = cols >= boxedWidth ? wrapInBox(content) : content.map((l) => `  ${l}`);

  process.stdout.write("\n" + out.join("\n") + "\n\n");
}

export function printCompactBanner(title: string): void {
  const header = `  ${pc.bold(pc.cyan(PROJECT_NAME_DISPLAY))} ${pc.dim("—")} ${title}`;
  process.stdout.write(`\n${header}\n`);
}
