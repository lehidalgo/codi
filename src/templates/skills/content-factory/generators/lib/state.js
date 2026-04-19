// Shared application state for content-factory's browser app.
//
// Single mutable object imported by every module so all logic reads from
// and writes to the same place. ES modules guarantee a single instance.
//
// Downstream (preview header, URL pinning, card-builder context,
// persist-style) reads from this field and never branches on kind except
// for the `readOnly` flag.

import { defaultLogoSize } from "./logo-defaults.js";

const INITIAL_FORMAT = { w: 1080, h: 1080 };

export const state = {
  format: INITIAL_FORMAT,
  handle: "handle",
  zoom: 1.0, // 1.0 = fit content to canvas height; slider scales relative to fit
  // Global logo defaults. `size` is computed from the active format unless
  // `userOverridden` is true (flipped when the user drags the size slider).
  logo: {
    visible: true,
    size: defaultLogoSize(INITIAL_FORMAT),
    x: 85,
    y: 85,
    userOverridden: false,
  },
  cardLogos: {}, // { [cardIndex]: partial logo overrides per card }
  // Resolved SVG bytes for the active project's logo (project > brand >
  // builtin). Populated lazily by logo-loader.loadLogo() on first render.
  logoSvg: null,
  logoSource: null,
  selectedCards: new Set([0]),
  galleryFilter: "all",
  workStatusFilter: "all",
  activeStatus: null, // status of the open My Work project; null for built-in templates
  viewMode: "app", // default is app view
  files: [],
  activeFile: null,
  activeSessionDir: null, // set when a My Work session is loaded; null for built-in templates
  cards: [],
  activeCard: 0,
  cardRevision: 0, // incremented on every card data reload; used by filmstrip cache
  preset: null, // template id of currently active template
  templates: [], // loaded from /api/templates
  activeMeta: null, // { name, type, format } — set for session content, cleared for templates
  // Unified content descriptor — shape matches /api/content-metadata:
  //   { kind, id, name, type, format, cardCount, status, createdAt,
  //     modifiedAt, readOnly, source: { file, sessionDir?, templateId?, brand? } }
  activeContent: null,
  brief: null, // { anchor, variants } — campaign brief for the active project
  inspectOn: false,
  _inspectorSource: "",
};

/**
 * Update the active canvas format. When the user has not manually overridden
 * the logo size, recompute the default so overlays stay proportional across
 * formats (8% of the shortest side).
 */
export function setFormat(format) {
  state.format = format;
  if (!state.logo.userOverridden) {
    state.logo.size = defaultLogoSize(format);
  }
}

export const STATUS_CYCLE = ["draft", "in-progress", "review", "done"];
export const STATUS_LABEL = {
  draft: "DRAFT",
  "in-progress": "IN PROGRESS",
  review: "REVIEW",
  done: "DONE",
};
