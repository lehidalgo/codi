'use strict';

// cf-id — deterministic stable identity for a DOM element snapshot.
//
// Input: a snapshot from the inspector (tag, id, classes, text, parentTag).
// Output: a short hex token like "cf-a3f2b1e0".
//
// Stability guarantees:
//   • Same element fingerprint → same id across runs, tabs, and processes.
//   • Whitespace normalization: text is trimmed and collapsed before hashing.
//   • Classes are sorted so reorderings do not change the id.
//   • Length starts at 8 hex chars; callers may escalate to 12 on collision.

const crypto = require('crypto');

const DEFAULT_LENGTH = 8;
const EXTENDED_LENGTH = 12;
const TEXT_SNIPPET_LIMIT = 64;

function normalize(snapshot) {
  const tag = String((snapshot && snapshot.tag) || '').toLowerCase();
  const id = String((snapshot && snapshot.id) || '');
  const classes = Array.isArray(snapshot && snapshot.classes)
    ? snapshot.classes.slice().sort().join(',')
    : '';
  const parentTag = String((snapshot && snapshot.parentTag) || '').toLowerCase();
  const rawText = String((snapshot && snapshot.text) || '');
  const text = rawText.replace(/\s+/g, ' ').trim().slice(0, TEXT_SNIPPET_LIMIT);
  return { tag, id, classes, parentTag, text };
}

function fingerprint(snapshot) {
  const n = normalize(snapshot);
  return [n.tag, n.id, n.classes, n.parentTag, n.text].join('\u0001');
}

function generate(snapshot, length = DEFAULT_LENGTH) {
  const hash = crypto.createHash('sha1').update(fingerprint(snapshot)).digest('hex');
  return 'cf-' + hash.slice(0, length);
}

// Generate an id that avoids collisions with a provided set of existing ids.
// If the 8-char id collides with anything in `taken`, extend to 12 chars.
// If that still collides (astronomically unlikely), append a numeric suffix.
function generateUnique(snapshot, taken) {
  const takenSet = taken instanceof Set ? taken : new Set(taken || []);
  const short = generate(snapshot, DEFAULT_LENGTH);
  if (!takenSet.has(short)) return short;

  const extended = generate(snapshot, EXTENDED_LENGTH);
  if (!takenSet.has(extended)) return extended;

  // Extremely unlikely collision at 12 hex chars — fall back to numeric suffix.
  let suffix = 2;
  while (takenSet.has(extended + '-' + suffix)) suffix++;
  return extended + '-' + suffix;
}

module.exports = {
  DEFAULT_LENGTH,
  EXTENDED_LENGTH,
  TEXT_SNIPPET_LIMIT,
  normalize,
  fingerprint,
  generate,
  generateUnique,
};
