import type { HookSpec } from "../hook-spec.js";

/**
 * Convert a HookSpec.files glob (e.g. `**\/*.{ts,tsx}`) to a `grep -E` pattern
 * suitable for filtering staged files. All registry globs follow the
 * `**\/*.ext` or `**\/*.{ext1,ext2}` shape; anything else returns empty,
 * which the caller treats as "no filter — apply to all staged files".
 */
export function globToGrepPattern(glob: string): string {
  const match = glob.match(/\*\*\/\*\.(?:\{([^}]+)\}|(\w+))$/);
  if (!match) return "";
  const extensions = match[1] ? match[1].split(",") : [match[2]];
  return `\\.(${extensions!.join("|")})$`;
}

/**
 * Render a list of HookSpecs as a shell script body for husky / standalone /
 * lefthook runners. Output is a deterministic sequence of commands that:
 *  - collect the list of staged files into $STAGED once
 *  - filter per-hook with `grep -E` against the hook's file extensions
 *  - guard required tools with `command -v` and emit a blocking exit on missing tools
 *  - optionally pass filenames via `printf | xargs` (safe for spaces)
 *  - re-stage files after formatters modify them on disk
 *
 * The renderer is pure — same input always yields the same output. A snapshot
 * test in tests/unit/hooks/shell-renderer.test.ts pins the byte-for-byte
 * baseline against the legacy buildHuskyCommands implementation.
 */
export function renderShellHooks(
  specs: HookSpec[],
  _runner: "husky" | "standalone" | "lefthook",
): string {
  const lines: string[] = [`STAGED=$(git diff --cached --name-only --diff-filter=ACMR)`];
  const modifiedVars: string[] = [];
  let lastLanguage: string | undefined;

  for (const h of specs) {
    const currentLang = h.language ?? "";
    if (currentLang !== lastLanguage) {
      lines.push(currentLang ? `# — ${currentLang} —` : `# — global —`);
      lastLanguage = currentLang;
    }

    const cmd = h.shell.command;
    const passFiles = h.shell.passFiles;
    const modifiesFiles = h.shell.modifiesFiles;

    if (!h.files) {
      const globalTool = cmd.split(/\s+/)[0]!;
      if (h.required === true) {
        const hint = h.installHint.command || `install ${globalTool}`;
        lines.push(
          `if ! command -v ${globalTool} > /dev/null 2>&1; then`,
          `  echo "  ✗ BLOCKING — install ${h.name} to commit: ${hint}"`,
          `  exit 1`,
          `fi`,
          cmd,
        );
      } else {
        lines.push(cmd);
      }
      continue;
    }

    const grepPattern = globToGrepPattern(h.files);
    const varName = h.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();

    if (!grepPattern) {
      if (passFiles === false) {
        lines.push(`[ -n "$STAGED" ] && ${cmd}`);
      } else {
        lines.push(`[ -n "$STAGED" ] && printf '%s\\n' $STAGED | xargs ${cmd}`);
      }
      if (modifiesFiles) modifiedVars.push("STAGED");
      continue;
    }

    lines.push(`${varName}=$(echo "$STAGED" | grep -E '${grepPattern}' || true)`);

    if (h.required === true) {
      const tool = h.shell.toolBinary;
      const hint = h.installHint.command || `install ${tool}`;
      if (passFiles === false) {
        lines.push(
          `if [ -n "$${varName}" ]; then`,
          `  if ! command -v ${tool} > /dev/null 2>&1 && ! [ -f "./node_modules/.bin/${tool}" ]; then`,
          `    echo "  ✗ BLOCKING — install ${h.name} to commit: ${hint}"`,
          `    exit 1`,
          `  fi`,
          `  ${cmd}`,
          `fi`,
        );
      } else {
        lines.push(
          `if [ -n "$${varName}" ]; then`,
          `  if ! command -v ${tool} > /dev/null 2>&1 && ! [ -f "./node_modules/.bin/${tool}" ]; then`,
          `    echo "  ✗ BLOCKING — install ${h.name} to commit: ${hint}"`,
          `    exit 1`,
          `  fi`,
          `  printf '%s\\n' $${varName} | xargs ${cmd}`,
          `fi`,
        );
      }
    } else if (passFiles === false) {
      lines.push(`[ -n "$${varName}" ] && ${cmd}`);
    } else {
      lines.push(`[ -n "$${varName}" ] && printf '%s\\n' $${varName} | xargs ${cmd}`);
    }

    if (modifiesFiles) modifiedVars.push(varName);
  }

  if (modifiedVars.length > 0) {
    const unique = [...new Set(modifiedVars)];
    for (const v of unique) {
      lines.push(`[ -n "$${v}" ] && printf '%s\\n' $${v} | xargs git add || true`);
    }
  }

  return lines.join("\n");
}
