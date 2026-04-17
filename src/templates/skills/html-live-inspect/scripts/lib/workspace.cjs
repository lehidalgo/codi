'use strict';

const fs = require('fs');
const path = require('path');

let WORKSPACE_DIR = null;

function init(workspaceDir) {
  WORKSPACE_DIR = workspaceDir;
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

function pidFile() {
  return path.join(WORKSPACE_DIR, '_server.pid');
}

function logFile() {
  return path.join(WORKSPACE_DIR, '_server.log');
}

function stateFile() {
  return path.join(WORKSPACE_DIR, '_state.json');
}

function writePid(pid) {
  fs.writeFileSync(pidFile(), String(pid));
}

function writeState(snapshot) {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(snapshot, null, 2));
  } catch {
    // Best effort — snapshot persistence is non-critical.
  }
}

function readState() {
  try {
    if (!fs.existsSync(stateFile())) return null;
    return JSON.parse(fs.readFileSync(stateFile(), 'utf-8'));
  } catch {
    return null;
  }
}

function root() {
  return WORKSPACE_DIR;
}

module.exports = {
  init,
  pidFile,
  logFile,
  stateFile,
  writePid,
  writeState,
  readState,
  root,
};
