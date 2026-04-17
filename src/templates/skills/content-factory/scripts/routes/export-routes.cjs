'use strict';
const state = require('../lib/project-state.cjs');
const { discoverBrands } = require('../lib/brand-discovery.cjs');
const { handleExportPng, handleExportPdf, handleExportDocx } = require('../lib/exports.cjs');
const { handleExportHtmlBundle } = require('../lib/bundle.cjs');

/**
 * Routes that trigger Playwright-based renders to PNG/PDF/DOCX and the
 * self-contained HTML bundle export. Returns true if the request was handled.
 */
function handle(req, res, parsed, ctx) {
  const { pathname } = parsed;
  if (req.method !== 'POST') return false;

  if (pathname === '/api/export-png')  { handleExportPng(req, res);  return true; }
  if (pathname === '/api/export-pdf')  { handleExportPdf(req, res);  return true; }
  if (pathname === '/api/export-docx') { handleExportDocx(req, res); return true; }

  if (pathname === '/api/export-html-bundle') {
    handleExportHtmlBundle(req, res, {
      activeProject: state.getActiveProject(),
      GENERATORS_DIR: ctx.GENERATORS_DIR,
      VENDOR_DIR: ctx.VENDOR_DIR,
      WORKSPACE_DIR: ctx.WORKSPACE_DIR,
      discoverBrands: () => discoverBrands(ctx.SKILLS_DIR),
    });
    return true;
  }

  return false;
}

module.exports = { handle };
