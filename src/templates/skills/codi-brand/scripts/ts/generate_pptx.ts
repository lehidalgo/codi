#!/usr/bin/env npx tsx
/**
 * generate_pptx.ts — Codi-branded PPTX generator (pptxgenjs, DEFAULT runtime).
 *
 * Usage:
 *   npx tsx generate_pptx.ts --content content.json --output output.pptx
 *
 * Codi visual identity: dark backgrounds (#070a0f), cyan accent (#56b6c2), Outfit font
 */
import PptxGenJSDefault from "pptxgenjs";
// CJS/ESM interop: pptxgenjs ships as CommonJS
const PptxGenJS = ((PptxGenJSDefault as unknown as { default: typeof PptxGenJSDefault }).default ?? PptxGenJSDefault) as typeof PptxGenJSDefault;
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as bt from "./brand_tokens.js";

interface Section {
  number: string;
  label: string;
  heading: string;
  body: string;
  items?: string[];
  callout?: string;
}

interface Content {
  title: string;
  subtitle?: string;
  author?: string;
  sections: Section[];
}

function buildTitleSlide(pres: PptxGenJS, content: Content): void {
  const slide = pres.addSlide();
  slide.background = { color: bt.hex("background") };

  // Cyan top accent bar
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 0.04,
    fill: { color: bt.hex("primary") },
    line: { color: bt.hex("primary"), width: 0 },
  });

  // "codi" wordmark in cyan
  slide.addText("codi", {
    x: 0.5, y: 0.3, w: 2, h: 0.6,
    fontSize: 26,
    bold: true,
    color: bt.hex("primary"),
    fontFace: bt.FONTS["pptx_headlines"],
  });

  // Title
  slide.addText(content.title, {
    x: 0.5, y: 2.0, w: 11.5, h: 2.5,
    fontSize: 42,
    bold: true,
    color: bt.hex("text_primary"),
    fontFace: bt.FONTS["pptx_headlines"],
    wrap: true,
  });

  // Subtitle
  if (content.subtitle) {
    slide.addText(content.subtitle, {
      x: 0.5, y: 4.7, w: 10, h: 0.8,
      fontSize: 18,
      color: bt.hex("text_secondary"),
      fontFace: bt.FONTS["pptx_body"],
    });
  }

  // Footer
  const footer = [content.author, new Date().getFullYear().toString()]
    .filter(Boolean).join(" · ");
  slide.addText(footer, {
    x: 0.5, y: 6.8, w: 12, h: 0.4,
    fontSize: 11,
    color: bt.hex("text_muted"),
    fontFace: bt.FONTS["pptx_body"],
  });
}

function buildDividerSlide(pres: PptxGenJS, section: Section): void {
  const slide = pres.addSlide();
  slide.background = { color: bt.hex("surface") };

  // Cyan left accent
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.05, h: 7.5,
    fill: { color: bt.hex("primary") },
    line: { color: bt.hex("primary"), width: 0 },
  });

  // Large section number (decorative, muted)
  slide.addText(section.number, {
    x: 0.5, y: 0.8, w: 6, h: 3,
    fontSize: 120,
    bold: true,
    color: bt.hex("surface_3"),
    fontFace: bt.FONTS["pptx_headlines"],
  });

  // Section heading
  slide.addText(section.heading, {
    x: 0.5, y: 3.8, w: 11, h: 1.5,
    fontSize: 32,
    bold: true,
    color: bt.hex("text_primary"),
    fontFace: bt.FONTS["pptx_headlines"],
    wrap: true,
  });

  // Label in cyan
  slide.addText(`${section.number}  ${section.label.toUpperCase()}`, {
    x: 0.5, y: 5.5, w: 10, h: 0.4,
    fontSize: 11,
    color: bt.hex("primary"),
    fontFace: bt.FONTS["pptx_body"],
    charSpacing: 3,
  });
}

function buildContentSlide(pres: PptxGenJS, section: Section): void {
  const slide = pres.addSlide();
  slide.background = { color: bt.hex("background") };

  // Cyan left accent
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.05, h: 7.5,
    fill: { color: bt.hex("primary") },
    line: { color: bt.hex("primary"), width: 0 },
  });

  // Label
  slide.addText(`${section.number}  ${section.label.toUpperCase()}`, {
    x: 0.4, y: 0.25, w: 10, h: 0.3,
    fontSize: 10,
    color: bt.hex("primary"),
    fontFace: bt.FONTS["pptx_body"],
    charSpacing: 3,
  });

  // Heading
  slide.addText(section.heading, {
    x: 0.4, y: 0.65, w: 12, h: 1,
    fontSize: 26,
    bold: true,
    color: bt.hex("text_primary"),
    fontFace: bt.FONTS["pptx_headlines"],
    wrap: true,
  });

  // Divider
  slide.addShape(pres.ShapeType.line, {
    x: 0.4, y: 1.75, w: 12.4, h: 0,
    line: { color: bt.hex("surface_3"), width: 1 },
  });

  // Body
  slide.addText(section.body, {
    x: 0.4, y: 1.95, w: 7.5, h: 2.5,
    fontSize: 14,
    color: bt.hex("text_secondary"),
    fontFace: bt.FONTS["pptx_body"],
    lineSpacingMultiple: 1.5,
    wrap: true,
  });

  // Bullets
  if (section.items && section.items.length > 0) {
    const bullets = section.items.map((item) => ({
      text: `▸ ${item}`,
      options: {
        fontSize: 13,
        color: bt.hex("text_primary"),
        fontFace: bt.FONTS["pptx_body"],
      },
    }));
    slide.addText(bullets, { x: 8.2, y: 1.95, w: 4.8, h: 4.5, wrap: true });
  }

  // Callout (cyan border)
  if (section.callout) {
    slide.addShape(pres.ShapeType.rect, {
      x: 0.4, y: 4.7, w: 7.5, h: 1.5,
      fill: { color: bt.hex("surface") },
      line: { color: bt.hex("primary"), width: 1 },
    });
    slide.addText(section.callout, {
      x: 0.7, y: 4.9, w: 7, h: 1.1,
      fontSize: 13,
      italic: true,
      color: bt.hex("primary"),
      fontFace: bt.FONTS["pptx_body"],
      wrap: true,
    });
  }
}

function buildClosingSlide(pres: PptxGenJS, content: Content): void {
  const slide = pres.addSlide();
  slide.background = { color: bt.hex("background") };

  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.05, h: 7.5,
    fill: { color: bt.hex("primary") },
    line: { color: bt.hex("primary"), width: 0 },
  });

  slide.addText("codi", {
    x: 0.4, y: 2.0, w: 5, h: 1.5,
    fontSize: 72,
    bold: true,
    color: bt.hex("primary"),
    fontFace: bt.FONTS["pptx_headlines"],
  });

  slide.addText(content.title, {
    x: 0.4, y: 3.8, w: 10, h: 0.6,
    fontSize: 16,
    color: bt.hex("text_secondary"),
    fontFace: bt.FONTS["pptx_body"],
  });

  slide.addText("github.com/lehidalgo/codi", {
    x: 0.4, y: 6.8, w: 6, h: 0.4,
    fontSize: 11,
    color: bt.hex("text_muted"),
    fontFace: bt.FONTS["pptx_body"],
  });
}

export function generatePptx(content: Content, outputPath: string): void {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.title  = content.title;
  pres.author = content.author ?? "Codi";

  buildTitleSlide(pres, content);
  for (const section of content.sections) {
    buildDividerSlide(pres, section);
    buildContentSlide(pres, section);
  }
  buildClosingSlide(pres, content);

  pres.writeFile({ fileName: outputPath });
  console.log(`PPTX written: ${outputPath} (${content.sections.length} sections)`);
}

function parseCli(): { content: Content; output: string } {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  const contentFile = getArg("--content");
  const output = getArg("--output") ?? "output.pptx";
  if (contentFile) return { content: JSON.parse(readFileSync(contentFile, "utf-8")) as Content, output };
  throw new Error("Usage: npx tsx generate_pptx.ts --content content.json --output output.pptx");
}

if (process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].split("/").pop()!)) {
  const { content, output } = parseCli();
  generatePptx(content, output);
}
