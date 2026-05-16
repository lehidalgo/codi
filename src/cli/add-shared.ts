/**
 * Shared scaffolding for `codi add <type>` subcommands.
 *
 * ISSUE-043 — `add.ts` and `add-handlers.ts` historically duplicated the
 * same shape across `rule` / `skill` / `agent` / `mcp-server`:
 *
 *   1. Action callback (add.ts):
 *      - if `--all` → loop templates → summary → exit
 *      - if no name + interactive → wizard
 *      - if no name + json → error "name required"
 *      - else → handler(name) → regenerate → exit
 *
 *   2. Handler (add-handlers.ts):
 *      - resolve template against AVAILABLE_*_TEMPLATES
 *      - on unknown template → error CommandResult
 *      - call createX() scaffolder
 *      - on failure → error CommandResult
 *      - on success → success CommandResult
 *
 * The 4 callbacks and 4 handlers diverged in subtle ways (one didn't
 * spread `options`, another skipped the wizard, brand used a populated
 * hint), and every new artifact type forced a copy-paste of ~60 lines.
 *
 * The helpers below collapse both layers. Divergences are preserved via
 * named opts (`buildHandlerOptions`, `wizardFallback`, `hint`) rather
 * than ad-hoc branches inside the helper.
 */

import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import type { CommandResult, ProjectError } from "../core/output/types.js";
import { resolveArtifactName } from "../constants.js";
import { resolveProjectDir } from "../utils/paths.js";
import { handleOutput, regenerateConfigs } from "./shared.js";
import type { GlobalOptions } from "./shared.js";

/** Closed set of artifact kinds `codi add` accepts. */
export type AddArtifactType =
  | "rule"
  | "skill"
  | "agent"
  | "mcp-server"
  | "brand"
  // ISSUE-087 — workflow scaffolder. Yaml-only artifact, written to
  // .codi/workflows/, outside the four core artifact directories.
  | "workflow";

/** Shape every per-type handler conforms to (rule/skill/agent/mcp-server). */
export type AddHandler<O extends GlobalOptions> = (
  projectRoot: string,
  name: string,
  options: O,
) => Promise<CommandResult<{ name: string; path: string; template: string | null }>>;

// ─── Layer 1: action-callback helpers ────────────────────────────────

export interface RunAddAllArgs<O extends GlobalOptions> {
  readonly artifactType: AddArtifactType;
  readonly templates: readonly string[];
  readonly handler: AddHandler<O>;
  readonly options: O;
  /**
   * Build the per-template handler options. Defaults to spreading `options`
   * so global flags (`--json`, `--quiet`) propagate. The legacy `agent`
   * callback dropped the spread and only passed `{ template }` — preserve
   * that by supplying this hook.
   */
  readonly buildHandlerOptions?: (template: string) => O;
}

/**
 * Runs the `--all` fan-out for an add subcommand: iterate every template,
 * call the handler, build a summary `CommandResult`, render, and exit.
 * Terminates the process — never returns.
 */
export async function runAddAll<O extends GlobalOptions>(args: RunAddAllArgs<O>): Promise<never> {
  const { artifactType, templates, handler, options, buildHandlerOptions } = args;
  const results: Array<{ name: string; success: boolean }> = [];
  for (const tmpl of templates) {
    const handlerOpts = buildHandlerOptions
      ? buildHandlerOptions(tmpl)
      : ({ ...options, template: tmpl } as O);
    const result = await handler(process.cwd(), tmpl, handlerOpts);
    results.push({ name: tmpl, success: result.success });
  }
  const added = results.filter((r) => r.success).map((r) => r.name);
  const skipped = results.filter((r) => !r.success).map((r) => r.name);
  await regenerateConfigs(process.cwd());
  const summary = createCommandResult({
    success: skipped.length === 0,
    command: `add ${artifactType} --all`,
    data: { added, skipped, total: templates.length },
    exitCode: skipped.length === 0 ? EXIT_CODES.SUCCESS : EXIT_CODES.GENERAL_ERROR,
  });
  handleOutput(summary, options);
  process.exit(summary.exitCode);
}

export interface EmitNameRequiredArgs {
  readonly artifactType: AddArtifactType;
  /** Human label shown in the error message (e.g. "MCP server" vs "rule"). */
  readonly label: string;
  /**
   * Optional hint shown to humans. Most types leave it empty; `brand`
   * supplies a usage example because there is no `--all` fallback.
   */
  readonly hint?: string;
  readonly options: GlobalOptions;
}

/**
 * Emits a "name required" error CommandResult, renders it, and exits.
 * Used when the user runs `codi add <type>` with no `[name]` and no
 * `--all` flag (and JSON mode is on, so the wizard is suppressed).
 */
export function emitNameRequiredError(args: EmitNameRequiredArgs): never {
  const { artifactType, label, hint, options } = args;
  const suffix = artifactType === "brand" ? "" : " Use --all to add all templates.";
  const err = createCommandResult({
    success: false,
    command: `add ${artifactType}`,
    data: { name: "", path: "", template: null },
    errors: [
      {
        code: "E_CONFIG_INVALID",
        message: `${label} name required.${suffix}`,
        hint: hint ?? "",
        severity: "error",
        context: {},
      },
    ],
    exitCode: EXIT_CODES.GENERAL_ERROR,
  });
  handleOutput(err, options);
  process.exit(err.exitCode);
}

// ─── Layer 2: handler helper ─────────────────────────────────────────

export interface RunAddCommandArgs {
  readonly artifactType: AddArtifactType;
  /** Human label used in error messages: "rule" / "skill" / "agent template" / etc. */
  readonly label: string;
  readonly projectRoot: string;
  readonly name: string;
  readonly requestedTemplate: string | undefined;
  readonly availableTemplates: readonly string[];
  /**
   * Scaffolder invoker. Receives the resolved template (or `undefined` if
   * the caller did not request one) and returns either a Result-shaped
   * success/failure tuple OR a final CommandResult (e.g. brand reuses
   * createSkill but adapts the data shape externally).
   */
  readonly scaffold: (
    resolvedTemplate: string | undefined,
    configDir: string,
  ) => Promise<{ ok: true; data: string } | { ok: false; errors: readonly ProjectError[] }>;
}

/**
 * Generic handler body shared by rule / skill / agent / mcp-server adds.
 * Resolves the template against the available list, invokes the
 * scaffolder, and wraps the outcome in a CommandResult with consistent
 * `command` / `data` / `errors` shape. Callers that need extra fields on
 * `data` should call this then map the result.
 */
export async function runAddCommand(
  args: RunAddCommandArgs,
): Promise<CommandResult<{ name: string; path: string; template: string | null }>> {
  const {
    artifactType,
    label,
    projectRoot,
    name,
    requestedTemplate,
    availableTemplates,
    scaffold,
  } = args;
  const configDir = resolveProjectDir(projectRoot);

  const resolvedTemplate = requestedTemplate
    ? resolveArtifactName(requestedTemplate, availableTemplates)
    : undefined;

  if (requestedTemplate && !resolvedTemplate) {
    return createCommandResult({
      success: false,
      command: `add ${artifactType}`,
      data: { name, path: "", template: requestedTemplate },
      errors: [
        {
          code: "E_CONFIG_INVALID",
          message: `Unknown ${label} "${requestedTemplate}". Available: ${availableTemplates.join(", ")}`,
          hint: `Use one of: ${availableTemplates.join(", ")}`,
          severity: "error",
          context: { template: requestedTemplate },
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const result = await scaffold(resolvedTemplate, configDir);

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: `add ${artifactType}`,
      data: { name, path: "", template: requestedTemplate ?? null },
      errors: [...result.errors],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  return createCommandResult({
    success: true,
    command: `add ${artifactType}`,
    data: { name, path: result.data, template: requestedTemplate ?? null },
    exitCode: EXIT_CODES.SUCCESS,
  });
}
