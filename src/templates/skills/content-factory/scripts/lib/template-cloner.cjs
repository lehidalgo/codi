'use strict';

// template-cloner — turn a built-in template into a fresh My Work session.
//
// Flow:
//   1. Look up the template descriptor via content-registry.
//   2. Create a new session directory (workspace.createProject handles slug
//      collision with a time suffix).
//   3. Copy the template HTML verbatim into <session>/content/<file>.
//   4. Write a manifest that records the origin template in `preset` so
//      the session's gallery card can show "based on: <template name>".
//   5. Return a unified descriptor for the new session — drop-in
//      compatible with /api/content-metadata output and
//      state.activeContent on the client.
//
// Contract: never touches the template file. Copying is a one-way fork.

const fs = require('fs');
const path = require('path');
const workspace = require('./workspace.cjs');
const contentRegistry = require('./content-registry.cjs');

function defaultSessionName(template) {
  const stamp = new Date()
    .toISOString()
    .replace(/[:T]/g, '-')
    .replace(/\..*/, '');
  return (template.name || template.id) + ' · ' + stamp;
}

function resolveTemplateSourcePath(template, ctx) {
  // Mirror the registry's enumeration: built-in templates live in
  // GENERATORS_DIR/templates; brand-skill templates live in each brand's
  // templates/ dir. We walk the same list the registry uses so any id the
  // client can resolve is one we can copy from.
  if (template.source && template.source.brand) {
    // Brand path — discover the brand dir
    const { discoverBrands } = require('./brand-discovery.cjs');
    const brand = discoverBrands(ctx.SKILLS_DIR).find(
      (b) => b.name === template.source.brand,
    );
    if (brand) return path.join(brand.dir, 'templates', template.source.file);
  }
  return path.join(ctx.GENERATORS_DIR, 'templates', template.source.file);
}

function cloneTemplate({ templateId, name }, ctx) {
  if (!templateId) throw new Error('templateId is required');
  const template = contentRegistry.getDescriptor('template', templateId, ctx);
  if (!template) {
    const err = new Error('template not found: ' + templateId);
    err.status = 404;
    throw err;
  }

  const sourcePath = resolveTemplateSourcePath(template, ctx);
  if (!fs.existsSync(sourcePath)) {
    const err = new Error('template source file missing: ' + sourcePath);
    err.status = 500;
    throw err;
  }

  const sessionName = (name && String(name).trim()) || defaultSessionName(template);
  const project = workspace.createProject(ctx.WORKSPACE_DIR, sessionName);
  // `createProject` returns {dir, contentDir, stateDir, exportsDir, manifest}.
  // Normalize to a single shape the rest of this function (and callers) uses.
  const sessionDir = project.dir;

  // Copy the HTML verbatim — byte for byte. We do NOT re-serialize,
  // re-parse, or normalize in any way. The template's own style block,
  // inspector hooks, and card ids survive untouched.
  const targetFile = template.source.file;
  const targetPath = path.join(project.contentDir, targetFile);
  fs.copyFileSync(sourcePath, targetPath);

  // Enrich the manifest with origin info so the session's gallery card
  // can show "based on: <template name>". This is pure provenance.
  const manifestPath = path.join(project.stateDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  manifest.files = [targetFile];
  manifest.preset = {
    id: template.id,
    name: template.name,
    type: template.type,
    timestamp: Date.now(),
  };
  manifest.format = template.format;
  manifest.modified = Date.now();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Rebuild the session descriptor using the registry so the shape is
  // byte-identical to what /api/content-metadata?kind=session returns.
  const sessionId = path.basename(sessionDir);
  const descriptor = contentRegistry.getDescriptor('session', sessionId, ctx);
  return {
    descriptor,
    session: {
      sessionDir,
      contentDir: project.contentDir,
      stateDir: project.stateDir,
      manifestPath,
      file: targetFile,
    },
  };
}

module.exports = { cloneTemplate, defaultSessionName, resolveTemplateSourcePath };
