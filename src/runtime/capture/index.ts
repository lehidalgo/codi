/**
 * Public surface of `src/runtime/capture/` (Sprint 3 + F6).
 */

export {
  CAPTURE_TYPES,
  parseMarkers,
  isValidCaptureType,
  type CaptureType,
  type ParsedMarker,
} from "./markers.js";

export { persistMarkers, type CaptureInsertContext, type CaptureInsertResult } from "./persist.js";

export {
  ensureSession,
  endSession,
  recordPrompt,
  openTurn,
  latestTurnId,
  closeTurn,
  recordToolCall,
  recordArtifactUsage,
  refreshCaptureCount,
  type EnsureSessionInput,
  type RecordPromptInput,
  type RecordPromptResult,
  type OpenTurnInput,
  type CloseTurnInput,
  type RecordToolCallInput,
  type RecordArtifactUsageInput,
} from "./session.js";

export {
  processStopHook,
  readLastAssistantMessage,
  type StopHookInput,
  type StopHookResult,
} from "./stop-hook.js";

export {
  processPromptSubmit,
  type PromptSubmitInput,
  type PromptSubmitResult,
} from "./prompt-hook.js";

export { processPostToolUse, type ToolCallInput, type ToolCallResult } from "./tool-hook.js";
