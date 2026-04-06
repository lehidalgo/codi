#!/usr/bin/env npx tsx
/**
 * generate_xlsx.ts — Brand+theme-aware XLSX generator.
 * Usage: npx tsx generate_xlsx.ts --content content.json [--tokens brand_tokens.json] [--theme dark|light] --output out.xlsx
 * Each section in content.json becomes a worksheet. section.heading = sheet name, section.items = data rows.
 */
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface BrandTheme {
  background: string;
  surface: string;
  text_primary: string;
  text_secondary: string;
  primary: string;
  accent: string;
}
interface BrandTokens {
  brand: string;
  version: number;
  themes: { dark: BrandTheme; light: BrandTheme };
  fonts: { headlines: string; body: string; fallback_sans: string };
}
interface Section {
  number?: string;
  label?: string;
  heading: string;
  body?: string;
  items?: string[];
  callout?: string;
}
interface Content {
  title: string;
  subtitle?: string;
  author?: string;
  sections: Section[];
}

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
      "Usage: npx tsx generate_xlsx.ts --content content.json [--tokens tokens.json] [--theme dark|light] --output out.xlsx",
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

const args = parseArgs();
const tokensPath = args.tokens
  ? resolve(process.cwd(), args.tokens)
  : join(__dirname, "../brand_tokens.json");
const tokens: BrandTokens = JSON.parse(readFileSync(tokensPath, "utf-8"));
const T = tokens.themes[args.theme];
const F = tokens.fonts;
const content: Content = JSON.parse(readFileSync(resolve(process.cwd(), args.content), "utf-8"));

// Strip # from hex for ExcelJS ARGB (expects AARRGGBB)
const argb = (hex: string) => "FF" + hex.replace("#", "").toUpperCase();

const wb = new ExcelJS.Workbook();
wb.creator = content.author ?? tokens.brand;
wb.created = new Date();
wb.modified = new Date();

for (const sec of content.sections) {
  const sheetName = (sec.heading ?? sec.label ?? "Sheet").slice(0, 31); // Excel 31-char limit
  const ws = wb.addWorksheet(sheetName, { properties: { tabColor: { argb: argb(T.accent) } } });

  // Header row
  const headerRow = ws.addRow(["#", "Item", "Details"]);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(T.primary) } };
    cell.font = {
      bold: true,
      color: { argb: argb(T.text_primary) },
      name: F.fallback_sans,
      size: 11,
    };
    cell.border = { bottom: { style: "thin", color: { argb: argb(T.accent) } } };
    cell.alignment = { vertical: "middle" };
  });
  ws.getRow(1).height = 22;

  // Data rows from items
  const items = sec.items ?? [];
  items.forEach((item, idx) => {
    const row = ws.addRow([idx + 1, item, sec.body ?? ""]);
    const isAlt = idx % 2 === 1;
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isAlt ? argb(T.surface) : argb(T.background) },
      };
      cell.font = { color: { argb: argb(T.text_primary) }, name: F.fallback_sans, size: 10 };
    });
  });

  // Callout note in a merged cell below data
  if (sec.callout) {
    const noteRow = ws.addRow([sec.callout]);
    ws.mergeCells(`A${noteRow.number}:C${noteRow.number}`);
    noteRow.getCell(1).font = {
      italic: true,
      color: { argb: argb(T.accent) },
      name: F.fallback_sans,
      size: 10,
    };
  }

  // Column widths
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 40;
  ws.getColumn(3).width = 40;
}

await wb.xlsx.writeFile(resolve(process.cwd(), args.output));
console.log(`XLSX written: ${args.output} (${content.sections.length} sheets)`);
