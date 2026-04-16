'use strict';

// card-source — read, locate, modify, and write a card HTML source file.
//
// Responsibilities:
//   • Atomic read/write with temp file + rename so crashes never leave
//     half-written files.
//   • Minimal HTML walker that locates elements using only the subset of
//     selectors the inspector actually emits:
//       tag, tag#id, tag.class, tag:nth-of-type(n), descendant combinator ">"
//   • Find-or-create <style> block inside <article class="social-card"> (or
//     the first element at the top of the fragment).
//   • Write a data-cf-id attribute into an element's opening tag by byte
//     range, without reformatting unrelated bytes.
//
// Non-goals: full HTML5 parsing, SVG inline fragments, scripts, XML
// namespaces. Card HTML is well-formed and flat; that's the contract.

const fs = require('fs');
const path = require('path');
const cssPatch = require('./css-patch.cjs');

// ============================================================================
// Atomic read/write
// ============================================================================

function readFileSafe(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function writeAtomic(filePath, content) {
  if (readFileSafe(filePath) === content) {
    return { bytesWritten: 0, skipped: true };
  }
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmp = path.join(dir, '.' + base + '.tmp-' + process.pid + '-' + Date.now());
  fs.writeFileSync(tmp, content, { encoding: 'utf-8', flag: 'wx' });
  try {
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* best-effort temp file cleanup */ }
    throw err;
  }
  return { bytesWritten: Buffer.byteLength(content, 'utf-8'), skipped: false };
}

// ============================================================================
// HTML tokenizer — element walker
// ============================================================================
//
// Produces a flat list of "tag nodes" each with:
//   { name, attrs, openStart, openEnd, closeStart?, closeEnd?, depth }
//
// We skip comments, doctype, and text nodes entirely — we only care about
// element positions.

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
]);

function parseAttrs(attrText) {
  const attrs = {};
  // Very small attribute parser: name, name=value, name="value", name='value'
  let i = 0;
  const len = attrText.length;
  while (i < len) {
    while (i < len && /\s/.test(attrText[i])) i++;
    if (i >= len) break;
    let nameStart = i;
    while (i < len && !/[\s=>]/.test(attrText[i])) i++;
    const name = attrText.slice(nameStart, i);
    if (!name) { i++; continue; }
    while (i < len && /\s/.test(attrText[i])) i++;
    if (attrText[i] !== '=') {
      attrs[name] = '';
      continue;
    }
    i++; // consume =
    while (i < len && /\s/.test(attrText[i])) i++;
    const quote = attrText[i];
    if (quote === '"' || quote === "'") {
      i++;
      const valueStart = i;
      while (i < len && attrText[i] !== quote) i++;
      attrs[name] = attrText.slice(valueStart, i);
      i++; // consume closing quote
    } else {
      const valueStart = i;
      while (i < len && !/[\s>]/.test(attrText[i])) i++;
      attrs[name] = attrText.slice(valueStart, i);
    }
  }
  return attrs;
}

function walk(html) {
  const nodes = [];
  const stack = [];
  let i = 0;
  const len = html.length;

  while (i < len) {
    if (html[i] !== '<') {
      i++;
      continue;
    }

    // Comment
    if (html.substr(i, 4) === '<!--') {
      const end = html.indexOf('-->', i + 4);
      i = end < 0 ? len : end + 3;
      continue;
    }
    // Doctype / processing instruction
    if (html[i + 1] === '!' || html[i + 1] === '?') {
      const end = html.indexOf('>', i);
      i = end < 0 ? len : end + 1;
      continue;
    }
    // Closing tag
    if (html[i + 1] === '/') {
      const end = html.indexOf('>', i);
      if (end < 0) { i = len; break; }
      const name = html.slice(i + 2, end).trim().toLowerCase();
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].name === name) {
          stack[k].closeStart = i;
          stack[k].closeEnd = end + 1;
          stack.length = k;
          break;
        }
      }
      i = end + 1;
      continue;
    }
    // <script> or <style> — consume until matching closing tag, do not
    // walk inside. Their content may contain '<' characters.
    const tagMatch = /^<([a-zA-Z][a-zA-Z0-9-]*)\b/.exec(html.slice(i));
    if (!tagMatch) {
      i++;
      continue;
    }
    const name = tagMatch[1].toLowerCase();
    const openStart = i;
    // Find end of opening tag
    let j = i + tagMatch[0].length;
    let inQuote = null;
    while (j < len) {
      const ch = html[j];
      if (inQuote) {
        if (ch === inQuote) inQuote = null;
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === '>') {
        break;
      }
      j++;
    }
    if (j >= len) { i = len; break; }
    const selfClose = html[j - 1] === '/';
    const openEnd = j + 1;
    const attrText = html.slice(i + tagMatch[0].length, selfClose ? j - 1 : j);
    const attrs = parseAttrs(attrText);
    const node = {
      name,
      attrs,
      openStart,
      openEnd,
      closeStart: null,
      closeEnd: null,
      depth: stack.length,
      parent: stack.length ? stack[stack.length - 1] : null,
    };
    nodes.push(node);

    if (name === 'script' || name === 'style') {
      // Find </name>
      const re = new RegExp('</' + name + '\\s*>', 'i');
      const rest = html.slice(openEnd);
      const m = re.exec(rest);
      if (m) {
        node.closeStart = openEnd + m.index;
        node.closeEnd = openEnd + m.index + m[0].length;
        i = node.closeEnd;
      } else {
        i = len;
      }
      continue;
    }

    if (!selfClose && !VOID_ELEMENTS.has(name)) {
      stack.push(node);
    }
    i = openEnd;
  }

  return nodes;
}

// ============================================================================
// Selector matcher
// ============================================================================
//
// Supports exactly what the inspector emits:
//   body > article > h1
//   h1#hero
//   .hero.primary
//   div:nth-of-type(3)
//
// Selectors are ANDed; combinators only ">" (child).

function parseSimple(part) {
  // Returns { tag, id, classes, nthOfType }
  const out = { tag: null, id: null, classes: [], nthOfType: null };
  const re = /([#.][\w-]+|:nth-of-type\((\d+)\)|^[\w-]+)/g;
  let m;
  while ((m = re.exec(part)) !== null) {
    const tok = m[1];
    if (tok.startsWith('#')) out.id = tok.slice(1);
    else if (tok.startsWith('.')) out.classes.push(tok.slice(1));
    else if (tok.startsWith(':nth-of-type')) out.nthOfType = Number(m[2]);
    else out.tag = tok.toLowerCase();
  }
  return out;
}

function parseSelector(selector) {
  return selector.split('>').map((p) => parseSimple(p.trim()));
}

function findElement(html, selector) {
  const nodes = walk(html);
  const parts = parseSelector(selector);
  if (!parts.length) return null;

  // Candidate filtering by the LAST simple selector
  const tail = parts[parts.length - 1];

  // Candidate pool: nodes matching tag/id/class
  let candidates = nodes.filter((n) => {
    if (tail.tag && n.name !== tail.tag) return false;
    if (tail.id && n.attrs.id !== tail.id) return false;
    if (tail.classes.length) {
      const cls = (n.attrs.class || '').split(/\s+/).filter(Boolean);
      for (const c of tail.classes) if (!cls.includes(c)) return false;
    }
    return true;
  });

  // nth-of-type resolution: among siblings under same parent with same tag
  if (tail.nthOfType != null) {
    candidates = candidates.filter((n) => {
      const siblings = nodes
        .filter((m) => m.parent === n.parent && m.name === n.name)
        .sort((a, b) => a.openStart - b.openStart);
      return siblings[tail.nthOfType - 1] === n;
    });
  }

  // Walk up through ancestors for earlier parts
  for (const n of candidates) {
    let node = n;
    let ok = true;
    for (let k = parts.length - 2; k >= 0; k--) {
      const simple = parts[k];
      let parent = node.parent;
      while (parent) {
        if (
          (!simple.tag || parent.name === simple.tag) &&
          (!simple.id || parent.attrs.id === simple.id) &&
          (!simple.classes.length ||
            simple.classes.every((c) =>
              (parent.attrs.class || '').split(/\s+/).filter(Boolean).includes(c),
            ))
        ) {
          if (simple.nthOfType != null) {
            const siblings = nodes
              .filter((m) => m.parent === parent.parent && m.name === parent.name)
              .sort((a, b) => a.openStart - b.openStart);
            if (siblings[simple.nthOfType - 1] !== parent) {
              parent = parent.parent;
              continue;
            }
          }
          break;
        }
        parent = parent.parent;
      }
      if (!parent) { ok = false; break; }
      node = parent;
    }
    if (ok) return n;
  }
  return null;
}

// ============================================================================
// Mutations on source HTML
// ============================================================================

function setAttributeInOpenTag(html, node, name, value) {
  const openTag = html.slice(node.openStart, node.openEnd);
  // Look for existing attribute
  const re = new RegExp('(\\s' + name + ')\\s*=\\s*("[^"]*"|\'[^\']*\'|[^\\s>]+)', 'i');
  let newOpenTag;
  if (re.test(openTag)) {
    newOpenTag = openTag.replace(re, ' ' + name + '="' + value.replace(/"/g, '&quot;') + '"');
  } else {
    // Insert before closing '>' or '/>'
    const selfClose = openTag.endsWith('/>');
    const insertPos = selfClose ? openTag.length - 2 : openTag.length - 1;
    newOpenTag =
      openTag.slice(0, insertPos) +
      ' ' + name + '="' + value.replace(/"/g, '&quot;') + '"' +
      openTag.slice(insertPos);
  }
  return html.slice(0, node.openStart) + newOpenTag + html.slice(node.openEnd);
}

function removeAttributeInOpenTag(html, node, name) {
  const openTag = html.slice(node.openStart, node.openEnd);
  const re = new RegExp('\\s' + name + '\\s*=\\s*("[^"]*"|\'[^\']*\'|[^\\s>]+)', 'i');
  const newOpenTag = openTag.replace(re, '');
  return html.slice(0, node.openStart) + newOpenTag + html.slice(node.openEnd);
}

function findOrCreateStyleBlock(html) {
  const nodes = walk(html);
  const style = nodes.find((n) => n.name === 'style');
  if (style) {
    return {
      html,
      styleOpen: style.openEnd,
      styleClose: style.closeStart,
    };
  }
  // Create a <style> block. Prefer to place it at the start of the root
  // element so it lives inside <article>. Fallback: prepend at file start.
  const host = nodes.find((n) => n.depth === 0);
  const insertPos = host ? host.openEnd : 0;
  const styleBlock = '\n<style>\n</style>\n';
  const newHtml = html.slice(0, insertPos) + styleBlock + html.slice(insertPos);
  // Re-walk to find its positions
  const nodes2 = walk(newHtml);
  const style2 = nodes2.find((n) => n.name === 'style');
  return {
    html: newHtml,
    styleOpen: style2.openEnd,
    styleClose: style2.closeStart,
  };
}

function upsertStyleRule(html, selector, patches) {
  const loc = findOrCreateStyleBlock(html);
  const currentStyleText = loc.html.slice(loc.styleOpen, loc.styleClose);
  const newStyleText = cssPatch.upsertRule(currentStyleText, selector, patches);
  return (
    loc.html.slice(0, loc.styleOpen) +
    newStyleText +
    loc.html.slice(loc.styleClose)
  );
}

function deleteStyleRule(html, selector) {
  const loc = findOrCreateStyleBlock(html);
  const currentStyleText = loc.html.slice(loc.styleOpen, loc.styleClose);
  const newStyleText = cssPatch.deleteRule(currentStyleText, selector);
  return (
    loc.html.slice(0, loc.styleOpen) +
    newStyleText +
    loc.html.slice(loc.styleClose)
  );
}

function listStyleRules(html) {
  const loc = findOrCreateStyleBlock(html);
  const currentStyleText = loc.html.slice(loc.styleOpen, loc.styleClose);
  return cssPatch.listRules(currentStyleText);
}

module.exports = {
  readFileSafe,
  writeAtomic,
  walk,
  findElement,
  parseSelector,
  setAttributeInOpenTag,
  removeAttributeInOpenTag,
  findOrCreateStyleBlock,
  upsertStyleRule,
  deleteStyleRule,
  listStyleRules,
};
