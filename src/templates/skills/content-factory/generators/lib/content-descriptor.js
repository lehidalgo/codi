// Unified content descriptor helpers. The browser-side mirror of the
// server's content-registry shape. Both templates and sessions produce
// descriptors with identical top-level keys — downstream code never
// branches on kind except for `readOnly`.

import { state } from "./state.js";
import { CONTENT_TYPES, VALID_TYPES, isValidType, typeForCardClass } from "./content-types.js";

// Infer the content type from the first card's outer HTML by matching its
// card class. Returns null when no recognized class is found.
function inferTypeFromCards(cards) {
  if (!Array.isArray(cards) || !cards.length) return null;
  const first = cards[0];
  if (!first || typeof first.html !== "string") return null;
  const classAlt = VALID_TYPES.map((t) => CONTENT_TYPES[t].cardClass).join("|");
  const re = new RegExp(
    "<(?:article|section)\\b[^>]*class\\s*=\\s*[\"'][^\"']*\\b(" + classAlt + ")\\b",
    "i",
  );
  const m = first.html.match(re);
  return m ? typeForCardClass(m[1]) : null;
}

export function contentKey(content) {
  if (!content) return null;
  return content.kind + ":" + content.id;
}

export function buildTemplateContentFromRegistry(template) {
  // Build a descriptor for a template from the in-browser /api/templates
  // payload. Mirrors the server-side content-registry shape exactly.
  if (!template) return null;
  return {
    kind: "template",
    id: template.id,
    name: template.name,
    type: template.type,
    format: template.format || state.format,
    cardCount: Array.isArray(template.cards) ? template.cards.length : 0,
    status: null,
    createdAt: template.createdAt || null,
    modifiedAt: template.modifiedAt || null,
    readOnly: true,
    source: {
      file: template.filename || template.file || null,
      templateId: template.id,
      brand: template.brand || null,
    },
  };
}

export function buildSessionContentFromSession(session, files, cards) {
  if (!session) return null;
  const fileList = Array.isArray(files) ? files : [];
  const file = fileList[0] || session.files?.[0] || "social.html";
  const inferredType = inferTypeFromCards(cards);
  const presetType = session.preset && session.preset.type;
  const type = isValidType(inferredType)
    ? inferredType
    : isValidType(presetType)
      ? presetType
      : "social";
  const format =
    (isValidType(inferredType) &&
      CONTENT_TYPES[inferredType] && { ...CONTENT_TYPES[inferredType].canvas }) ||
    (session.preset && session.preset.format) ||
    state.format;
  return {
    kind: "session",
    id: session.sessionDir ? session.sessionDir.split("/").pop() : session.slug || "session",
    name: session.name || session.slug || "Untitled",
    type,
    format,
    cardCount: Array.isArray(cards) ? cards.length : 0,
    status: session.status || "draft",
    createdAt: session.created || null,
    modifiedAt: session.modified || session.created || null,
    readOnly: false,
    source: {
      file,
      sessionDir: session.sessionDir,
    },
  };
}

export function formatTimeAgo(ms) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return min + "m ago";
  const h = Math.floor(min / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 30) return d + "d ago";
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo + "mo ago";
  const y = Math.floor(mo / 12);
  return y + "y ago";
}
