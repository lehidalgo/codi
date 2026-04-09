// @ts-nocheck

/**
 * state.js — reads session state written by start-server.sh
 *
 * The server logs a JSON line with type:"server-started" to state/server.log.
 * readState() finds the last such event and returns the connection info
 * needed by the export scripts.
 */

import path from "path";
import fs from "fs";

const START_HINT =
  "Start the server with:\n  bash .../scripts/start-server.sh --project-dir <dir> --name content-factory";

/**
 * Reads session state from a session directory.
 *
 * @param {string} sessionDir  Path to the session root
 *   (e.g. /project/.codi_output/20260408_1012_content-factory)
 * @returns {{ url: string, screen_dir: string, exports_dir: string }}
 */
export function readState(sessionDir) {
  const abs = path.resolve(sessionDir);
  const logFile = path.join(abs, "state", "server.log");

  if (!fs.existsSync(logFile)) {
    throw new Error(`No server log at ${logFile}.\n${START_HINT}`);
  }

  const lines = fs.readFileSync(logFile, "utf-8").split("\n").filter(Boolean);

  const started = lines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((e) => e.type === "server-started")
    .at(-1);

  if (!started) {
    throw new Error(`No server-started event in ${logFile}.\n${START_HINT}`);
  }

  return {
    url: started.url,
    screen_dir: started.screen_dir,
    exports_dir: path.join(abs, "exports"),
  };
}
