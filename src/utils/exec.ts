import { execFile } from "node:child_process";
import { promisify } from "node:util";

/** Promisified `execFile` — runs a command without shell interpretation. */
export const execFileAsync = promisify(execFile);
