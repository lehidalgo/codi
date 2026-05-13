/**
 * Page registry — wires every brain-ui HTML route. Each page lives in its
 * own module under `pages/` and registers itself via a `registerXxx`
 * function. Adding a new page is two lines: import + register.
 */

import type { Hono } from "hono";
import type { BrainHandle } from "#src/runtime/brain/db.js";
import { registerDashboard } from "./pages/dashboard.js";
import { registerSessions } from "./pages/sessions.js";
import { registerCaptures } from "./pages/captures.js";
import { registerToolCalls } from "./pages/tool-calls.js";
import { registerWorkflows } from "./pages/workflows.js";
import { registerArtifacts } from "./pages/artifacts.js";
import { registerPainPoints } from "./pages/pain-points.js";
import { registerSettings } from "./pages/settings.js";

export function registerPages(app: Hono, brain: BrainHandle): void {
  registerDashboard(app, brain);
  registerSessions(app, brain);
  registerCaptures(app, brain);
  registerToolCalls(app, brain);
  registerWorkflows(app, brain);
  registerArtifacts(app, brain);
  registerPainPoints(app, brain);
  registerSettings(app, brain);
}
