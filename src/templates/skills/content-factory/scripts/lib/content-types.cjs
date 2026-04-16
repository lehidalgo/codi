'use strict';

// Canonical content type registry — single source of truth.
//
// Every module that needs to know about content types imports from here.
// No hardcoded type strings, card classes, or canvas sizes elsewhere.

const CONTENT_TYPES = {
  social: {
    cardClass: 'social-card',
    canvas: { w: 1080, h: 1080 },
    label: 'Social',
  },
  slides: {
    cardClass: 'slide',
    canvas: { w: 1920, h: 1080 },
    label: 'Slides',
  },
  document: {
    cardClass: 'doc-page',
    canvas: { w: 1240, h: 1754 },
    label: 'Document',
  },
};

const VALID_TYPES = Object.keys(CONTENT_TYPES);

function isValidType(type) {
  return VALID_TYPES.includes(type);
}

function assertType(type) {
  if (!isValidType(type)) {
    throw new Error(
      'Invalid content type: ' + type + '. Must be one of: ' + VALID_TYPES.join(', '),
    );
  }
}

function cardClassForType(type) {
  const entry = CONTENT_TYPES[type];
  return entry ? entry.cardClass : CONTENT_TYPES.social.cardClass;
}

function canvasForType(type) {
  const entry = CONTENT_TYPES[type];
  return entry ? { ...entry.canvas } : { ...CONTENT_TYPES.social.canvas };
}

function typeForCardClass(cardClass) {
  for (const [type, entry] of Object.entries(CONTENT_TYPES)) {
    if (entry.cardClass === cardClass) return type;
  }
  return null;
}

function allCardClasses() {
  return VALID_TYPES.map((t) => CONTENT_TYPES[t].cardClass);
}

module.exports = {
  CONTENT_TYPES,
  VALID_TYPES,
  isValidType,
  assertType,
  cardClassForType,
  canvasForType,
  typeForCardClass,
  allCardClasses,
};
