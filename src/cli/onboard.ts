import type { Command } from "commander";
import { renderOnboardingGuide } from "../core/onboard/catalog-renderer.js";

export function registerOnboardCommand(program: Command): void {
  program
    .command("onboard")
    .description(
      "Print AI-guided onboarding instructions — run this and let your coding agent follow them",
    )
    .action(() => {
      const guide = renderOnboardingGuide();
      process.stdout.write(guide);
    });
}
