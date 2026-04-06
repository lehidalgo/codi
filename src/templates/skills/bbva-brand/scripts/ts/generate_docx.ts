#!/usr/bin/env npx tsx
/**
 * generate_docx.ts — BBVA-branded DOCX generator (docx npm, DEFAULT runtime).
 *
 * Usage:
 *   npx tsx generate_docx.ts --content content.json --output output.docx
 *
 * content.json schema: { title, subtitle?, author?, sections: [{number, label, heading, body, items?, callout?}] }
 *
 * Install dependency: npm install docx
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
  PageBreak,
  UnderlineType,
  convertInchesToTwip,
} from "docx";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as bt from "./brand_tokens.js";

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
// Helpers
// ---------------------------------------------------------------------------

function hexToDocx(key: string): string {
  return bt.hex(key).toUpperCase();
}

function coverPage(content: Content): Paragraph[] {
  const paras: Paragraph[] = [];

  paras.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "BBVA",
          bold: true,
          size: 36,
          color: hexToDocx("primary"),
          font: bt.FONTS["pptx_body"],
        }),
      ],
      spacing: { after: 400 },
    })
  );

  paras.push(
    new Paragraph({
      children: [
        new TextRun({
          text: content.title,
          bold: true,
          size: 56,
          color: hexToDocx("primary_dark"),
          font: bt.FONTS["pptx_headlines"],
        }),
      ],
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 },
    })
  );

  if (content.subtitle) {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({
            text: content.subtitle,
            size: 28,
            italics: true,
            color: hexToDocx("text_secondary"),
            font: bt.FONTS["pptx_body"],
          }),
        ],
        spacing: { after: 480 },
      })
    );
  }

  if (content.author) {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({
            text: content.author,
            size: 22,
            color: hexToDocx("text_light"),
            font: bt.FONTS["pptx_body"],
          }),
        ],
        spacing: { after: 120 },
      })
    );
  }

  paras.push(
    new Paragraph({
      children: [
        new TextRun({
          text: new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long" }),
          size: 20,
          color: hexToDocx("text_light"),
          font: bt.FONTS["pptx_body"],
        }),
      ],
      spacing: { after: 2400 },
    })
  );

  // Page break after cover
  paras.push(new Paragraph({ children: [new PageBreak()] }));

  return paras;
}

function sectionDivider(section: Section): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: `${section.number}  ${section.label.toUpperCase()}`,
          bold: true,
          size: 24,
          color: hexToDocx("primary"),
          font: bt.FONTS["pptx_body"],
          characterSpacing: 60,
        }),
      ],
      border: {
        bottom: { color: hexToDocx("primary"), size: 6, space: 1, style: BorderStyle.SINGLE },
      },
      spacing: { before: 600, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: section.heading,
          bold: true,
          size: 40,
          color: hexToDocx("primary_dark"),
          font: bt.FONTS["pptx_headlines"],
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 300 },
    }),
  ];
}

function sectionBody(section: Section): Paragraph[] {
  const paras: Paragraph[] = [];

  paras.push(
    new Paragraph({
      children: [
        new TextRun({
          text: section.body,
          size: 24,
          color: hexToDocx("text_primary"),
          font: bt.FONTS["pptx_body"],
        }),
      ],
      spacing: { after: 240, line: 360, lineRule: "auto" },
    })
  );

  if (section.items && section.items.length > 0) {
    for (const item of section.items) {
      paras.push(
        new Paragraph({
          children: [
            new TextRun({
              text: item,
              size: 24,
              color: hexToDocx("text_primary"),
              font: bt.FONTS["pptx_body"],
            }),
          ],
          bullet: { level: 0 },
          spacing: { after: 120 },
        })
      );
    }
  }

  if (section.callout) {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({
            text: section.callout,
            size: 24,
            italics: true,
            color: hexToDocx("primary_dark"),
            font: bt.FONTS["pptx_body"],
          }),
        ],
        shading: {
          type: ShadingType.SOLID,
          color: "E8EBF7",
          fill: "E8EBF7",
        },
        border: {
          left: { color: hexToDocx("primary"), size: 12, space: 4, style: BorderStyle.SINGLE },
        },
        indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
        spacing: { before: 240, after: 240 },
      })
    );
  }

  return paras;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export async function generateDocx(content: Content, outputPath: string): Promise<void> {
  const allParagraphs: Paragraph[] = [
    ...coverPage(content),
  ];

  for (const section of content.sections) {
    allParagraphs.push(...sectionDivider(section));
    allParagraphs.push(...sectionBody(section));
  }

  const doc = new Document({
    title: content.title,
    subject: content.subtitle ?? "",
    creator: content.author ?? "BBVA",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.2),
              right: convertInchesToTwip(1.2),
            },
          },
        },
        children: allParagraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(outputPath, buffer);
  console.log(`DOCX written: ${outputPath} (${content.sections.length} sections)`);
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
  const output = getArg("--output") ?? "output.docx";

  if (contentFile) {
    const raw = JSON.parse(readFileSync(contentFile, "utf-8")) as Content;
    return { content: raw, output };
  }

  throw new Error("Usage: npx tsx generate_docx.ts --content content.json --output output.docx");
}

if (process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].split("/").pop()!)) {
  const { content, output } = parseCli();
  generateDocx(content, output).catch((err: unknown) => {
    console.error("DOCX generation failed:", err);
    process.exit(1);
  });
}
