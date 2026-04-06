#!/usr/bin/env npx tsx
/**
 * generate_pptx.ts — BBVA-branded PPTX generator (pptxgenjs, DEFAULT runtime).
 *
 * Usage:
 *   npx tsx generate_pptx.ts --content content.json --output output.pptx
 *   npx tsx generate_pptx.ts --title "My Deck" --output output.pptx
 *
 * content.json schema: { title, subtitle?, author?, sections: [{number, label, heading, body, items?, callout?}] }
 */
import PptxGenJSDefault from "pptxgenjs";
// CJS/ESM interop: pptxgenjs ships as CommonJS
const PptxGenJS = ((PptxGenJSDefault as unknown as { default: typeof PptxGenJSDefault }).default ?? PptxGenJSDefault) as typeof PptxGenJSDefault;
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as bt from "./brand_tokens.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Slide builders
// ---------------------------------------------------------------------------

function buildTitleSlide(pres: PptxGenJS, content: Content): void {
  const slide = pres.addSlide();

  // Dark background
  slide.background = { color: bt.hex("background_dark") };

  // Left accent bar
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.08, h: 7.5,
    fill: { color: bt.hex("primary") },
    line: { color: bt.hex("primary"), width: 0 },
  });

  // BBVA wordmark (text fallback when no logo asset)
  slide.addText("BBVA", {
    x: 0.4, y: 0.3, w: 2, h: 0.5,
    fontSize: 22,
    bold: true,
    color: bt.hex("primary"),
    fontFace: bt.FONTS["pptx_body"],
  });

  // Main title
  slide.addText(content.title, {
    x: 0.4, y: 2.5, w: 9, h: 1.8,
    fontSize: 44,
    bold: true,
    color: bt.hex("white"),
    fontFace: bt.FONTS["pptx_headlines"],
    wrap: true,
  });

  // Subtitle
  if (content.subtitle) {
    slide.addText(content.subtitle, {
      x: 0.4, y: 4.5, w: 9, h: 0.8,
      fontSize: 20,
      color: bt.hex("secondary"),
      fontFace: bt.FONTS["pptx_body"],
      italic: true,
    });
  }

  // Author + date footer
  const footer = [content.author, new Date().getFullYear().toString()]
    .filter(Boolean)
    .join(" · ");
  slide.addText(footer, {
    x: 0.4, y: 6.8, w: 12, h: 0.4,
    fontSize: 11,
    color: bt.hex("text_light"),
    fontFace: bt.FONTS["pptx_body"],
  });
}

function buildDividerSlide(pres: PptxGenJS, section: Section): void {
  const slide = pres.addSlide();

  slide.background = { color: bt.hex("primary") };

  // Section number
  slide.addText(section.number, {
    x: 0.5, y: 1.5, w: 4, h: 2,
    fontSize: 96,
    bold: true,
    color: bt.hex("accent"),
    fontFace: bt.FONTS["pptx_headlines"],
    alpha: 40,
  });

  // Section label
  slide.addText(section.label.toUpperCase(), {
    x: 0.5, y: 5.2, w: 10, h: 0.6,
    fontSize: 13,
    color: bt.hex("secondary"),
    fontFace: bt.FONTS["pptx_body"],
    charSpacing: 4,
  });

  // Section heading
  slide.addText(section.heading, {
    x: 0.5, y: 3.5, w: 10, h: 1.5,
    fontSize: 32,
    bold: true,
    color: bt.hex("white"),
    fontFace: bt.FONTS["pptx_headlines"],
    wrap: true,
  });
}

function buildContentSlide(pres: PptxGenJS, section: Section): void {
  const slide = pres.addSlide();

  slide.background = { color: bt.hex("background") };

  // Left accent bar
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.08, h: 7.5,
    fill: { color: bt.hex("primary") },
    line: { color: bt.hex("primary"), width: 0 },
  });

  // Section label
  slide.addText(section.label.toUpperCase(), {
    x: 0.4, y: 0.25, w: 10, h: 0.3,
    fontSize: 10,
    color: bt.hex("primary"),
    fontFace: bt.FONTS["pptx_body"],
    charSpacing: 3,
  });

  // Heading
  slide.addText(section.heading, {
    x: 0.4, y: 0.65, w: 12, h: 1,
    fontSize: 28,
    bold: true,
    color: bt.hex("primary_dark"),
    fontFace: bt.FONTS["pptx_headlines"],
    wrap: true,
  });

  // Divider line
  slide.addShape(pres.ShapeType.line, {
    x: 0.4, y: 1.75, w: 12.4, h: 0,
    line: { color: bt.hex("border"), width: 1 },
  });

  // Body text
  slide.addText(section.body, {
    x: 0.4, y: 1.95, w: 7.5, h: 2.5,
    fontSize: 14,
    color: bt.hex("text_primary"),
    fontFace: bt.FONTS["pptx_body"],
    lineSpacingMultiple: 1.4,
    wrap: true,
  });

  // Bullet items
  if (section.items && section.items.length > 0) {
    const bullets = section.items.map((item) => ({
      text: item,
      options: {
        bullet: { type: "bullet" as const },
        fontSize: 13,
        color: bt.hex("text_primary"),
        fontFace: bt.FONTS["pptx_body"],
      },
    }));
    slide.addText(bullets, {
      x: 8.2, y: 1.95, w: 4.8, h: 4.5,
      wrap: true,
    });
  }

  // Callout box
  if (section.callout) {
    slide.addShape(pres.ShapeType.rect, {
      x: 0.4, y: 4.7, w: 7.5, h: 1.5,
      fill: { color: bt.hex("primary"), alpha: 8 },
      line: { color: bt.hex("primary"), width: 1 },
    });
    slide.addText(section.callout, {
      x: 0.7, y: 4.9, w: 7, h: 1.1,
      fontSize: 13,
      italic: true,
      color: bt.hex("primary_dark"),
      fontFace: bt.FONTS["pptx_body"],
      wrap: true,
    });
  }
}

function buildClosingSlide(pres: PptxGenJS, content: Content): void {
  const slide = pres.addSlide();

  slide.background = { color: bt.hex("background_dark") };

  // Accent bar
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.08, h: 7.5,
    fill: { color: bt.hex("accent") },
    line: { color: bt.hex("accent"), width: 0 },
  });

  slide.addText("Gracias", {
    x: 0.4, y: 2.5, w: 8, h: 1.5,
    fontSize: 52,
    bold: true,
    color: bt.hex("white"),
    fontFace: bt.FONTS["pptx_headlines"],
  });

  slide.addText(content.title, {
    x: 0.4, y: 4.2, w: 10, h: 0.6,
    fontSize: 16,
    color: bt.hex("secondary"),
    fontFace: bt.FONTS["pptx_body"],
  });

  slide.addText("BBVA", {
    x: 0.4, y: 6.5, w: 3, h: 0.5,
    fontSize: 18,
    bold: true,
    color: bt.hex("primary"),
    fontFace: bt.FONTS["pptx_body"],
  });
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generatePptx(content: Content, outputPath: string): void {
  const pres = new PptxGenJS();

  pres.layout = "LAYOUT_WIDE";
  pres.title  = content.title;
  pres.author = content.author ?? "BBVA";

  buildTitleSlide(pres, content);

  for (const section of content.sections) {
    buildDividerSlide(pres, section);
    buildContentSlide(pres, section);
  }

  buildClosingSlide(pres, content);

  pres.writeFile({ fileName: outputPath });
  console.log(`PPTX written: ${outputPath} (${content.sections.length} sections)`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function parseCli(): { content: Content; output: string } {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const contentFile = getArg("--content");
  const output = getArg("--output") ?? "output.pptx";
  const titleArg = getArg("--title");

  if (contentFile) {
    const raw = JSON.parse(readFileSync(contentFile, "utf-8")) as Content;
    return { content: raw, output };
  }

  if (titleArg) {
    return {
      content: { title: titleArg, sections: [] },
      output,
    };
  }

  throw new Error(
    "Usage: npx tsx generate_pptx.ts --content content.json --output output.pptx\n" +
    "       npx tsx generate_pptx.ts --title 'My Deck' --output output.pptx"
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].split("/").pop()!)) {
  const { content, output } = parseCli();
  generatePptx(content, output);
}
