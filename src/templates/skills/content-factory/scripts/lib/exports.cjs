'use strict';
/**
 * exports.cjs — Heavy export handlers for PNG, PDF, and DOCX.
 * Each handler receives (req, res) and returns a Promise.
 * All handlers share the warm Playwright browser from renderer.cjs
 * instead of launching a fresh one per request.
 */

const { getBrowser } = require('./box-layout/renderer.cjs');

// Run async tasks with bounded concurrency.
async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

const RENDER_CONCURRENCY = 3;

// Device scale factor for all export pipelines (PNG, PDF, DOCX, and by
// extension PPTX + ZIP which both route through /api/export-png).
// 3× is the retina print-quality standard — sharp on high-DPI displays
// and print output, without the file-size and OOM cost of 4×.
const EXPORT_DEVICE_SCALE = 3;

// ── PNG ──────────────────────────────────────────────────────────────────────

async function handleExportPng(req, res) {
  let body = '';
  req.on('data', d => { body += d; });
  return new Promise(resolve => {
    req.on('end', async () => {
      try {
        const { html, width, height } = JSON.parse(body);
        if (!html || !width || !height) { res.writeHead(400); res.end('Missing html/width/height'); return resolve(); }
        const browser = await getBrowser();
        const page = await browser.newPage({ deviceScaleFactor: EXPORT_DEVICE_SCALE });
        await page.setViewportSize({ width, height });
        await page.setContent(html, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.fonts.ready);
        const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
        await page.close();
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length });
        res.end(png);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      resolve();
    });
  });
}

// ── PDF ──────────────────────────────────────────────────────────────────────

async function handleExportPdf(req, res) {
  let body = '';
  req.on('data', d => { body += d; });
  return new Promise(resolve => {
    req.on('end', async () => {
      try {
        const { slides } = JSON.parse(body);
        if (!Array.isArray(slides) || slides.length === 0) {
          res.writeHead(400); res.end('Missing slides array'); return resolve();
        }
        const browser = await getBrowser();
        const PDF_DEVICE_SCALE = EXPORT_DEVICE_SCALE;
        const validSlides = slides.filter(s => s.html && s.width && s.height);
        const pngDataUrls = await mapConcurrent(validSlides, RENDER_CONCURRENCY, async (slide) => {
          const { html, width, height } = slide;
          const page = await browser.newPage({ deviceScaleFactor: PDF_DEVICE_SCALE });
          await page.setViewportSize({ width, height });
          await page.setContent(html, { waitUntil: 'networkidle' });
          await page.waitForFunction(() => document.fonts.ready);
          const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
          await page.close();
          return { dataUrl: 'data:image/png;base64,' + png.toString('base64'), width, height };
        });
        if (pngDataUrls.length === 0) { res.writeHead(500); res.end('No slides rendered'); return resolve(); }
        const { width: pw, height: ph } = pngDataUrls[0];
        const pageItems = pngDataUrls.map((s, i) => {
          const cls = i < pngDataUrls.length - 1 ? ' class="break"' : '';
          return `<div${cls} style="width:${s.width}px;height:${s.height}px;overflow:hidden;"><img src="${s.dataUrl}" width="${s.width}" height="${s.height}" style="display:block;width:100%;height:100%;object-fit:cover;"></div>`;
        }).join('\n');
        const combinedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box;}
@page{size:${pw}px ${ph}px;margin:0;}
body{background:#fff;}
div.break{page-break-after:always;}
</style></head><body>${pageItems}</body></html>`;
        const pdfPage = await browser.newPage();
        await pdfPage.setViewportSize({ width: pw, height: ph });
        await pdfPage.setContent(combinedHtml, { waitUntil: 'networkidle' });
        await pdfPage.waitForFunction(() => document.fonts.ready);
        const pdfBuffer = await pdfPage.pdf({
          width: pw + 'px', height: ph + 'px', printBackground: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });
        await pdfPage.close();
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Length': pdfBuffer.length,
          'Content-Disposition': 'attachment; filename="export.pdf"',
        });
        res.end(pdfBuffer);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      resolve();
    });
  });
}

// ── DOCX ─────────────────────────────────────────────────────────────────────
// Walks DOM nodes to capture per-run inline styles (bold, italic, color, code
// highlight, etc.) so DOCX paragraphs faithfully reflect the HTML formatting.

async function handleExportDocx(req, res) {
  let body = '';
  req.on('data', d => { body += d; });
  return new Promise(resolve => {
    req.on('end', async () => {
      try {
        const { slides } = JSON.parse(body);
        if (!Array.isArray(slides) || slides.length === 0) {
          res.writeHead(400); res.end('Missing slides array'); return resolve();
        }
        const { Document, Packer, Paragraph, TextRun, BorderStyle, PageBreak, ShadingType,
                Table, TableRow, TableCell, WidthType, ImageRun } = require('docx');

        // Read width/height from PNG IHDR chunk (bytes 16-23). Returns CSS pixels by
        // dividing by deviceScaleFactor so ImageRun.transformation dimensions are correct.
        function pngCssDimensions(buf, deviceScaleFactor) {
          if (!buf || buf.length < 24) return null;
          const w = buf.readUInt32BE(16);
          const h = buf.readUInt32BE(20);
          if (!w || !h) return null;
          return { w: w / deviceScaleFactor, h: h / deviceScaleFactor };
        }

        const DOCX_DEVICE_SCALE = EXPORT_DEVICE_SCALE;
        const browser = await getBrowser();
        const slideResults = await mapConcurrent(slides, RENDER_CONCURRENCY, async (slide) => {
          const { html, width, height } = slide;
          const page = await browser.newPage({ deviceScaleFactor: DOCX_DEVICE_SCALE });
          await page.setViewportSize({ width: width || 794, height: height || 1123 });
          await page.setContent(html, { waitUntil: 'networkidle' });

          const pageData = await page.evaluate(() => {
            function toHex(rgb) {
              const s = String(rgb || '');
              if (!s || s === 'transparent') return null;
              // alpha = 0 → fully transparent, treat as no fill
              const rgba = s.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
              if (rgba && parseFloat(rgba[4]) < 0.05) return null;
              const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
              if (!m) return null;
              const h = [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('');
              // treat pure white as no fill (page background)
              return h === 'ffffff' ? null : h;
            }
            function halfPt(pxStr) { return Math.max(18, Math.round(parseFloat(pxStr || '14') * 1.5)); }
            function pickFont(ff) {
              if ((ff || '').includes('Outfit')) return 'Outfit';
              if ((ff || '').includes('Geist') || (ff || '').includes('mono', 10)) return 'Courier New';
              return 'Arial';
            }
            function collapseWs(t) { return t.replace(/\s+/g, ' '); }

            // Walk inline child nodes of a block element and return an array of
            // run descriptors: { text, color, size, bold, italic, font, bgColor? }
            function extractRuns(blockEl, parentStyle) {
              const runs = [];
              function walk(node, style) {
                if (node.nodeType === 3) { // text node
                  const t = collapseWs(node.textContent);
                  if (t) runs.push({ ...style, text: t });
                  return;
                }
                if (node.nodeType !== 1) return;
                const tag = (node.tagName || '').toLowerCase();
                const cls = typeof node.className === 'string' ? node.className : '';
                const cs = window.getComputedStyle(node);

                // Resolve color — handle CSS gradient text (webkitTextFillColor: transparent)
                let color = toHex(cs.color) || style.color;
                const fillColor = cs.webkitTextFillColor || '';
                if (fillColor === 'rgba(0, 0, 0, 0)' || fillColor === 'transparent') {
                  // Gradient text: extract first color stop from backgroundImage
                  const bgImg = cs.backgroundImage || '';
                  const gm = bgImg.match(/rgba?\([^)]+\)/);
                  if (gm) color = toHex(gm[0]) || color;
                }
                const bgColor = toHex(cs.backgroundColor);
                const bold = style.bold || parseInt(cs.fontWeight || '400') >= 700
                  || tag === 'strong' || tag === 'b';
                const italic = style.italic || cs.fontStyle === 'italic' || tag === 'em' || tag === 'i';
                const font = (tag === 'code' || tag === 'kbd' || tag === 'samp' ||
                              cls.includes('mono') || cls.includes('code'))
                  ? 'Courier New' : pickFont(cs.fontFamily);

                const next = { ...style, color, bold, italic, font, size: halfPt(cs.fontSize) };
                if (bgColor) next.bgColor = bgColor;

                // For inline code: treat as atomic run
                if (tag === 'code' || tag === 'kbd' || tag === 'samp') {
                  const t = collapseWs(node.textContent);
                  if (t) runs.push({ ...next, text: t });
                  return;
                }
                for (const child of node.childNodes) walk(child, next);
              }
              walk(blockEl, parentStyle);
              // Merge adjacent runs with identical style to reduce noise
              const merged = [];
              for (const r of runs) {
                const prev = merged[merged.length - 1];
                if (prev && prev.bold === r.bold && prev.italic === r.italic &&
                    prev.color === r.color && prev.font === r.font && prev.bgColor === r.bgColor) {
                  prev.text += r.text;
                } else {
                  merged.push({ ...r });
                }
              }
              return merged.filter(r => r.text.trim() || r.text === ' ');
            }

            function extractPage(root, pageType) {
              const els = [];
              function walk(el) {
                const tag = (el.tagName || '').toLowerCase();
                const cls = typeof el.className === 'string' ? el.className : '';
                if (cls.includes('cover-accent') || cls.includes('brand-bar')) return;

                const cs = window.getComputedStyle(el);
                const base = {
                  color: toHex(cs.color) || '1a1a1a',
                  size:  halfPt(cs.fontSize),
                  bold:  parseInt(cs.fontWeight || '400') >= 600,
                  italic: cs.fontStyle === 'italic',
                  font:  pickFont(cs.fontFamily),
                  pageType,
                };

                // Page header: extract each span with its own computed color
                // (handles gradient logo + muted meta on the right)
                if (cls.includes('page-header')) {
                  const spans = Array.from(el.querySelectorAll('span'));
                  const runs = [];
                  for (let si = 0; si < spans.length; si++) {
                    const s = spans[si];
                    const scs = window.getComputedStyle(s);
                    let color = toHex(scs.color) || base.color;
                    const fill = scs.webkitTextFillColor || '';
                    if (fill === 'rgba(0, 0, 0, 0)' || fill === 'transparent') {
                      const gm = (scs.backgroundImage || '').match(/rgba?\([^)]+\)/);
                      if (gm) color = toHex(gm[0]) || color;
                    }
                    const t = collapseWs(s.textContent).trim();
                    if (!t) continue;
                    if (runs.length) runs.push({ text: '    ', color: base.color,
                      size: halfPt(scs.fontSize), font: pickFont(scs.fontFamily), bold: false, italic: false });
                    runs.push({ text: t, color, size: halfPt(scs.fontSize),
                      font: pickFont(scs.fontFamily),
                      bold: parseInt(scs.fontWeight || '400') >= 600,
                      italic: scs.fontStyle === 'italic' });
                  }
                  if (!runs.length) {
                    const t = collapseWs(el.textContent).trim();
                    if (t) runs.push({ text: t, ...base });
                  }
                  if (runs.length) els.push({ role: 'header', runs, ...base,
                    borderColor: toHex(cs.borderBottomColor) || 'dddddd' });
                  return;
                }

                // Footer: two spans joined with separator
                if (cls.includes('page-footer')) {
                  const parts = Array.from(el.querySelectorAll('span'))
                    .map(s => collapseWs(s.textContent).trim()).filter(Boolean);
                  const t = parts.length ? parts.join('   ·   ') : collapseWs(el.textContent).trim();
                  if (t) els.push({ role: 'footer', text: t, ...base,
                    borderColor: toHex(cs.borderTopColor) || 'dddddd' });
                  return;
                }

                // Page tag / label (e.g. ".page-tag", ".doc-label", ".eyebrow")
                if (cls.includes('page-tag') || cls.includes('doc-label') || cls.includes('eyebrow')) {
                  const t = collapseWs(el.textContent).trim();
                  if (t) els.push({ role: 'label', text: t, ...base });
                  return;
                }

                // Block headings: no inline runs needed (usually single-style)
                if (tag === 'h1') {
                  const runs = extractRuns(el, base);
                  if (runs.length) els.push({ role: 'h1', runs, ...base });
                } else if (tag === 'h2') {
                  const runs = extractRuns(el, base);
                  if (runs.length) els.push({ role: 'h2', runs, ...base });
                } else if (tag === 'h3') {
                  const runs = extractRuns(el, base);
                  if (runs.length) els.push({ role: 'h3', runs, ...base });
                } else if (tag === 'p') {
                  const runs = extractRuns(el, base);
                  const hasContent = runs.some(r => r.text.trim().length > 1);
                  const allDigits = runs.every(r => /^\d+$/.test(r.text.trim()));
                  if (hasContent && !allDigits) {
                    const role = cls.includes('doc-subtitle') ? 'subtitle' : 'p';
                    els.push({ role, runs, ...base });
                  }
                } else if (tag === 'ul' || tag === 'ol') {
                  for (const li of el.children) {
                    const lics = window.getComputedStyle(li);
                    const liBase = { ...base, color: toHex(lics.color) || base.color,
                      size: halfPt(lics.fontSize), bold: false, italic: false };
                    const runs = extractRuns(li, liBase);
                    if (runs.some(r => r.text.trim())) els.push({ role: 'li', runs, ...liBase });
                  }
                } else if (cls.includes('callout')) {
                  const runs = extractRuns(el, { ...base, italic: true });
                  if (runs.some(r => r.text.trim())) els.push({ role: 'callout', runs, ...base,
                    borderColor: toHex(cs.borderLeftColor) || '3B82F6',
                    bgColor: toHex(cs.backgroundColor) || 'F0F9FF' });
                } else if (cls.includes('doc-meta')) {
                  const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
                  if (t) els.push({ role: 'meta', text: t, ...base });

                // ── TABLE ────────────────────────────────────────────────────
                } else if (tag === 'table') {
                  const headers = [];
                  const thead = el.querySelector('thead');
                  if (thead) {
                    Array.from(thead.querySelectorAll('th')).forEach(th => {
                      const ths = window.getComputedStyle(th);
                      headers.push({
                        text: collapseWs(th.textContent).trim(),
                        color: toHex(ths.color) || 'ffffff',
                        bgColor: toHex(ths.backgroundColor) || '3b5bdb',
                        bold: true, size: halfPt(ths.fontSize), font: pickFont(ths.fontFamily),
                      });
                    });
                  }
                  const rows = [];
                  const tbody = el.querySelector('tbody') || el;
                  Array.from(tbody.querySelectorAll('tr')).forEach((tr, ri) => {
                    const cells = Array.from(tr.querySelectorAll('td')).map(td => {
                      const tds = window.getComputedStyle(td);
                      return {
                        text: collapseWs(td.textContent).trim(),
                        color: toHex(tds.color) || base.color,
                        bgColor: toHex(tds.backgroundColor),
                        bold: parseInt(tds.fontWeight || '400') >= 600,
                        size: halfPt(tds.fontSize), font: pickFont(tds.fontFamily),
                      };
                    });
                    if (cells.some(c => c.text)) rows.push(cells);
                  });
                  if (headers.length || rows.length) {
                    const diIdx = els.filter(e => e.role === 'table').length;
                    els.push({ role: 'table', headers, rows, diagramIndex: diIdx, ...base });
                  }

                // ── DIAGRAM / SVG FIGURE ─────────────────────────────────────
                } else if (cls.includes('diagram-wrap') || cls.includes('diagram-container') ||
                           tag === 'figure' ||
                           (tag === 'div' && Array.from(el.children).some(c => c.tagName.toLowerCase() === 'svg'))) {
                  // Use the wrapper's bounding rect for capturedWidth/Height so the
                  // DOCX ImageRun display dimensions match the Playwright screenshot
                  // dimensions (same aspect ratio). The screenshot is taken from this
                  // same wrapper element below, so dimensions must agree.
                  const rect = el.getBoundingClientRect();
                  const captionEl = el.querySelector('.diagram-caption, figcaption, caption');
                  const caption = captionEl ? collapseWs(captionEl.textContent).trim() : '';
                  const diagIdx = els.filter(e => e.role === 'diagram').length;
                  els.push({ role: 'diagram', diagramIndex: diagIdx, caption,
                    capturedWidth: Math.round(rect.width) || 580,
                    capturedHeight: Math.round(rect.height) || 200, ...base });

                // ── VISUAL BLOCKS (stat rows, feature grids, step lists) ────
                // These use custom div classes whose text nodes are nested inside
                // non-semantic divs — text is unreachable via the element walker.
                // Capture the whole container as a PNG screenshot instead.
                } else if (cls.includes('stat-row') || cls.includes('two-col') ||
                           cls.includes('step-list') || cls.includes('feature-grid') ||
                           cls.includes('metric-row') || cls.includes('card-grid') ||
                           cls.includes('cover-hero') || cls.includes('toc-list') ||
                           cls.includes('cover-toc-title')) {
                  const blockIdx = els.filter(e => e.role === 'visual-block').length;
                  const rect = el.getBoundingClientRect();
                  els.push({ role: 'visual-block', blockIndex: blockIdx,
                    capturedWidth: Math.round(rect.width) || 580,
                    capturedHeight: Math.round(rect.height) || 200, ...base });

                // ── CODE BLOCK ──────────────────────────────────────────────
                } else if (cls.includes('code-block')) {
                  const captionEl = el.querySelector('.code-lang, .code-title, .code-label');
                  const caption = captionEl ? collapseWs(captionEl.textContent).trim() : '';
                  const codeIdx = els.filter(e => e.role === 'code-block').length;
                  const rect = el.getBoundingClientRect();
                  els.push({ role: 'code-block', codeIndex: codeIdx, caption,
                    capturedWidth: Math.round(rect.width) || 580,
                    capturedHeight: Math.round(rect.height) || 200, ...base });

                // ── INLINE IMAGE ─────────────────────────────────────────────
                } else if (tag === 'img') {
                  const rect = el.getBoundingClientRect();
                  const src = el.src || el.getAttribute('src') || '';
                  if (src) els.push({ role: 'img', src,
                    capturedWidth: Math.round(rect.width) || 400,
                    capturedHeight: Math.round(rect.height) || 300, ...base });

                } else {
                  for (const child of el.children) walk(child);
                }
              }
              walk(root);
              return els;
            }

            const docPages = document.querySelectorAll('.doc-page');
            if (docPages.length > 0) {
              return Array.from(docPages).map(p => ({
                type: p.dataset.type || 'body',
                elements: extractPage(p, p.dataset.type || 'body'),
              }));
            }
            const allText = document.body.innerText.trim();
            return [{ type: 'body', elements: allText ? [{ role: 'p', runs: [{ text: allText }] }] : [] }];
          });

          // Screenshot every diagram element before the page closes
          // Playwright locator.screenshot() captures the element at 1x exactly
          const diagLocators = await page.locator('.diagram-wrap, .diagram-container, figure').all();
          const diagramPngs = {};
          for (let di = 0; di < diagLocators.length; di++) {
            try {
              const png = await diagLocators[di].screenshot({ type: 'png' });
              diagramPngs[di] = png.toString('base64');
            } catch (_) { /* element may be offscreen — skip */ }
          }
          // Screenshot visual block containers (stat rows, feature grids, step lists)
          const blockLocators = await page.locator(
            '.stat-row, .two-col, .step-list, .feature-grid, .metric-row, .card-grid, ' +
            '.cover-hero, .toc-list, .cover-toc-title'
          ).all();
          const blockPngs = {};
          for (let bi = 0; bi < blockLocators.length; bi++) {
            try {
              const png = await blockLocators[bi].screenshot({ type: 'png' });
              blockPngs[bi] = png.toString('base64');
            } catch (_) { /* element may be offscreen — skip */ }
          }

          // Screenshot every code block element
          const codeLocators = await page.locator('.code-block').all();
          const codePngs = {};
          for (let ci = 0; ci < codeLocators.length; ci++) {
            try {
              const png = await codeLocators[ci].screenshot({ type: 'png' });
              codePngs[ci] = png.toString('base64');
            } catch (_) { /* element may be offscreen — skip */ }
          }

          // Attach screenshot PNGs to their matching elements
          for (const pg of pageData) {
            for (const el of pg.elements) {
              if (el.role === 'diagram' && diagramPngs[el.diagramIndex] !== undefined) {
                el.pngBase64 = diagramPngs[el.diagramIndex];
              }
              if (el.role === 'visual-block' && blockPngs[el.blockIndex] !== undefined) {
                el.pngBase64 = blockPngs[el.blockIndex];
              }
              if (el.role === 'code-block' && codePngs[el.codeIndex] !== undefined) {
                el.pngBase64 = codePngs[el.codeIndex];
              }
              if (el.role === 'img' && el.src) {
                const src = el.src;
                if (src.startsWith('data:image')) {
                  el.pngBase64 = src.split(',')[1]; // already base64
                } else if (src.startsWith('file://')) {
                  try {
                    const fs = require('fs');
                    el.pngBase64 = fs.readFileSync(src.replace('file://', '')).toString('base64');
                  } catch (_) { /* file not found */ }
                }
              }
            }
          }

          await page.close();
          return pageData;
        });
        const allPageElements = slideResults.flat();

        // Convert a run descriptor array → docx TextRun array
        function makeRuns(el, overrides) {
          const runList = el.runs || [{ text: el.text || '', color: el.color, size: el.size,
            bold: el.bold, italic: el.italic, font: el.font }];
          return runList.map(r => {
            const spec = {
              text: r.text,
              color: r.color || el.color || '1a1a1a',
              size: r.size || el.size || 21,
              font: r.font || el.font || 'Arial',
              bold: r.bold || false,
              italics: r.italic || false,
              ...(overrides || {}),
            };
            if (r.bgColor) {
              spec.shading = { type: ShadingType.CLEAR, color: 'auto', fill: r.bgColor };
            }
            return new TextRun(spec);
          });
        }

        const children = [];
        for (let pi = 0; pi < allPageElements.length; pi++) {
          const { elements } = allPageElements[pi];
          for (const el of elements) {
            switch (el.role) {
              case 'header':
                children.push(new Paragraph({
                  children: makeRuns(el),
                  spacing: { after: 200, before: 0 },
                  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: el.borderColor || 'dddddd', space: 6 } },
                })); break;
              case 'label':
                children.push(new Paragraph({
                  children: [new TextRun({ text: (el.text || '').toUpperCase(), color: el.color, size: Math.max(16, el.size - 4), font: el.font })],
                  spacing: { after: 80, before: 0 },
                })); break;
              case 'h1':
                children.push(new Paragraph({
                  children: makeRuns(el, { bold: true }),
                  spacing: { after: 280, before: el.pageType === 'cover' ? 0 : 320 },
                })); break;
              case 'h2':
                children.push(new Paragraph({
                  children: makeRuns(el, { bold: true }),
                  spacing: { after: 200, before: 320 },
                  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: el.color, space: 8 } },
                })); break;
              case 'h3':
                children.push(new Paragraph({
                  children: makeRuns(el),
                  spacing: { after: 160, before: 240 },
                })); break;
              case 'subtitle':
                children.push(new Paragraph({
                  children: makeRuns(el, { italics: true }),
                  spacing: { after: 320 },
                })); break;
              case 'p':
                children.push(new Paragraph({
                  children: makeRuns(el),
                  spacing: { after: 180 },
                })); break;
              case 'meta':
                for (const line of (el.text || '').split('\n').filter(Boolean)) {
                  children.push(new Paragraph({
                    children: [new TextRun({ text: line.trim(), color: el.color, size: Math.max(16, el.size - 4), font: el.font })],
                    spacing: { after: 80 },
                  }));
                } break;
              case 'li':
                children.push(new Paragraph({
                  children: makeRuns(el),
                  bullet: { level: 0 },
                  spacing: { after: 100 },
                })); break;
              case 'callout':
                children.push(new Paragraph({
                  children: makeRuns(el, { italics: true }),
                  border: { left: { style: BorderStyle.SINGLE, size: 18, color: el.borderColor || '3B82F6', space: 12 } },
                  shading: { type: ShadingType.CLEAR, color: 'auto', fill: el.bgColor || 'F0F9FF' },
                  indent: { left: 480 },
                  spacing: { after: 200, before: 200 },
                })); break;
              case 'footer':
                children.push(new Paragraph({
                  children: [new TextRun({ text: el.text, color: el.color, size: Math.max(16, el.size - 4), font: el.font })],
                  border: { top: { style: BorderStyle.SINGLE, size: 4, color: el.borderColor || 'dddddd', space: 8 } },
                  spacing: { before: 480, after: 0 },
                })); break;

              case 'table': {
                const tableRows = [];
                // A4 text width in DXA (twentieths of a point): 11906 - 2×1440 margins = 9026
                const A4_TEXT_DXA = 9026;
                const numCols = (el.headers && el.headers.length)
                  ? el.headers.length
                  : (el.rows && el.rows[0] ? el.rows[0].length : 1);
                const colW = Math.floor(A4_TEXT_DXA / numCols);
                if (el.headers && el.headers.length) {
                  tableRows.push(new TableRow({
                    tableHeader: true,
                    children: el.headers.map(h => new TableCell({
                      width: { size: colW, type: WidthType.DXA },
                      shading: { type: ShadingType.CLEAR, color: 'auto', fill: h.bgColor || '3b5bdb' },
                      margins: { top: 80, bottom: 80, left: 100, right: 100 },
                      children: [new Paragraph({
                        children: [new TextRun({ text: h.text, color: h.color || 'ffffff',
                          bold: true, size: h.size || 18, font: h.font || el.font })],
                      })],
                    })),
                  }));
                }
                (el.rows || []).forEach((row, ri) => {
                  const isEven = ri % 2 === 1;
                  tableRows.push(new TableRow({
                    children: row.map(cell => new TableCell({
                      width: { size: colW, type: WidthType.DXA },
                      shading: isEven ? { type: ShadingType.CLEAR, color: 'auto', fill: 'f8f9fa' } : undefined,
                      margins: { top: 60, bottom: 60, left: 100, right: 100 },
                      children: [new Paragraph({
                        children: [new TextRun({ text: cell.text, color: cell.color || el.color,
                          bold: cell.bold, size: cell.size || 18, font: cell.font || el.font })],
                      })],
                    })),
                  }));
                });
                if (tableRows.length) {
                  // columnWidths generates the <w:tblGrid> element required by Google Docs.
                  // Without tblGrid, Google Docs ignores per-cell widths and collapses all
                  // columns to near-zero width (text wraps character by character).
                  const lastColW = A4_TEXT_DXA - colW * (numCols - 1);
                  const columnWidths = Array.from({ length: numCols }, (_, i) =>
                    i < numCols - 1 ? colW : lastColW
                  );
                  children.push(new Table({
                    width: { size: A4_TEXT_DXA, type: WidthType.DXA },
                    columnWidths,
                    rows: tableRows,
                  }));
                  children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } }));
                }
                break;
              }

              case 'visual-block':
              case 'code-block':
              case 'diagram':
              case 'img': {
                if (el.pngBase64) {
                  const imgBuf = Buffer.from(el.pngBase64, 'base64');
                  // Derive CSS dimensions from PNG header so the ImageRun exactly matches
                  // what Playwright captured (getBoundingClientRect can be unreliable).
                  // PNG pixels are DOCX_DEVICE_SCALE× CSS pixels.
                  const pngDims = pngCssDimensions(imgBuf, DOCX_DEVICE_SCALE);
                  const maxW = 600;
                  const srcW = pngDims ? pngDims.w : (el.capturedWidth || maxW);
                  const srcH = pngDims ? pngDims.h : (el.capturedHeight || 300);
                  const scale = Math.min(1, maxW / srcW);
                  const w = Math.round(srcW * scale);
                  const h = Math.round(srcH * scale);
                  children.push(new Paragraph({
                    children: [new ImageRun({ type: 'png', data: imgBuf, transformation: { width: w, height: h } })],
                    spacing: { before: 160, after: 160 },
                  }));
                  if (el.caption) {
                    children.push(new Paragraph({
                      children: [new TextRun({ text: el.caption, color: el.color || '718096',
                        italics: true, size: Math.max(16, (el.size || 20) - 4), font: el.font })],
                      spacing: { after: 200 },
                    }));
                  }
                }
                break;
              }
            }
          }
          if (pi < allPageElements.length - 1) {
            children.push(new Paragraph({ children: [new PageBreak()] }));
          }
        }

        if (children.length === 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: 'No content extracted.' })] }));
        }

        const doc = new Document({
          styles: { default: { document: { run: { font: 'Arial', size: 21, color: '1a1a1a' } } } },
          sections: [{
            properties: {
              page: {
                size: { width: 11906, height: 16838 },
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
              },
            },
            children,
          }],
        });
        const docxBuffer = await Packer.toBuffer(doc);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Length': docxBuffer.length,
          'Content-Disposition': 'attachment; filename="export.docx"',
        });
        res.end(docxBuffer);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      resolve();
    });
  });
}

module.exports = { handleExportPng, handleExportPdf, handleExportDocx };
