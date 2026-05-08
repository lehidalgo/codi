/**
 * Google account-type detection for the project bootstrap flow.
 *
 * Service accounts have zero Drive storage quota of their own — they CANNOT
 * own files. To create Sheets, the agent needs a "host" with quota:
 *
 *   - Personal account (gmail.com): user creates a Drive folder + shares with SA,
 *     OR user creates a blank Sheet themselves and the agent attaches via sheet_id.
 *     SA-created files in user-shared folders are *technically* possible but unreliable
 *     on personal accounts (Google has tightened restrictions on post-April-2025 SAs).
 *     The robust pattern: user creates the Sheet, agent populates tabs + headers.
 *
 *   - Workspace account (@<workspace-domain>): use a Shared Drive (org-owned, no
 *     individual quota). SA gets Content Manager role on the Shared Drive; agent
 *     creates Sheet inside via Drive API. Files are owned by the org.
 *
 * The agent uses `detectAccountType(email)` to pick the right elicitation branch.
 */

export type GoogleAccountType = "personal" | "workspace";

const PERSONAL_DOMAINS: ReadonlyArray<string> = ["@gmail.com", "@googlemail.com"];

/**
 * Classify a Google account by email domain.
 * Heuristic: gmail.com / googlemail.com → personal. Anything else → workspace.
 *
 * Note: this misclassifies users with a Workspace account but no Shared Drive
 * (some small orgs don't use Shared Drives). Such users still need to either
 * (a) get a Shared Drive provisioned, (b) use a user-owned folder, or
 * (c) attach a manually-created Sheet.
 */
export function detectAccountType(email: string): GoogleAccountType {
  const lower = email.toLowerCase().trim();
  for (const suffix of PERSONAL_DOMAINS) {
    if (lower.endsWith(suffix)) return "personal";
  }
  return "workspace";
}

/**
 * Human-readable summary of recommended bootstrap mode for the account type.
 * Used by gcloud-setup.sh's stdout summary and by the agent's elicitation flow.
 */
export function recommendedBootstrapMode(type: GoogleAccountType): string {
  if (type === "personal") {
    return [
      "Personal Google account.",
      "Service accounts cannot create Sheets here (zero Drive quota).",
      "Recommended: you create a blank Google Sheet, share it with the SA email as Editor,",
      'then run `devloop sheets create-project --name "X" --sheet-id "<id>"`',
      "to add the 6 canonical tabs + headers.",
    ].join(" ");
  }
  return [
    "Workspace account.",
    "Recommended: use a Shared Drive (org-owned, no individual quota issues).",
    "Add the SA email as Content Manager on a Shared Drive, then run",
    '`devloop sheets create-project --name "X" --folder-id "<sharedDriveOrFolderId>"`',
    "(supportsAllDrives is enabled — works for both Shared Drives and regular folders).",
  ].join(" ");
}
