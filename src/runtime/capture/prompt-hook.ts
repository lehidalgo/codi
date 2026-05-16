/**
 * UserPromptSubmit hook orchestrator (F6).
 *
 * Claude Code fires this hook each time the user submits a prompt. Payload:
 *
 *     { session_id, prompt, cwd, transcript_path, hook_event_name }
 *
 * The hook runs BEFORE the prompt reaches the agent. Side effects:
 *   1. UPSERT the sessions row (so Stop hook does not have to resurrect it).
 *   2. Insert a `prompts` row with the verbatim text.
 *   3. Open a `turns` row pointing at that prompt — Stop hook closes it.
 *
 * The previous version of this hook only printed the workflow-state +
 * capture-reminder blocks to stdout. Both responsibilities are preserved:
 * `processPromptSubmit` writes to brain; the existing `buildPromptStateBlock`
 * + `buildCaptureReminderBlock` continue to drive stdout.
 */

import type { BrainHandle } from "../brain/db.js";
import { ensureProject, ensureSession, openTurn, recordPrompt } from "./session.js";

import { deriveProjectId } from "./project-id.js";
export interface PromptSubmitInput {
  readonly sessionId: string;
  readonly prompt: string;
  readonly cwd: string;
  readonly transcriptPath?: string;
  readonly agentType?: string;
  readonly agentModel?: string;
  readonly workflowId?: string;
}

export interface PromptSubmitResult {
  readonly promptId: number;
  readonly turnId: number;
  readonly turnNo: number;
}

export function processPromptSubmit(
  handle: BrainHandle,
  input: PromptSubmitInput,
): PromptSubmitResult {
  const { raw } = handle;

  const projectId = deriveProjectId(input.cwd);
  ensureProject(raw, { projectId, cwd: input.cwd });
  ensureSession(raw, {
    sessionId: input.sessionId,
    projectId,
    agentType: input.agentType ?? "claude-code",
    agentModel: input.agentModel,
    workingDir: input.cwd,
    transcriptPath: input.transcriptPath,
    workflowId: input.workflowId,
  });

  const p = recordPrompt(raw, { sessionId: input.sessionId, text: input.prompt });
  const turnId = openTurn(raw, {
    sessionId: input.sessionId,
    promptId: p.promptId,
    turnNo: p.turnNo,
  });

  return { promptId: p.promptId, turnId, turnNo: p.turnNo };
}
