import Database from "better-sqlite3";
import { aggregateSessionUsage } from "#src/runtime/tokens/aggregator.js";
const raw = new Database("/Users/laht/projects/codi/.codi/state/brain.db");
raw.unsafeMode(true);
raw.pragma("journal_mode = WAL");

const sessions = raw
  .prepare("SELECT session_id, agent_type FROM sessions ORDER BY started_at")
  .all() as Array<{ session_id: string; agent_type: string }>;

console.log(`Backfilling ${sessions.length} sessions...`);
for (const s of sessions) {
  const result = aggregateSessionUsage(raw, s.session_id);
  if (result) {
    const total = result.input + result.output + result.cacheCreate + result.cacheRead;
    console.log(
      `  ${s.session_id.slice(0, 12)}.. [${s.agent_type}] model=${result.modelId} ${result.estimated ? "(EST)" : ""}` +
        ` tokens=${total.toLocaleString()} cost=$${result.costUsd.toFixed(4)} preloaded=${result.preloaded.toLocaleString()}`,
    );
  } else {
    console.log(`  ${s.session_id.slice(0, 12)}.. SKIPPED`);
  }
}
raw.close();
