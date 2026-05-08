/**
 * Subagent dispatcher.
 *
 * Real subagent execution happens via Claude Code's Task tool when the
 * skill declares `context: fork`. The runner here validates inputs and
 * outputs, enforces timeout, and translates verdicts to manifest events.
 *
 * In tests, dispatch is a function injected by the caller. In production,
 * the agent (Claude Code) executes the dispatch by invoking the skill in
 * a fork. The plugin script writes a request file the agent reads and
 * provides the response back.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";
import type { GateCheck, GateResult } from "./gate-types.js";
import { SUBAGENT_TIMEOUT_MS } from "./gate-types.js";

let resultValidator: ValidateFunction | null = null;

function getResultValidator(): ValidateFunction {
  if (resultValidator !== null) return resultValidator;
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, "..", "schemas", "runtime", "gate-result.schema.json");
  const schema = JSON.parse(readFileSync(path, "utf-8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats.default(ajv);
  resultValidator = ajv.compile(schema);
  return resultValidator;
}

export class SubagentTimeoutError extends Error {
  constructor(
    public readonly skillName: string,
    public readonly timeoutMs: number,
  ) {
    super(`Subagent ${skillName} exceeded ${timeoutMs}ms timeout.`);
    this.name = "SubagentTimeoutError";
  }
}

export class SubagentSchemaError extends Error {
  constructor(
    public readonly skillName: string,
    public readonly errors: unknown,
  ) {
    super(`Subagent ${skillName} returned malformed output: ${JSON.stringify(errors, null, 2)}`);
    this.name = "SubagentSchemaError";
  }
}

export interface DispatchOptions {
  skillName: string;
  inputs: Record<string, unknown>;
  allowedTools: string[];
  timeoutMs?: number;
}

export type DispatchFn = (opts: DispatchOptions) => Promise<unknown>;

export interface RunSubagentOptions {
  skillName: string;
  inputs: Record<string, unknown>;
  allowedTools?: string[];
  timeoutMs?: number;
  dispatch: DispatchFn;
  retryOnSchemaFailure?: boolean;
}

/**
 * Run a subagent with timeout, schema validation, and a single retry on
 * schema failure (per the constitutional rule for category A skills).
 */
export async function runSubagent(opts: RunSubagentOptions): Promise<GateResult> {
  const allowedTools = opts.allowedTools ?? ["Read", "Grep", "Glob"];
  const timeoutMs = opts.timeoutMs ?? SUBAGENT_TIMEOUT_MS;
  const retryAllowed = opts.retryOnSchemaFailure ?? true;

  const attempt = async (): Promise<GateResult> => {
    const dispatchPromise = opts.dispatch({
      skillName: opts.skillName,
      inputs: opts.inputs,
      allowedTools,
      timeoutMs,
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new SubagentTimeoutError(opts.skillName, timeoutMs));
      }, timeoutMs);
    });
    const raw = await Promise.race([dispatchPromise, timeoutPromise]);
    const validate = getResultValidator();
    if (!validate(raw)) {
      throw new SubagentSchemaError(opts.skillName, validate.errors);
    }
    return raw as GateResult;
  };

  try {
    return await attempt();
  } catch (err) {
    if (err instanceof SubagentSchemaError && retryAllowed) {
      // Single retry per the constitutional rule.
      return attempt();
    }
    throw err;
  }
}
