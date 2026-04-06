#!/usr/bin/env npx tsx
/**
 * generate_docx.ts — Brand+theme-aware DOCX generator.
 * Usage: npx tsx generate_docx.ts --content content.json [--tokens brand_tokens.json] [--theme dark|light] --output out.docx
 * When --tokens is omitted, uses bundled Codi brand tokens.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  PageBreak,
  convertInchesToTwip,
  ImageRun,
  AlignmentType,
} from "docx";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, extname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandTheme {
  background: string;
  surface: string;
  text_primary: string;
  text_secondary: string;
  primary: string;
  accent: string;
  logo: string;
}
interface BrandTokens {
  brand: string;
  version: number;
  themes: { dark: BrandTheme; light: BrandTheme };
  fonts: { headlines: string; body: string; fallback_sans: string };
  assets?: Record<string, string>;
}

interface SectionEntry {
  type?: "section";
  number?: string;
  label?: string;
  heading: string;
  body?: string;
  items?: string[];
  callout?: string;
}
interface QuoteEntry {
  type: "quote";
  quote: string;
  attribution?: string;
}
interface ClosingEntry {
  type: "closing";
  message: string;
  contact?: string;
}

type DocSection = SectionEntry | QuoteEntry | ClosingEntry;

interface Content {
  title: string;
  subtitle?: string;
  author?: string;
  sections: DocSection[];
}

// ── Args ──────────────────────────────────────────────────────────────────────

function parseArgs(): {
  content: string;
  tokens?: string;
  theme: "dark" | "light";
  output: string;
} {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const content = get("--content");
  const output = get("--output");
  if (!content || !output) {
    console.error(
      "Usage: npx tsx generate_docx.ts --content content.json [--tokens tokens.json] [--theme dark|light] --output out.docx",
    );
    process.exit(1);
  }
  return {
    content,
    tokens: get("--tokens"),
    theme: get("--theme") === "light" ? "light" : "dark",
    output,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const args = parseArgs();
const tokensPath = args.tokens
  ? resolve(process.cwd(), args.tokens)
  : join(__dirname, "../brand_tokens.json");
const tokensDir = dirname(tokensPath);
const tokens: BrandTokens = JSON.parse(readFileSync(tokensPath, "utf-8"));
const T = tokens.themes[args.theme];
const F = tokens.fonts;
const d = (c: string) => c.replace("#", "").toUpperCase();
const content: Content = JSON.parse(readFileSync(resolve(process.cwd(), args.content), "utf-8"));

const logoRelPath = tokens.assets?.[T.logo];
const logoPath = logoRelPath ? resolve(tokensDir, logoRelPath) : null;
const logoExists = logoPath ? existsSync(logoPath) : false;

// Minimal 1x1 transparent PNG — required SVG fallback for older Word viewers
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildLogoRun(): ImageRun | null {
  if (!logoExists || !logoPath) return null;
  try {
    const data = readFileSync(logoPath);
    const ext = extname(logoPath).toLowerCase().replace(".", "");
    if (ext === "svg")
      return new ImageRun({
        type: "svg",
        data,
        fallback: { type: "png", data: FALLBACK_PNG },
        transformation: { width: 120, height: 48 },
      });
    const imgType = (["png", "jpg", "gif", "bmp"].includes(ext) ? ext : "png") as
      | "png"
      | "jpg"
      | "gif"
      | "bmp";
    return new ImageRun({ type: imgType, data, transformation: { width: 120, height: 48 } });
  } catch {
    return null;
  }
}

// ── Section builders ──────────────────────────────────────────────────────────

function coverPage(): Paragraph[] {
  const logoRun = buildLogoRun();
  return [
    ...(logoRun
      ? [new Paragraph({ children: [logoRun], spacing: { after: 320 } })]
      : [
          new Paragraph({
            children: [
              new TextRun({
                text: tokens.brand.toUpperCase(),
                bold: true,
                size: 18,
                color: d(T.accent),
                font: F.fallback_sans,
              }),
            ],
            spacing: { after: 480 },
          }),
        ]),
    new Paragraph({
      children: [
        new TextRun({
          text: content.title,
          bold: true,
          size: 56,
          color: d(T.primary),
          font: F.headlines,
        }),
      ],
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 },
    }),
    ...(content.subtitle
      ? [
          new Paragraph({
            children: [
              new TextRun({
                text: content.subtitle,
                size: 28,
                color: d(T.text_secondary),
                font: F.body,
              }),
            ],
            spacing: { after: 240 },
          }),
        ]
      : []),
    ...(content.author
      ? [
          new Paragraph({
            children: [
              new TextRun({
                text: content.author,
                size: 22,
                color: d(T.text_secondary),
                font: F.body,
              }),
            ],
            spacing: { after: 0 },
          }),
        ]
      : []),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildSectionEntry(sec: SectionEntry): Paragraph[] {
  const paras: Paragraph[] = [];
  if (sec.number || sec.label) {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({
            text: [sec.number, sec.label].filter(Boolean).join("  ·  "),
            bold: true,
            size: 18,
            color: d(T.accent),
            font: F.body,
          }),
        ],
        spacing: { after: 120 },
      }),
    );
  }
  paras.push(
    new Paragraph({
      children: [
        new TextRun({
          text: sec.heading,
          bold: true,
          size: 40,
          color: d(T.primary),
          font: F.headlines,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
  );
  if (sec.body)
    paras.push(
      new Paragraph({
        children: [
          new TextRun({ text: sec.body, size: 24, color: d(T.text_secondary), font: F.body }),
        ],
        spacing: { after: 200 },
      }),
    );
  for (const item of sec.items ?? []) {
    paras.push(
      new Paragraph({
        children: [new TextRun({ text: item, size: 24, color: d(T.text_primary), font: F.body })],
        bullet: { level: 0 },
        spacing: { after: 100 },
      }),
    );
  }
  if (sec.callout) {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({
            text: sec.callout,
            italics: true,
            size: 24,
            color: d(T.accent),
            font: F.body,
          }),
        ],
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: d(T.accent) } },
        shading: { type: ShadingType.CLEAR, fill: d(T.surface) },
        indent: { left: convertInchesToTwip(0.3) },
        spacing: { after: 200 },
      }),
    );
  }
  paras.push(new Paragraph({ children: [new PageBreak()] }));
  return paras;
}

function buildQuoteEntry(sec: QuoteEntry): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: `\u201C${sec.quote}\u201D`,
          italics: true,
          bold: true,
          size: 40,
          color: d(T.primary),
          font: F.headlines,
        }),
      ],
      border: { left: { style: BorderStyle.SINGLE, size: 20, color: d(T.accent) } },
      indent: { left: convertInchesToTwip(0.4) },
      spacing: { before: 400, after: 200 },
    }),
    ...(sec.attribution
      ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `\u2014 ${sec.attribution}`,
                size: 20,
                color: d(T.accent),
                font: F.body,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 },
          }),
        ]
      : [new Paragraph({ children: [], spacing: { after: 400 } })]),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildClosingEntry(sec: ClosingEntry): Paragraph[] {
  return [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      children: [
        new TextRun({
          text: sec.message,
          bold: true,
          size: 52,
          color: d(T.primary),
          font: F.headlines,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: 800, after: 240 },
    }),
    ...(sec.contact
      ? [
          new Paragraph({
            children: [
              new TextRun({ text: sec.contact, size: 24, color: d(T.accent), font: F.body }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
          }),
        ]
      : []),
  ];
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

function buildDocSection(sec: DocSection): Paragraph[] {
  const type = sec.type ?? "section";
  switch (type) {
    case "quote":
      return buildQuoteEntry(sec as QuoteEntry);
    case "closing":
      return buildClosingEntry(sec as ClosingEntry);
    default:
      return buildSectionEntry(sec as SectionEntry);
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

const doc = new Document({
  styles: { default: { document: { run: { font: F.body, size: 24, color: d(T.text_primary) } } } },
  sections: [
    { properties: {}, children: [...coverPage(), ...content.sections.flatMap(buildDocSection)] },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(resolve(process.cwd(), args.output), buffer);

const counts = content.sections.reduce(
  (acc, s) => {
    const t = s.type ?? "section";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);
console.log(
  `DOCX written: ${args.output} (${content.sections.length} sections — ${Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ")})`,
);
