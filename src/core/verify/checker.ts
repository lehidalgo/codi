import type { VerificationData } from "./token.js";
import { PROJECT_NAME } from "#src/constants.js";

/**
 * Parsed outcome of comparing an agent's verification response against
 * the expected {@link VerificationData}.
 */
export interface VerifyResult {
  /** `true` when the agent echoed the exact expected verification token. */
  tokenMatch: boolean;
  /** The token that was expected in the response. */
  expectedToken: string;
  /** Token found in the response, or `null` if none was detected. */
  receivedToken: string | null;
  /** Rule names the agent correctly reported. */
  rulesFound: string[];
  /** Rule names absent from the agent's response. */
  rulesMissing: string[];
  /** Rule names the agent reported that were not expected. */
  rulesExtra: string[];
  /** Active flag descriptions the agent correctly reported. */
  flagsFound: string[];
  /** Active flag descriptions absent from the agent's response. */
  flagsMissing: string[];
}

const TOKEN_RE = new RegExp(`${PROJECT_NAME}-[a-f0-9]{12}`);

const RULE_HEADERS = [/rules?\s*loaded/i, /rules?\s*\(\d+\)/i, /^-?\s*rules?\s*:/i];
const FLAG_HEADERS = [
  /flags?\s*active/i,
  /flags?\s*\(\d+\)/i,
  /^-?\s*flags?\s*:/i,
  /permissions?\s*:/i,
];

/**
 * Parse an agent's free-text verification response and compare it against
 * the expected verification data.
 *
 * The function uses fuzzy matching so that minor formatting differences
 * (markdown emphasis, extra whitespace) do not cause false negatives.
 *
 * @param response - Raw text output from the agent being verified.
 * @param expected - The ground-truth data to compare against.
 * @returns A {@link VerifyResult} describing what matched and what was missing.
 */
export function checkAgentResponse(response: string, expected: VerificationData): VerifyResult {
  const tokenMatch = TOKEN_RE.exec(response);
  const receivedToken = tokenMatch ? tokenMatch[0] : null;

  const reportedRules = extractListItems(response, RULE_HEADERS);
  const reportedFlags = extractListItems(response, FLAG_HEADERS);

  const rulesFound: string[] = [];
  const rulesMissing: string[] = [];
  for (const name of expected.ruleNames) {
    if (fuzzyIncludes(reportedRules, name)) {
      rulesFound.push(name);
    } else {
      rulesMissing.push(name);
    }
  }

  const rulesExtra = reportedRules.filter((r) => !expected.ruleNames.some((n) => fuzzyMatch(r, n)));

  const flagsFound: string[] = [];
  const flagsMissing: string[] = [];
  for (const flag of expected.activeFlags) {
    if (fuzzyIncludes(reportedFlags, flag)) {
      flagsFound.push(flag);
    } else {
      flagsMissing.push(flag);
    }
  }

  return {
    tokenMatch: receivedToken === expected.token,
    expectedToken: expected.token,
    receivedToken,
    rulesFound,
    rulesMissing,
    rulesExtra,
    flagsFound,
    flagsMissing,
  };
}

function extractListItems(text: string, headerPatterns: RegExp[]): string[] {
  const lines = text.split("\n");
  const items: string[] = [];
  let capturing = false;

  for (const line of lines) {
    const matchedPattern = headerPatterns.find((p) => p.test(line));
    if (matchedPattern) {
      capturing = true;
      const inline = line
        .replace(matchedPattern, "")
        .replace(/^[:\s\-()0-9]+/, "")
        .trim();
      if (inline) {
        items.push(
          ...inline
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }
      continue;
    }

    if (capturing) {
      const bullet = line.match(/^\s*[-*]\s+(.+)/);
      if (bullet) {
        items.push(bullet[1]!.trim());
      } else if (line.trim() === "") {
        capturing = false;
      } else {
        items.push(
          ...line
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean),
        );
        capturing = false;
      }
    }
  }

  return items;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[`"'*_[\]]/g, "")
    .trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function fuzzyIncludes(list: string[], target: string): boolean {
  return list.some((item) => fuzzyMatch(item, target));
}
