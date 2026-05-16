import type { GeneratedFile } from "../types/agent.js";
import { hashContent } from "../utils/hash.js";
import { MANIFEST_FILENAME, PROJECT_DIR } from "../constants.js";
import {
  buildSkillTrackerScript,
  buildSkillObserverScript,
  buildLauncherFile,
  HOOKS_SUBDIR,
  SKILL_TRACKER_FILENAME,
  SKILL_OBSERVER_FILENAME,
} from "../core/hooks/heartbeat-hooks.js";

/**
 * Result of {@link buildHeartbeatArtifacts}: the generated heartbeat
 * `GeneratedFile`s plus the canonical paths an adapter needs to embed
 * inside its hook-config payload (settings.json, hooks.json, etc.).
 *
 * Paths are project-root-relative; adapters that need a project-root
 * prefix in their hook commands (Codex `git rev-parse`, Claude Code
 * `$CLAUDE_PROJECT_DIR`) prepend it at the call site.
 */
export interface HeartbeatArtifacts {
  files: GeneratedFile[];
  launcherPath: string;
  trackerPath: string;
  observerPath: string;
}

export interface HeartbeatOptions {
  emitTracker: boolean;
  emitObserver: boolean;
}

/**
 * Build the heartbeat hook scripts (tracker + observer) and the node
 * launcher wrapper as `GeneratedFile`s, gated by the per-hook flags.
 *
 * Consolidates the three near-identical copies that previously lived in
 * `claude-code.ts`, `codex.ts`, and `copilot.ts`. With this helper, the
 * leaf adapters no longer need to import from
 * `src/core/hooks/heartbeat-hooks.js` — see `scripts/guard-layering.mjs`
 * for the matching layering rule.
 *
 * `emitTracker` / `emitObserver` are passed through verbatim from
 * {@link isHeartbeatEnabled} so callers can gate emission on the user's
 * `.codi/state/state.json` `selectedHooks.runtime` selection.
 */
export function buildHeartbeatArtifacts(options: HeartbeatOptions): HeartbeatArtifacts {
  const files: GeneratedFile[] = [];
  const trackerPath = `${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_TRACKER_FILENAME}`;
  const observerPath = `${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_OBSERVER_FILENAME}`;

  if (options.emitTracker) {
    const trackerScript = buildSkillTrackerScript();
    files.push({
      path: trackerPath,
      content: trackerScript,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(trackerScript),
    });
  }

  if (options.emitObserver) {
    const observerScript = buildSkillObserverScript();
    files.push({
      path: observerPath,
      content: observerScript,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(observerScript),
    });
  }

  const launcher = buildLauncherFile();
  files.push({
    path: launcher.path,
    content: launcher.content,
    sources: [MANIFEST_FILENAME],
    hash: hashContent(launcher.content),
  });

  return {
    files,
    launcherPath: launcher.path,
    trackerPath,
    observerPath,
  };
}

export { launcherCommand } from "../core/hooks/heartbeat-hooks.js";
