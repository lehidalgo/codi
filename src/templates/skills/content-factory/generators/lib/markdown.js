// Minimal Markdown → HTML renderer. Zero-dependency. Covers everything an
// anchor typically contains: YAML frontmatter (stripped from body, surfaced
// in the returned meta), ATX headings (# .. ######), paragraphs, unordered
// and ordered lists, fenced code blocks with optional language, inline
// code, bold, italic, strikethrough, links, images, blockquotes, horizontal
// rules, and pipe-separated tables.
//
// Not a full CommonMark implementation — intentionally. An anchor is author
// prose; the rendering fidelity we care about is "reads clean on the
// preview page and distills cleanly into variants." Edge-case Markdown
// (nested lists beyond one level, reference-style links, HTML passthrough)
// is rejected in favor of keeping this file under 200 lines.

const YAML_FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseFrontmatter(src) {
  const m = src.match(YAML_FRONTMATTER_RE);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    meta[kv[1]] = val;
  }
  return { meta, body: src.slice(m[0].length) };
}

function renderInline(text) {
  let out = escapeHtml(text);
  // Images first (before links, same syntax prefix)
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_, alt, src, title) => `<img src="${src}" alt="${alt}"${title ? ` title="${title}"` : ""}>`,
  );
  // Links
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_, label, href, title) => `<a href="${href}"${title ? ` title="${title}"` : ""}>${label}</a>`,
  );
  // Inline code — must run before other inline formatters so code contents
  // aren't re-parsed as bold/italic/etc.
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // Bold (**x** or __x__)
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // Italic (*x* or _x_) — guard against matching inside already-closed
  // strong tags by requiring the star not be adjacent to another star.
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  // Strikethrough
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return out;
}

function renderTable(rows) {
  // rows[0] = header cells, rows[1] = separator (ignored), rows[2..] = body
  const head = rows[0].map((c) => `<th>${renderInline(c.trim())}</th>`).join("");
  const body = rows
    .slice(2)
    .map((r) => "<tr>" + r.map((c) => `<td>${renderInline(c.trim())}</td>`).join("") + "</tr>")
    .join("");
  return `<table class="md-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function splitCells(row) {
  // Strip leading/trailing pipes then split on pipes
  return row
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|");
}

// The main block-level renderer. Walks the source line by line, accumulating
// one block at a time. Any block that starts with a recognizable marker
// (heading, fence, list bullet, quote, hr, table) is dispatched; otherwise
// contiguous lines form a paragraph.
function renderBody(src) {
  const lines = src.split("\n");
  let i = 0;
  const out = [];
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    // Horizontal rule
    if (/^\s*([-*_])\s*\1\s*\1[-*_\s]*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }
    // ATX heading
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      out.push(`<h${h[1].length}>${renderInline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }
    // Fenced code block
    const fence = line.match(/^```\s*([A-Za-z0-9_-]*)\s*$/);
    if (fence) {
      const lang = fence[1] || "";
      i++;
      const buf = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      const langAttr = lang ? ` class="language-${lang}"` : "";
      out.push(`<pre><code${langAttr}>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }
    // Blockquote
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderBody(buf.join("\n"))}</blockquote>`);
      continue;
    }
    // Table — requires a header row and a separator line of dashes
    if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*[-:]+/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) {
        rows.push(splitCells(lines[i]));
        i++;
      }
      if (rows.length >= 2) {
        out.push(renderTable(rows));
        continue;
      }
    }
    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      out.push(`<ul>${items.map((x) => `<li>${renderInline(x)}</li>`).join("")}</ul>`);
      continue;
    }
    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push(`<ol>${items.map((x) => `<li>${renderInline(x)}</li>`).join("")}</ol>`);
      continue;
    }
    // Paragraph — gather until a blank line or another block marker appears
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^#{1,6}\s|^```|^\s*>|^\s*[-*+]\s|^\s*\d+\.\s/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInline(buf.join("\n"))}</p>`);
  }
  return out.join("\n");
}

// Public API. Returns { html, meta } so callers can surface frontmatter
// fields (title, audience, voice, etc.) in the preview header.
export function renderMarkdown(src) {
  const { meta, body } = parseFrontmatter(String(src || ""));
  return { html: renderBody(body), meta };
}

// A4 page content area. The card iframe height is 1123px; subtracting the
// 72px top + 72px bottom padding from .doc-page leaves ~979px for actual
// content. Leave a small safety margin (20px) so last-line descenders and
// a hairline box-shadow never visually clip against the page edge.
const PAGE_HEIGHT_PX = 1123;
const PAGE_PADDING_TOP = 72;
const PAGE_PADDING_BOTTOM = 72;
const PAGE_SAFETY_MARGIN = 20;
const PAGE_CONTENT_LIMIT =
  PAGE_HEIGHT_PX - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM - PAGE_SAFETY_MARGIN;

// Paginate rendered HTML into page-sized chunks by actually measuring each
// top-level block's height in the browser. Each chunk never exceeds one A4
// page of content. A new page starts at every <h2> boundary (semantic
// break) OR when the next block would push the accumulated height past the
// per-page limit (overflow break). This is the real fix for "content
// cropped at page edge" — nothing is rendered beyond a single A4 canvas,
// everything flows to the next page.
//
// Measurement runs synchronously via a hidden, offscreen host element
// whose inner structure mirrors the card iframe's layout so offsetHeight
// readings match what the preview actually renders. Any overflow the
// browser would have clipped becomes a real page break instead.
function paginateHtmlByHeight(bodyHtml) {
  if (typeof document === "undefined" || !bodyHtml) return [bodyHtml || ""];
  // Parse the source HTML via DOMParser (safer than assigning to innerHTML
  // — the content came from our Markdown renderer so it is already
  // trusted, but we route through the parser for defensive habit).
  const parsed = new DOMParser().parseFromString(
    "<!doctype html><html><body>" + bodyHtml + "</body></html>",
    "text/html",
  );
  const sourceChildren = Array.from(parsed.body.children);
  if (!sourceChildren.length) return [bodyHtml];
  // Build the offscreen measurement host structurally (no HTML parsing
  // of user content into the live DOM).
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;visibility:hidden;pointer-events:none;contain:layout style;";
  const style = document.createElement("style");
  style.textContent = DOC_PAGE_STYLE;
  host.appendChild(style);
  const article = document.createElement("article");
  article.className = "doc-page";
  article.style.cssText = "min-height:0;margin:0;box-shadow:none;";
  for (const child of sourceChildren) article.appendChild(child.cloneNode(true));
  host.appendChild(article);
  document.body.appendChild(host);
  try {
    const liveChildren = Array.from(article.children);
    const chunks = [];
    const currentParts = [];
    let currentHeight = 0;
    const push = () => {
      if (currentParts.length) {
        chunks.push(currentParts.join(""));
        currentParts.length = 0;
        currentHeight = 0;
      }
    };
    for (const child of liveChildren) {
      const cs = getComputedStyle(child);
      const blockHeight =
        child.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
      const isH2 = child.tagName === "H2";
      const wouldOverflow = currentHeight + blockHeight > PAGE_CONTENT_LIMIT;
      // Start a new page for every H2 (semantic break) OR when the block
      // would push us past the page height (overflow break). Never emit
      // an empty chunk — if the accumulated page is empty, keep appending
      // so a single oversized block still occupies exactly one page
      // rather than breaking into a blank page followed by the block.
      if ((isH2 || wouldOverflow) && currentParts.length) push();
      currentParts.push(child.outerHTML);
      currentHeight += blockHeight;
    }
    push();
    return chunks.length ? chunks : [bodyHtml];
  } finally {
    document.body.removeChild(host);
  }
}

// Minimal doc-page CSS — identical in spirit to document-base.html's
// :where(:root) defaults. Light by default, brand-agnostic. Injected into
// each rendered Markdown document so preview is fully self-contained.
const DOC_PAGE_STYLE = `
  html, body { margin: 0; padding: 0; background: #e5e5e5; }
  .doc-page {
    background: #ffffff;
    color: #111115;
    width: 794px;
    min-height: 1123px;
    padding: 72px 88px;
    margin: 0 auto 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,.12);
    font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    line-height: 1.65;
    box-sizing: border-box;
  }
  .doc-page h1 { font-size: 36px; font-weight: 700; margin: 0 0 18px; letter-spacing: -0.01em; }
  .doc-page h2 { font-size: 26px; font-weight: 600; margin: 0 0 14px; }
  .doc-page h3 { font-size: 20px; font-weight: 600; margin: 22px 0 10px; }
  .doc-page p  { margin: 0 0 14px; font-size: 15px; color: #30363d; }
  .doc-page ul, .doc-page ol { margin: 0 0 14px 22px; padding: 0; }
  .doc-page li { margin: 4px 0; font-size: 15px; color: #30363d; }
  .doc-page code { background: #f6f8fa; padding: 2px 6px; border-radius: 4px; font-family: "Geist Mono", ui-monospace, monospace; font-size: 13px; }
  .doc-page pre  { background: #0d1117; color: #e6edf3; padding: 18px 22px; border-radius: 8px; overflow-x: auto; margin: 0 0 16px; }
  .doc-page pre code { background: transparent; padding: 0; color: inherit; font-size: 13.5px; }
  .doc-page blockquote { border-left: 3px solid #d0d7de; padding: 4px 0 4px 16px; color: #57606a; margin: 0 0 14px; font-style: italic; }
  .doc-page .md-table { width: 100%; border-collapse: collapse; margin: 0 0 16px; font-size: 14px; }
  .doc-page .md-table th { background: #f6f8fa; text-align: left; padding: 10px 12px; border-bottom: 1px solid #d0d7de; }
  .doc-page .md-table td { padding: 10px 12px; border-bottom: 1px solid #eaeef2; }
  .doc-page a { color: #0969da; text-decoration: none; }
  .doc-page a:hover { text-decoration: underline; }
  .anchor-meta {
    font-size: 12px; color: #57606a; margin-bottom: 28px;
    padding-bottom: 14px; border-bottom: 1px solid #eaeef2;
    font-family: "Geist Mono", ui-monospace, monospace;
  }
  .anchor-meta .k { font-weight: 600; color: #30363d; }
`;

// Render a Markdown source string into a COMPLETE HTML document that
// content-factory's preview treats identically to any other .html
// document variant: a series of `<article class="doc-page">` elements,
// one per natural page break (auto-split at each H2). The first page
// surfaces the frontmatter (title, audience, voice) above the content.
//
// The preview / parseCards / type-inference / export pipelines all work
// unchanged — no "anchor" data-type, no custom wrappers, no parallel
// CSS. Any long-form Markdown renders as if it were a hand-written HTML
// document file.
export function renderMarkdownAsDocument(mdSource) {
  const { html, meta } = renderMarkdown(mdSource);
  const pages = paginateHtmlByHeight(html);
  const title = meta.title || meta.name || "Anchor";
  const frontmatterPills = Object.entries(meta)
    .filter(([, v]) => String(v || "").trim() !== "")
    .map(([k, v]) => `<span><span class="k">${k}</span>: ${String(v)}</span>`)
    .join(" · ");
  const articles = pages
    .map((pageHtml, ix) => {
      const isFirst = ix === 0;
      const meta =
        isFirst && frontmatterPills ? `<div class="anchor-meta">${frontmatterPills}</div>` : "";
      return (
        `<article class="doc-page" data-type="${isFirst ? "cover" : "body"}" data-index="${String(ix + 1).padStart(2, "0")}">` +
        meta +
        pageHtml +
        `</article>`
      );
    })
    .join("\n");
  // Emit the standard codi:template meta so parseTemplate — called by the
  // gallery and file-manager loaders — correctly classifies the rendered
  // anchor as a document with A4 dimensions, without any caller-side
  // branching on ".md" files.
  const templateMeta = JSON.stringify({
    id: "anchor-markdown",
    name: title,
    type: "document",
    format: { w: 794, h: 1123 },
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="codi:template" content='${templateMeta.replace(/'/g, "&#39;")}'>
<style>${DOC_PAGE_STYLE}</style>
</head>
<body>
${articles}
</body>
</html>`;
}
