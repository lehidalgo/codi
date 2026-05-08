/**
 * Public surface of `src/runtime/capture/` (Sprint 3).
 */

export {
  CAPTURE_TYPES,
  parseMarkers,
  isValidCaptureType,
  type CaptureType,
  type ParsedMarker,
} from "./markers.js";

export { persistMarkers, type CaptureInsertContext, type CaptureInsertResult } from "./persist.js";
