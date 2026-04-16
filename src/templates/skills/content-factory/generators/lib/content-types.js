// Canonical content type registry — client-side mirror.
// Keep in sync with scripts/lib/content-types.cjs.

export const CONTENT_TYPES = {
  social: { cardClass: "social-card", canvas: { w: 1080, h: 1080 }, label: "Social" },
  slides: { cardClass: "slide", canvas: { w: 1920, h: 1080 }, label: "Slides" },
  document: { cardClass: "doc-page", canvas: { w: 1240, h: 1754 }, label: "Document" },
};

export const VALID_TYPES = Object.keys(CONTENT_TYPES);

export function isValidType(type) {
  return VALID_TYPES.includes(type);
}

export function typeForCardClass(cardClass) {
  for (const [type, entry] of Object.entries(CONTENT_TYPES)) {
    if (entry.cardClass === cardClass) return type;
  }
  return null;
}
