'use strict';

// content-registry — unified metadata for content the content-factory can
// render in Preview. Both built-in templates and My Work sessions map to
// the exact same descriptor shape.
//
// Descriptor shape:
//   {
//     kind:        'template' | 'session',
//     id:          string   — stable id across runs
//     name:        string   — display name for the preview header
//     type:        string   — social | slides | document | ...
//     format:      { w, h } — pixel dimensions
//     cardCount:   number   — parsed from the HTML source
//     status:      string|null — DRAFT/PUBLISHED for sessions; null for templates
//     createdAt:   number|null  — ms epoch
//     modifiedAt:  number|null  — ms epoch
//     readOnly:    boolean     — templates are read-only, sessions are editable
//     source: {
//       file:        string       — basename of the HTML file (always)
//       sessionDir?: string       — absolute path (when kind === 'session')
//       templateId?: string       — brand-qualified id (when kind === 'template')
//       brand?:      string|null  — brand slug if the template came from a brand skill
//     }
//   }
//
// Both branches of the registry produce byte-identical shapes. Anything
// downstream (preview header, URL pinning, persist-style, card-builder
// context) reads from this shape and never branches on kind except for
// readOnly and source fields.

const fs = require('fs');
const path = require('path');

const { discoverBrands } = require('./brand-discovery.cjs');
const workspace = require('./workspace.cjs');
const { CONTENT_TYPES, isValidType, allCardClasses, typeForCardClass } = require('./content-types.cjs');

// Infer the content type from the HTML body by matching the first card class.
// Returns null when no recognized card class is present (empty file, plain HTML).
function inferTypeFromHtml(html) {
  if (!html) return null;
  const classAlt = allCardClasses().join('|');
  const re = new RegExp('<(?:article|section)\\b[^>]*class\\s*=\\s*["\'][^"\']*\\b(' + classAlt + ')\\b', 'i');
  const m = html.match(re);
  return m ? typeForCardClass(m[1]) : null;
}

const META_PATTERNS = [
  /<meta[^>]+name=["']codi:template["'][^>]*content='([^']+)'/i,
  /<meta[^>]+name=["']codi:template["'][^>]*content="([^"]+)"/i,
  /<meta[^>]+content='([^']+)'[^>]*name=["']codi:template["']/i,
  /<meta[^>]+content="([^"]+)"[^>]*name=["']codi:template["']/i,
];

function extractTemplateMeta(html) {
  for (const re of META_PATTERNS) {
    const m = html.match(re);
    if (m) {
      try { return JSON.parse(m[1]); } catch { return {}; }
    }
  }
  return {};
}

function countCards(html) {
  const classAlt = allCardClasses().join('|');
  const re = new RegExp('<(article|section)\\b[^>]*class\\s*=\\s*["\'][^"\']*\\b(' + classAlt + ')\\b[^"\']*["\']', 'gi');
  const matches = html.match(re) || [];
  return Math.max(matches.length, 1);
}

// Estimate the page count of a Markdown anchor by counting top-level H2s
// plus 1 for the cover. Mirrors how renderMarkdownAsDocument splits the
// rendered HTML into <article class="doc-page"> elements — one per H2
// section, with everything before the first H2 forming the cover page.
// Strips fenced code blocks so inline '##' inside code doesn't falsely
// inflate the count.
function countMarkdownPages(md) {
  if (!md) return 1;
  const stripped = md.replace(/```[\s\S]*?```/g, '');
  const h2Count = (stripped.match(/^\s{0,3}##\s+/gm) || []).length;
  return Math.max(1, h2Count + 1);
}

// ============================================================================
// Template branch
// ============================================================================

function enumerateTemplateEntries(ctx) {
  const entries = [];
  const builtinDir = path.join(ctx.GENERATORS_DIR, 'templates');
  if (fs.existsSync(builtinDir)) {
    for (const file of fs.readdirSync(builtinDir).filter((f) => f.endsWith('.html')).sort()) {
      entries.push({ file, dir: builtinDir, brand: null });
    }
  }
  for (const brand of discoverBrands(ctx.SKILLS_DIR)) {
    const brandTemplatesDir = path.join(brand.dir, 'templates');
    if (!fs.existsSync(brandTemplatesDir)) continue;
    for (const file of fs.readdirSync(brandTemplatesDir).filter((f) => f.endsWith('.html')).sort()) {
      entries.push({ file, dir: brandTemplatesDir, brand: brand.name });
    }
  }
  return entries;
}

function templateIdFor(entry, meta) {
  const base = path.basename(entry.file, '.html');
  const autoId = entry.brand ? `${entry.brand}--${base}` : base;
  return meta.id || autoId;
}

function descriptorFromTemplateEntry(entry) {
  let html = '';
  try { html = fs.readFileSync(path.join(entry.dir, entry.file), 'utf-8'); }
  catch { return null; }
  const meta = extractTemplateMeta(html);
  const stat = fs.statSync(path.join(entry.dir, entry.file));
  return {
    kind: 'template',
    id: templateIdFor(entry, meta),
    name: meta.name || path.basename(entry.file, '.html'),
    type: isValidType(meta.type) ? meta.type : 'social',
    format: meta.format || { w: 1080, h: 1080 },
    cardCount: countCards(html),
    status: null,
    createdAt: stat.birthtimeMs || stat.ctimeMs,
    modifiedAt: stat.mtimeMs,
    readOnly: true,
    source: {
      file: entry.file,
      templateId: templateIdFor(entry, meta),
      brand: entry.brand || null,
    },
  };
}

function findTemplateById(id, ctx) {
  for (const entry of enumerateTemplateEntries(ctx)) {
    const d = descriptorFromTemplateEntry(entry);
    if (d && d.id === id) return d;
  }
  return null;
}

function listTemplates(ctx) {
  const out = [];
  for (const entry of enumerateTemplateEntries(ctx)) {
    const d = descriptorFromTemplateEntry(entry);
    if (d) out.push(d);
  }
  return out;
}

// ============================================================================
// Session branch
// ============================================================================

function descriptorFromSession(session) {
  const files = Array.isArray(session.files) ? session.files : [];
  // scanContentFiles orders .md anchors first when they live at content/
  // root, so files[0] is the anchor when one exists. Preserve that order —
  // downstream UI treats files[0] as the session's "primary" content.
  const file = files[0] || 'social.html';
  const filePath = path.join(session.sessionDir, 'content', file);
  const ext = path.extname(file).toLowerCase();
  const isMarkdownAnchor = ext === '.md';
  let html = '';
  try { html = fs.readFileSync(filePath, 'utf-8'); } catch { /* file may not exist yet */ }
  const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  // Markdown anchors always resolve to document type — the client wraps
  // the rendered Markdown in a single virtual doc-page. HTML files fall
  // back to card-class inference.
  const inferredType = isMarkdownAnchor ? 'document' : inferTypeFromHtml(html);
  const presetType = session.preset && session.preset.type;
  const type = isValidType(inferredType) ? inferredType
             : isValidType(presetType) ? presetType
             : 'social';
  const format = (isValidType(inferredType) && CONTENT_TYPES[inferredType] && { ...CONTENT_TYPES[inferredType].canvas })
              || (session.preset && session.preset.format)
              || { ...CONTENT_TYPES.social.canvas };
  return {
    kind: 'session',
    id: path.basename(session.sessionDir),
    name: session.name || path.basename(session.sessionDir),
    type,
    format,
    cardCount: isMarkdownAnchor ? countMarkdownPages(html) : (html ? countCards(html) : 1),
    status: session.status || 'draft',
    createdAt: session.created || (stat && stat.birthtimeMs) || null,
    modifiedAt: (stat && stat.mtimeMs) || session.created || null,
    readOnly: false,
    source: {
      file,
      sessionDir: session.sessionDir,
    },
  };
}

function findSessionById(id, ctx) {
  for (const session of workspace.listProjects(ctx.WORKSPACE_DIR)) {
    if (path.basename(session.sessionDir) === id) {
      return descriptorFromSession(session);
    }
  }
  return null;
}

function listSessions(ctx) {
  return workspace.listProjects(ctx.WORKSPACE_DIR).map(descriptorFromSession);
}

// ============================================================================
// Public API
// ============================================================================

function getDescriptor(kind, id, ctx) {
  if (!kind || !id) return null;
  if (kind === 'template') return findTemplateById(id, ctx);
  if (kind === 'session') return findSessionById(id, ctx);
  return null;
}

function listAll(ctx) {
  return [...listTemplates(ctx), ...listSessions(ctx)];
}

module.exports = {
  extractTemplateMeta,
  countCards,
  getDescriptor,
  listTemplates,
  listSessions,
  listAll,
};
