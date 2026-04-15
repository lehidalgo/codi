// Shared application state for content-factory's browser app.
//
// Single mutable object imported by every module so all logic reads from
// and writes to the same place. ES modules guarantee a single instance.
//
// Downstream (preview header, URL pinning, card-builder context,
// persist-style) reads from this field and never branches on kind except
// for the `readOnly` flag.
export const state = {
  format: { w: 1080, h: 1080 },
  handle: "lehidalgo",
  zoom: 1.0, // 1.0 = fit content to canvas height; slider scales relative to fit
  logo: { visible: true, size: 48, x: 85, y: 85 }, // global defaults
  cardLogos: {}, // { [cardIndex]: partial logo overrides per card }
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

export const STATUS_CYCLE = ["draft", "in-progress", "review", "done"];
export const STATUS_LABEL = {
  draft: "DRAFT",
  "in-progress": "IN PROGRESS",
  review: "REVIEW",
  done: "DONE",
};
