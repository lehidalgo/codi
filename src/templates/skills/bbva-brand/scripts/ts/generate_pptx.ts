#!/usr/bin/env npx tsx
/**
 * generate_pptx.ts — BBVA brand-specific PPTX generator.
 * Reproduces the BBVA official presentation template layouts (10" × 5.625").
 * Usage: npx tsx generate_pptx.ts --content content.json [--tokens brand_tokens.json] [--theme dark|light] --output out.pptx
 * When --tokens is omitted, uses bundled BBVA brand tokens.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

// pptxgenjs uses `export as namespace` which loses construct signatures under NodeNext.
// createRequire loads the CJS module directly, bypassing the ESM namespace wrapping.
const esmRequire = createRequire(import.meta.url);
type SlideMethod = (...args: unknown[]) => unknown;
interface ISlide {
  addText: SlideMethod;
  addShape: SlideMethod;
  addImage: SlideMethod;
  addTable: SlideMethod;
  background: { color: string };
  [key: string]: unknown;
}
interface IPres {
  layout: string;
  title: string;
  author: string;
  readonly ShapeType: Record<string, string>;
  defineLayout(layout: { name: string; width: number; height: number }): void;
  addSlide(): ISlide;
  writeFile(props: { fileName: string }): Promise<string>;
}
const _PptxRaw = esmRequire("pptxgenjs") as { new (): IPres; default?: { new (): IPres } };
const PptxGenJS = _PptxRaw.default ?? _PptxRaw;

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
  themes: { dark: BrandTheme; light: BrandTheme };
  fonts: { headlines: string; body: string; fallback_sans: string };
  assets?: Record<string, string>;
}

interface TitleSlide {
  type: "title";
  title?: string;
  subtitle?: string;
  author?: string;
  date?: string;
}
interface DividerSlide {
  type: "divider";
  heading: string;
  number?: string;
  label?: string;
}
interface SectionSlide {
  type: "section";
  heading: string;
  body?: string;
  items?: string[];
  callout?: string;
  breadcrumb?: string;
}
interface QuoteSlide {
  type: "quote";
  quote: string;
  attribution?: string;
}
interface MetricsSlide {
  type: "metrics";
  metrics: { value: string; label: string }[];
  heading?: string;
  breadcrumb?: string;
}
interface ClosingSlide {
  type: "closing";
  message: string;
  contact?: string;
}

type Slide = TitleSlide | DividerSlide | SectionSlide | QuoteSlide | MetricsSlide | ClosingSlide;
interface Content {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  slides: Slide[];
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
      "Usage: npx tsx generate_pptx.ts --content content.json [--tokens tokens.json] [--theme dark|light] --output out.pptx",
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
const h = (c: string) => c.replace("#", "");

const content: Content = JSON.parse(readFileSync(resolve(process.cwd(), args.content), "utf-8"));

const logoRelPath = tokens.assets?.[T.logo];
const logoPath = logoRelPath ? resolve(tokensDir, logoRelPath) : null;
const logoExists = logoPath ? existsSync(logoPath) : false;

// ── BBVA Layout Constants (10.000" × 5.625") ──────────────────────────────────

const W = 10.0; // slide width
const H = 5.625; // slide height
const ML = 0.366; // left margin (matches template)
const CW = W - ML * 2; // content width

// BBVA color palette from theme2.xml
const C = {
  dk1: "001391", // Electric Blue (primary dark)
  dk2: "070E46", // Midnight
  lt1: "FFFFFF", // White
  lt2: "F7F8F8", // Sand (light gray)
  accent1: "85C8FF", // Serene Blue / Ice
  accent3: "FFB56B", // Mandarin
  accent4: "FFE761", // Canary (yellow)
  accent5: "88E783", // Lime
};

// Metric box colors cycling
const METRIC_COLORS = [C.accent1, C.accent5, C.accent4, C.accent3];

const pres = new PptxGenJS();
pres.defineLayout({ name: "BBVA", width: W, height: H });
pres.layout = "BBVA";
pres.title = content.title;
pres.author = content.author ?? tokens.brand;

type S2D = ReturnType<typeof pres.addSlide>;

// ── Logo helper ───────────────────────────────────────────────────────────────

function addLogo(
  s: S2D,
  x: number,
  y: number,
  w: number,
  ht: number,
  align: "left" | "right" | "center" = "center",
): void {
  if (logoExists && logoPath) {
    try {
      s.addImage({ path: logoPath, x, y, w, h: ht, sizing: { type: "contain", w, h: ht } });
      return;
    } catch {
      /* fall through */
    }
  }
  s.addText(tokens.brand.toUpperCase(), {
    x,
    y,
    w,
    h: ht,
    color: h(T.accent),
    fontFace: F.fallback_sans,
    fontSize: 9,
    bold: true,
    charSpacing: 2,
    align,
  });
}

// ── Breadcrumb helper ─────────────────────────────────────────────────────────

function addBreadcrumb(s: S2D, breadcrumb: string | undefined): void {
  if (!breadcrumb) return;
  const parts = breadcrumb.split(" / ");
  const left = (parts[0] ?? "").trim();
  const right = parts.length > 1 ? parts.slice(1).join(" / ").trim() : "";
  const crumbStyle = {
    h: 0.118,
    color: h(T.primary ?? C.dk1),
    fontFace: F.body,
    fontSize: 7,
    charSpacing: 1,
  };
  s.addText(left.toUpperCase(), { x: ML, y: 0.359, w: 2.47, ...crumbStyle });
  if (right) {
    s.addText(right.toUpperCase(), { x: 3.296, y: 0.359, w: 2.797, ...crumbStyle });
  }
}

// ── Slide builders ────────────────────────────────────────────────────────────

function buildTitleSlide(slide: TitleSlide): void {
  const s = pres.addSlide();
  const isDark = args.theme === "dark";
  s.background = { color: isDark ? C.dk1 : C.lt1 };

  const title = slide.title ?? content.title;
  const subtitle = slide.subtitle ?? content.subtitle;
  const author = slide.author ?? content.author;
  const date = slide.date ?? content.date;
  const textCol = isDark ? C.lt1 : C.dk1;
  const subCol = isDark ? h(T.text_secondary) : C.dk2;

  if (isDark) {
    // Dark cover: title top-left, subtitle and photo right (Slide 7 pattern)
    if (date)
      s.addText(date, {
        x: ML,
        y: 2.645,
        w: 1.155,
        h: 0.202,
        color: subCol,
        fontFace: F.body,
        fontSize: 12,
      });
    if (subtitle)
      s.addText(subtitle, {
        x: ML,
        y: 4.539,
        w: 3.96,
        h: 0.316,
        color: subCol,
        fontFace: F.body,
        fontSize: 12,
      });
    s.addText(title, {
      x: ML,
      y: 1.222,
      w: 4.271,
      h: 1.527,
      color: textCol,
      fontFace: F.headlines,
      fontSize: 40,
      bold: true,
      wrap: true,
    });
    if (author)
      s.addText(author, {
        x: ML,
        y: H - 0.22,
        w: 4.0,
        h: 0.18,
        color: subCol,
        fontFace: F.body,
        fontSize: 9,
      });
  } else {
    // Light cover: Slide 6 pattern — date, subtitle, line, title
    if (date)
      s.addText(date, {
        x: 0.361,
        y: 2.645,
        w: 1.155,
        h: 0.202,
        color: C.dk2,
        fontFace: F.body,
        fontSize: 12,
      });
    if (subtitle)
      s.addText(subtitle, {
        x: 0.372,
        y: 2.9,
        w: 4.225,
        h: 0.237,
        color: C.dk2,
        fontFace: F.body,
        fontSize: 12,
      });
    // Horizontal line at y=3.234
    s.addShape(pres.ShapeType.line, {
      x: 0.372,
      y: 3.234,
      w: 9.256,
      h: 0,
      line: { color: C.dk1, width: 0.75, dashType: "solid" },
    });
    s.addText(title, {
      x: 0.366,
      y: 3.31,
      w: 9.268,
      h: 2.121,
      color: C.dk1,
      fontFace: F.headlines,
      fontSize: 67,
      bold: true,
      wrap: true,
      valign: "top",
    });
    if (author)
      s.addText(author, {
        x: ML,
        y: H - 0.22,
        w: 4.0,
        h: 0.18,
        color: C.dk2,
        fontFace: F.body,
        fontSize: 9,
      });
  }
}

function buildDividerSlide(slide: DividerSlide): void {
  const s = pres.addSlide();
  s.background = { color: C.accent1 };

  // Optional number/label above main title
  if (slide.number || slide.label) {
    const tag = [slide.number, slide.label].filter(Boolean).join("  ·  ");
    s.addText(tag.toUpperCase(), {
      x: ML,
      y: 4.2,
      w: CW,
      h: 0.25,
      color: C.dk1,
      fontFace: F.body,
      fontSize: 11,
      bold: true,
      charSpacing: 2,
    });
  }
  // Large title at bottom-left (Slide 12 pattern)
  s.addText(slide.heading, {
    x: 0.325,
    y: 4.572,
    w: 7.725,
    h: 0.846,
    color: C.dk1,
    fontFace: F.headlines,
    fontSize: 67,
    bold: true,
    wrap: true,
    valign: "top",
  });
}

function buildSectionSlide(slide: SectionSlide): void {
  const s = pres.addSlide();
  s.background = { color: C.lt1 };

  addBreadcrumb(s, slide.breadcrumb);

  // Title at y=0.857 (with breadcrumb) or y=0.248 (without)
  const titleY = slide.breadcrumb ? 0.857 : 0.248;
  s.addText(slide.heading, {
    x: 0.373,
    y: titleY,
    w: 7.338,
    h: 0.6,
    color: C.dk1,
    fontFace: F.headlines,
    fontSize: 30,
    bold: true,
    wrap: true,
  });

  let y = titleY + 0.7;

  if (slide.body) {
    s.addText(slide.body, {
      x: ML,
      y,
      w: CW,
      h: 1.0,
      color: C.dk2,
      fontFace: F.body,
      fontSize: 13,
      wrap: true,
    });
    y += 1.1;
  }

  if (slide.items?.length) {
    const bullets = slide.items.map((item) => ({
      text: item,
      options: { bullet: { type: "bullet" as const }, color: C.dk2, fontSize: 13 },
    }));
    s.addText(bullets, {
      x: ML,
      y,
      w: CW,
      h: slide.items.length * 0.3 + 0.1,
      fontFace: F.body,
      wrap: true,
    });
    y += slide.items.length * 0.3 + 0.2;
  }

  if (slide.callout) {
    s.addShape(pres.ShapeType.rect, {
      x: ML,
      y,
      w: CW,
      h: 0.65,
      fill: { color: C.lt2 },
      line: { color: C.dk1, width: 1 },
    });
    s.addText(slide.callout, {
      x: ML + 0.15,
      y: y + 0.1,
      w: CW - 0.3,
      h: 0.45,
      color: C.dk1,
      fontFace: F.body,
      fontSize: 12,
      italic: true,
      wrap: true,
    });
  }
}

function buildQuoteSlide(slide: QuoteSlide): void {
  const s = pres.addSlide();
  s.background = { color: C.dk1 };

  // Large opening quote mark
  s.addText("\u201C", {
    x: ML,
    y: 0.3,
    w: 1.0,
    h: 0.9,
    color: C.accent4,
    fontFace: F.headlines,
    fontSize: 80,
    bold: true,
  });
  s.addText(slide.quote, {
    x: ML,
    y: 1.1,
    w: CW,
    h: H - 2.4,
    color: C.lt1,
    fontFace: F.headlines,
    fontSize: 26,
    italic: true,
    wrap: true,
    valign: "middle",
  });

  if (slide.attribution) {
    s.addText(`\u2014 ${slide.attribution}`, {
      x: ML,
      y: H - 0.8,
      w: CW - 1.0,
      h: 0.35,
      color: C.accent4,
      fontFace: F.body,
      fontSize: 13,
      align: "right",
    });
  }
}

function buildMetricsSlide(slide: MetricsSlide): void {
  const s = pres.addSlide();
  s.background = { color: C.lt1 };

  addBreadcrumb(s, slide.breadcrumb);

  const titleY = slide.breadcrumb ? 0.857 : 0.248;
  if (slide.heading) {
    s.addText(slide.heading, {
      x: ML,
      y: titleY,
      w: CW,
      h: 0.42,
      color: C.dk1,
      fontFace: F.headlines,
      fontSize: 30,
      bold: true,
      wrap: true,
    });
  }

  const metrics = slide.metrics.slice(0, 4);
  const gap = 0.25;
  const boxW = (W - ML * 2 - gap * (metrics.length - 1)) / metrics.length;
  const boxY = titleY + 0.55;
  const boxH = H - boxY - 0.25;

  metrics.forEach((m, i) => {
    const bx = ML + i * (boxW + gap);
    const col = METRIC_COLORS[i % METRIC_COLORS.length];
    s.addShape(pres.ShapeType.rect, {
      x: bx,
      y: boxY,
      w: boxW,
      h: boxH,
      fill: { color: col },
      line: { type: "none" },
    });
    s.addText(m.value, {
      x: bx,
      y: boxY + 0.4,
      w: boxW,
      h: 1.4,
      color: C.dk1,
      fontFace: F.headlines,
      fontSize: 44,
      bold: true,
      align: "center",
      wrap: false,
    });
    s.addText(m.label, {
      x: bx,
      y: boxY + 2.0,
      w: boxW,
      h: 0.6,
      color: C.dk2,
      fontFace: F.body,
      fontSize: 12,
      align: "center",
      wrap: true,
    });
  });
}

function buildClosingSlide(slide: ClosingSlide): void {
  const s = pres.addSlide();
  s.background = { color: C.dk1 };

  // Logo centered near top (Slide 43 pattern: x=4.605, y=2.042, w=0.79, h=0.237)
  addLogo(s, 4.605, 2.042, 0.79, 0.237, "center");

  // Closing message centered
  s.addText(slide.message, {
    x: 2.458,
    y: 2.534,
    w: 5.085,
    h: 0.557,
    color: C.lt1,
    fontFace: F.headlines,
    fontSize: 36,
    bold: true,
    align: "center",
    wrap: true,
    valign: "middle",
  });

  if (slide.contact) {
    s.addText(slide.contact, {
      x: 2.458,
      y: 3.2,
      w: 5.085,
      h: 0.35,
      color: C.accent4,
      fontFace: F.body,
      fontSize: 15,
      align: "center",
    });
  }
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

function buildSlide(slide: Slide): void {
  switch (slide.type) {
    case "title":
      return buildTitleSlide(slide);
    case "divider":
      return buildDividerSlide(slide);
    case "section":
      return buildSectionSlide(slide);
    case "quote":
      return buildQuoteSlide(slide);
    case "metrics":
      return buildMetricsSlide(slide);
    case "closing":
      return buildClosingSlide(slide);
  }
}

content.slides.forEach(buildSlide);
await pres.writeFile({ fileName: resolve(process.cwd(), args.output) });

const counts = content.slides.reduce(
  (acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);
console.log(
  `BBVA PPTX written: ${args.output} (${content.slides.length} slides — ${Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ")})`,
);
