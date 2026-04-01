import pc from "picocolors";
import { PROJECT_NAME_DISPLAY, PROJECT_TAGLINE } from "../constants.js";
import { VERSION } from "../index.js";

const CODI_ASCII_ART = [
  "  ██████╗  ██████╗ ██████╗ ██╗       ██████╗██╗     ██╗",
  " ██╔════╝ ██╔═══██╗██╔══██╗██║      ██╔════╝██║     ██║",
  " ██║      ██║   ██║██║  ██║██║█████╗██║     ██║     ██║",
  " ██║      ██║   ██║██║  ██║██║╚════╝██║     ██║     ██║",
  " ╚██████╗ ╚██████╔╝██████╔╝██║      ╚██████╗███████╗██║",
  "  ╚═════╝  ╚═════╝ ╚═════╝ ╚═╝       ╚═════╝╚══════╝╚═╝",
];

const MIN_WIDTH_FOR_ART = 50;

interface WelcomeBannerOptions {
  subtitle?: string;
  detectedStack?: string[];
  detectedAgents?: string[];
}

function formatStatusLine(label: string, items: string[] | undefined): string {
  const hasItems = items && items.length > 0;
  const dot = hasItems ? pc.green("●") : pc.dim("●");
  const value = hasItems ? items.join(", ") : "none detected";
  const styledValue = hasItems ? value : pc.dim(value);
  return `  ${dot} ${pc.bold(label)}  ${styledValue}`;
}

export function printWelcomeBanner(options: WelcomeBannerOptions): void {
  const cols = process.stdout.columns ?? 80;
  const lines: string[] = [""];

  if (cols >= MIN_WIDTH_FOR_ART) {
    for (const artLine of CODI_ASCII_ART) {
      lines.push(pc.cyan(artLine));
    }
  } else {
    lines.push(pc.bold(pc.cyan(`  ${PROJECT_NAME_DISPLAY}-CLI`)));
  }

  lines.push("");
  lines.push(
    `  ${pc.dim(PROJECT_TAGLINE)}${" ".repeat(Math.max(1, 50 - PROJECT_TAGLINE.length))}${pc.dim(`v${VERSION}`)}`,
  );
  const hasStatus = options.detectedStack || options.detectedAgents;
  if (hasStatus) {
    lines.push("");
    lines.push(formatStatusLine("Stack: ", options.detectedStack));
    lines.push(formatStatusLine("Agents:", options.detectedAgents));
  } else if (options.subtitle) {
    lines.push(`  ${pc.bold(options.subtitle)}`);
  }
  lines.push("");

  process.stdout.write(lines.join("\n") + "\n");
}

export function printCompactBanner(title: string): void {
  const header = `  ${pc.bold(pc.cyan(PROJECT_NAME_DISPLAY))} ${pc.dim("—")} ${title}`;
  process.stdout.write(`\n${header}\n`);
}
