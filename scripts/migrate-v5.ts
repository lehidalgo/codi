import Database from "better-sqlite3";
import { applyMigrations } from "#src/runtime/brain/migrate.js";

const raw = new Database("/Users/laht/projects/codi/.codi/state/brain.db");
raw.unsafeMode(true);
const r = applyMigrations(raw);
console.log("applied:", r.applied);
const v = raw.prepare("SELECT MAX(version) as v FROM _codi_schema_version").get() as { v: number };
console.log("version:", v.v);
const cols = raw.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
console.log(
  "max_prefix col exists:",
  cols.some((c) => c.name === "tokens_max_prefix"),
);
raw.close();
