import { styleText } from "node:util";

const LEGEND_TEXT = "space toggle · a all · tab fold · ↑↓ move · enter confirm · ^c back";

/**
 * Prints the keyboard navigation legend between wizard prompts.
 * Matches the visual style of the inline guide shown inside groupMultiselect.
 */
export function printLegend(): void {
  const inner = styleText(["dim", "white"], ` ${LEGEND_TEXT} `);
  const top = styleText("dim", `┌${"─".repeat(LEGEND_TEXT.length + 2)}┐`);
  const mid = `${styleText("dim", "│")}${inner}${styleText("dim", "│")}`;
  const bot = styleText("dim", `└${"─".repeat(LEGEND_TEXT.length + 2)}┘`);
  const bar = styleText("gray", "│");
  process.stdout.write(`${bar}\n${bar}  ${top}\n${bar}  ${mid}\n${bar}  ${bot}\n${bar}\n`);
}
