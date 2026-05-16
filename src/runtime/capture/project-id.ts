/**
 * Stable per-checkout identifier derived from the current working directory.
 *
 * The id is `<basename>-<8-hex>` where the hex suffix is a non-cryptographic
 * 31-rolling-hash of the full cwd path. This shape:
 *   - keeps two checkouts of the same repository distinguishable in the
 *     brain DB (the suffix differs because the absolute path does);
 *   - is short enough to read in tool output and dashboards;
 *   - is deterministic across process restarts (same cwd → same id), so
 *     stop-hook + prompt-hook + tool-hook in the same session always agree
 *     on which project owns the row.
 *
 * Lives in its own module rather than being re-declared per hook because
 * three byte-identical copies previously drifted into `prompt-hook.ts`,
 * `tool-hook.ts`, and `stop-hook.ts` — any future tweak to one risked
 * silently splitting captures across two different ids.
 */
export function deriveProjectId(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  const basename = parts[parts.length - 1] ?? "project";
  let h = 0;
  for (let i = 0; i < cwd.length; i += 1) {
    h = (h * 31 + cwd.charCodeAt(i)) | 0;
  }
  return `${basename}-${(h >>> 0).toString(16).slice(0, 8)}`;
}
