'use strict';

// Persist the latest content-fit measurement for a project.
//
// Writes to <projectDir>/state/fit-report.json so agents can read it
// alongside the project manifest. Overwritten on every render; no history
// is kept (the report describes the current content, not a trail).

const fs = require('node:fs');
const path = require('node:path');

function writeFitReport(projectDir, report) {
  if (!projectDir || typeof projectDir !== 'string') {
    throw new Error('writeFitReport requires a projectDir');
  }
  if (!report || typeof report !== 'object') {
    throw new Error('writeFitReport requires a report object');
  }
  const dir = path.join(projectDir, 'state');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'fit-report.json'), JSON.stringify(report, null, 2));
}

function readFitReport(projectDir) {
  const file = path.join(projectDir, 'state', 'fit-report.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

module.exports = { writeFitReport, readFitReport };
