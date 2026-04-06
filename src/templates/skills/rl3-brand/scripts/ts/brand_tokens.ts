/**
 * brand_tokens.ts — TypeScript adapter for RL3 brand tokens.
 * Reads brand_tokens.json and re-exports typed constants for pptxgenjs use.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(
  readFileSync(join(__dirname, "..", "brand_tokens.json"), "utf-8")
) as Record<string, unknown>;

export const COLORS = raw["colors"] as Record<string, string>;
export const FONTS  = raw["fonts"]  as Record<string, string>;
export const LAYOUT = raw["layout"] as Record<string, string>;
export const ASSETS = raw["assets"] as Record<string, string>;
export const VOICE  = raw["voice"]  as { phrases_use: string[]; phrases_avoid: string[] };

/** Returns hex color without # prefix (pptxgenjs expects bare hex strings). */
export function hex(key: string): string {
  const color = COLORS[key];
  if (!color) throw new Error(`Unknown RL3 color token: "${key}". Available: ${Object.keys(COLORS).join(", ")}`);
  return color.replace("#", "");
}

/** Returns full hex including # (for CSS/HTML contexts). */
export function cssHex(key: string): string {
  const color = COLORS[key];
  if (!color) throw new Error(`Unknown RL3 color token: "${key}"`);
  return color;
}

export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2" +
  "?family=Instrument+Sans:wght@400;500;600;700" +
  "&family=Space+Grotesk:wght@400;500;600;700" +
  "&family=Space+Mono:wght@400;700" +
  "&display=swap";
