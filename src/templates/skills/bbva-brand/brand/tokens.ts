/**
 * tokens.ts — TypeScript adapter for BBVA brand tokens (v3).
 * Reads tokens.json and exports typed theme helpers for PPTX/DOCX generation.
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
  fonts: { headlines: string; body: string; fallback_serif: string; fallback_sans: string };
  layout: {
    slide_width_px: number;
    slide_height_px: number;
    slide_width_in: string;
    slide_height_in: string;
    content_padding_px: number;
    doc_width_px: number;
    doc_page_height_px: number;
    social_width_px: number;
    social_height_px: number;
  };
  assets: { logo_dark_bg: string; logo_light_bg: string; fonts_dir: string };
  voice: { phrases_use: string[]; phrases_avoid: string[] };
}

export const tokens: BrandTokens = JSON.parse(
  readFileSync(join(__dirname, "tokens.json"), "utf-8"),
) as BrandTokens;

export function getTheme(name: "dark" | "light" = "dark"): BrandTheme {
  return tokens.themes[name];
}

/** Returns hex color without # prefix (pptxgenjs expects bare hex strings). */
export function hex(color: string): string {
  return color.replace("#", "");
}

/** Resolves absolute path to a brand asset file. */
export function assetPath(relative: string): string {
  return join(__dirname, "..", relative.replace("../", ""));
}
