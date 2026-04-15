// Unified content descriptor helpers. The browser-side mirror of the
// server's content-registry shape. Both templates and sessions produce
// descriptors with identical top-level keys — downstream code never
// branches on kind except for `readOnly`.

import { state } from "./state.js";

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
  return {
    kind: "session",
    id: session.sessionDir ? session.sessionDir.split("/").pop() : session.slug || "session",
    name: session.name || session.slug || "Untitled",
    type: (session.preset && session.preset.type) || "social",
    format: (session.preset && session.preset.format) || state.format,
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
