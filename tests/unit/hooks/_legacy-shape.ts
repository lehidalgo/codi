import type { HookSpec } from "#src/core/hooks/hook-spec.js";

/**
 * Test helper: build a HookSpec from the pre-redesign flat shape
 * (`command`, `stagedFilter`, `passFiles`, `modifiesFiles`). Keeps existing
 * test fixtures small and readable while the production code uses the new
 * shell + preCommit emission descriptors.
 */
export function legacyHook(opts: {
  name: string;
  command: string;
  stagedFilter?: string;
  passFiles?: boolean;
  modifiesFiles?: boolean;
  required?: boolean;
  installHint?: { command: string; url?: string };
  language?: string;
  category?: HookSpec["category"];
}): HookSpec {
  const passFiles = opts.passFiles !== false;
  return {
    name: opts.name,
    language: (opts.language ?? "global") as HookSpec["language"],
    category: opts.category ?? "lint",
    files: opts.stagedFilter ?? "",
    stages: ["pre-commit"],
    required: opts.required ?? false,
    shell: {
      command: opts.command,
      passFiles,
      modifiesFiles: opts.modifiesFiles ?? false,
      toolBinary: opts.command.split(/\s+/).find((p) => p !== "npx") ?? opts.name,
    },
    preCommit: {
      kind: "local",
      entry: opts.command,
      language: "system",
      passFilenames: passFiles,
    },
    installHint: opts.installHint ?? { command: "" },
  };
}
