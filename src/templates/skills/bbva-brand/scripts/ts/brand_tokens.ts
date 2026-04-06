/**
 * brand_tokens.ts — TypeScript adapter for BBVA brand tokens (v2).
 * Reads brand_tokens.json and exports typed theme helpers.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface BrandTheme {
  background: string;
  surface: string;
  text_primary: string;
  text_secondary: string;
  primary: string;
  accent: string;
  logo: string;
}

export interface BrandTokens {
  brand: string;
  version: number;
  themes: { dark: BrandTheme; light: BrandTheme };
  fonts: { headlines: string; body: string; fallback_sans: string };
  layout: {
    slide_width_in: string;
    slide_height_in: string;
    content_margin_in: string;
    accent_bar_width_in: string;
  };
  assets: { logo_dark_bg: string; logo_light_bg: string };
  voice: { phrases_use: string[]; phrases_avoid: string[] };
}

export const tokens: BrandTokens = JSON.parse(
  readFileSync(join(__dirname, "..", "brand_tokens.json"), "utf-8"),
) as BrandTokens;

export function getTheme(name: "dark" | "light" = "dark"): BrandTheme {
  return tokens.themes[name];
}

/** Returns hex color without # prefix (pptxgenjs expects bare hex strings). */
export function hex(color: string): string {
  return color.replace("#", "");
}
