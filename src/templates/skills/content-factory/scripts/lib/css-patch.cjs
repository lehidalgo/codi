'use strict';

// css-patch — minimal CSS tokenizer scoped to the content-factory user-edits
// region.
//
// Scope (intentionally narrow):
//   • Find the sentinel `/* === cf:user-edits === */` inside a <style> block.
//   • Parse flat rules below it of the form: <selector> { <declarations> }
//   • Upsert a rule keyed by selector.
//   • Delete a rule by selector.
//   • Serialize back preserving everything above the sentinel byte-for-byte.
//
// Non-goals: nested at-rules, media queries, complex selectors inside the
// region. If the tokenizer encounters anything it does not understand inside
// the region, it raises — the caller decides what to do.

const SENTINEL = '/* === cf:user-edits === */';

function findUserEditsRegion(styleText) {
  const idx = styleText.indexOf(SENTINEL);
  if (idx < 0) return null;
  const regionStart = idx + SENTINEL.length;
  return {
    prefix: styleText.slice(0, idx),
    sentinel: SENTINEL,
    body: styleText.slice(regionStart),
  };
}

function ensureRegion(styleText) {
  const existing = findUserEditsRegion(styleText);
  if (existing) return existing;
  const trimmed = styleText.endsWith('\n') ? styleText : styleText + '\n';
  return {
    prefix: trimmed,
    sentinel: SENTINEL,
    body: '\n',
  };
}

// Parse a region body like "\n[data-cf-id=\"cf-a3f2b1e0\"] { color: #000; }\n"
// into a list of rules. Each rule is { selector, declarations: [{property,
// value}], raw } where `raw` preserves the original serialized form so
// untouched rules round-trip byte-identical.
function parseRegion(body) {
  const rules = [];
  let i = 0;
  const len = body.length;

  while (i < len) {
    // Skip whitespace + blank lines
    while (i < len && /\s/.test(body[i])) i++;
    if (i >= len) break;

    // Line comments (block comments only) — preserve them attached to the next rule
    if (body[i] === '/' && body[i + 1] === '*') {
      const end = body.indexOf('*/', i + 2);
      if (end < 0) {
        throw new Error('css-patch: unterminated comment in user-edits region');
      }
      // We ignore standalone comments in parse (rare in our region); the
      // serializer emits canonical output.
      i = end + 2;
      continue;
    }

    // Read selector up to '{'
    const braceOpen = body.indexOf('{', i);
    if (braceOpen < 0) {
      throw new Error('css-patch: rule missing { in user-edits region');
    }
    const selector = body.slice(i, braceOpen).trim();
    if (!selector) {
      throw new Error('css-patch: empty selector in user-edits region');
    }

    // Read declarations up to matching '}'
    const braceClose = body.indexOf('}', braceOpen);
    if (braceClose < 0) {
      throw new Error('css-patch: rule missing } in user-edits region');
    }
    const declBody = body.slice(braceOpen + 1, braceClose);
    const declarations = parseDeclarations(declBody);
    rules.push({
      selector,
      declarations,
      raw: body.slice(i, braceClose + 1),
    });
    i = braceClose + 1;
  }

  return rules;
}

function parseDeclarations(text) {
  const out = [];
  for (const part of text.split(';')) {
    const s = part.trim();
    if (!s) continue;
    const colon = s.indexOf(':');
    if (colon < 0) {
      throw new Error(`css-patch: malformed declaration "${s}"`);
    }
    const property = s.slice(0, colon).trim();
    const value = s.slice(colon + 1).trim();
    if (!property) throw new Error(`css-patch: empty property in "${s}"`);
    if (!value) throw new Error(`css-patch: empty value in "${s}"`);
    out.push({ property, value });
  }
  return out;
}

function serializeRule(rule) {
  const decls = rule.declarations
    .map((d) => `${d.property}: ${d.value};`)
    .join(' ');
  return decls ? `${rule.selector} { ${decls} }` : null;
}

function serializeRegionBody(rules) {
  const lines = rules
    .map(serializeRule)
    .filter((line) => line !== null);
  return lines.length ? '\n' + lines.join('\n') + '\n' : '\n';
}

// Upsert a single rule (keyed by selector). Declarations are merged: existing
// properties are replaced, new properties are appended, others are kept.
function upsertRule(styleText, selector, patches) {
  if (!selector || typeof selector !== 'string') {
    throw new Error('css-patch: selector is required');
  }
  if (!patches || typeof patches !== 'object') {
    throw new Error('css-patch: patches must be an object');
  }

  const region = ensureRegion(styleText);
  const rules = parseRegion(region.body);
  const existingIdx = rules.findIndex((r) => r.selector === selector);

  const mergedDecls =
    existingIdx >= 0 ? rules[existingIdx].declarations.slice() : [];
  for (const [prop, val] of Object.entries(patches)) {
    if (val == null || val === '') {
      // null/empty removes the declaration
      const idx = mergedDecls.findIndex((d) => d.property === prop);
      if (idx >= 0) mergedDecls.splice(idx, 1);
      continue;
    }
    const idx = mergedDecls.findIndex((d) => d.property === prop);
    if (idx >= 0) {
      mergedDecls[idx] = { property: prop, value: String(val) };
    } else {
      mergedDecls.push({ property: prop, value: String(val) });
    }
  }

  const newRule = { selector, declarations: mergedDecls };
  if (existingIdx >= 0) {
    if (mergedDecls.length === 0) {
      rules.splice(existingIdx, 1);
    } else {
      rules[existingIdx] = newRule;
    }
  } else if (mergedDecls.length > 0) {
    rules.push(newRule);
  }

  return region.prefix + region.sentinel + serializeRegionBody(rules);
}

function deleteRule(styleText, selector) {
  const region = findUserEditsRegion(styleText);
  if (!region) return styleText;
  const rules = parseRegion(region.body).filter((r) => r.selector !== selector);
  return region.prefix + region.sentinel + serializeRegionBody(rules);
}

function listRules(styleText) {
  const region = findUserEditsRegion(styleText);
  if (!region) return [];
  return parseRegion(region.body).map((r) => ({
    selector: r.selector,
    declarations: r.declarations.slice(),
  }));
}

module.exports = {
  SENTINEL,
  findUserEditsRegion,
  ensureRegion,
  parseRegion,
  upsertRule,
  deleteRule,
  listRules,
};
