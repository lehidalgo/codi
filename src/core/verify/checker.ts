import type { VerificationData } from './token.js';

export interface VerifyResult {
  tokenMatch: boolean;
  expectedToken: string;
  receivedToken: string | null;
  rulesFound: string[];
  rulesMissing: string[];
  rulesExtra: string[];
  flagsFound: string[];
  flagsMissing: string[];
}

const TOKEN_RE = /codi-[a-f0-9]{12}/;

export function checkAgentResponse(
  response: string,
  expected: VerificationData,
): VerifyResult {
  const tokenMatch = TOKEN_RE.exec(response);
  const receivedToken = tokenMatch ? tokenMatch[0] : null;

  const reportedRules = extractListItems(response, /rules?\s*loaded/i);
  const reportedFlags = extractListItems(response, /flags?\s*active/i);

  const rulesFound: string[] = [];
  const rulesMissing: string[] = [];
  for (const name of expected.ruleNames) {
    if (fuzzyIncludes(reportedRules, name)) {
      rulesFound.push(name);
    } else {
      rulesMissing.push(name);
    }
  }

  const rulesExtra = reportedRules.filter(
    (r) => !expected.ruleNames.some((n) => fuzzyMatch(r, n)),
  );

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

function extractListItems(text: string, headerPattern: RegExp): string[] {
  const lines = text.split('\n');
  const items: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (headerPattern.test(line)) {
      capturing = true;
      const inline = line.replace(headerPattern, '').replace(/^[:\s-]+/, '').trim();
      if (inline) {
        items.push(...inline.split(/[,;]/).map((s) => s.trim()).filter(Boolean));
      }
      continue;
    }

    if (capturing) {
      const bullet = line.match(/^\s*[-*]\s+(.+)/);
      if (bullet) {
        items.push(bullet[1]!.trim());
      } else if (line.trim() === '') {
        capturing = false;
      } else {
        items.push(...line.split(/[,;]/).map((s) => s.trim()).filter(Boolean));
        capturing = false;
      }
    }
  }

  return items;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[`"'*_[\]]/g, '').trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function fuzzyIncludes(list: string[], target: string): boolean {
  return list.some((item) => fuzzyMatch(item, target));
}
