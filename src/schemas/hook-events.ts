import { z } from "zod";

/**
 * Zod schemas for the four Claude Code hook payloads Codi consumes.
 *
 * These payloads arrive as JSON on stdin from a separate process — a
 * trust boundary by the project's rule
 * `codi-code-style.md → Validate external input at system boundaries
 * with Zod`. Inline `typeof` guards in `cli/agent-hooks.ts` previously
 * carried that load; centralising in schemas:
 *   - prevents silent type drift (e.g. Claude Code renaming a field) by
 *     surfacing a structured parse error in stderr;
 *   - eliminates `as HookPayload` casts on untrusted JSON;
 *   - gives every runner a single inferred type via `z.output<…>`.
 *
 * All schemas are intentionally `passthrough()` — unknown keys are
 * preserved (forwards-compat with future Anthropic additions) but
 * validated keys are strict.
 */

/** Common fields shared by every hook payload. */
const HookEventBaseSchema = z
  .object({
    session_id: z.string().min(1).optional(),
    cwd: z.string().optional(),
    transcript_path: z.string().optional(),
    hook_event_name: z.string().optional(),
  })
  .passthrough();

/** `UserPromptSubmit` hook payload. */
export const UserPromptSubmitPayloadSchema = HookEventBaseSchema.extend({
  prompt: z.string().optional(),
});

/** `PreToolUse` hook payload. */
export const PreToolUsePayloadSchema = HookEventBaseSchema.extend({
  tool_name: z.string().optional(),
  tool_input: z.record(z.string(), z.unknown()).optional(),
});

/** `PostToolUse` hook payload — extends PreToolUse with the response. */
export const PostToolUsePayloadSchema = PreToolUsePayloadSchema.extend({
  tool_response: z.unknown().optional(),
});

/** `Stop` hook payload — minimal, session_id + cwd. */
export const StopPayloadSchema = HookEventBaseSchema;

export type UserPromptSubmitPayload = z.output<typeof UserPromptSubmitPayloadSchema>;
export type PreToolUsePayload = z.output<typeof PreToolUsePayloadSchema>;
export type PostToolUsePayload = z.output<typeof PostToolUsePayloadSchema>;
export type StopPayload = z.output<typeof StopPayloadSchema>;

/**
 * Generic safe-parse helper used by every runner. Returns the parsed
 * payload on success, or `null` on validation failure (with the error
 * written to stderr so a malformed payload is visible in the agent's
 * hook log). Never throws — hooks are fail-open by contract.
 */
export function safeParseHookPayload<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  hookName: string,
): z.output<S> | null {
  const result = schema.safeParse(raw);
  if (!result.success) {
    process.stderr.write(`[${hookName}] payload validation failed: ${result.error.message}\n`);
    return null;
  }
  return result.data;
}
