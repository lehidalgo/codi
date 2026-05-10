/**
 * Pattern set for the security-reminder runtime hook.
 *
 * Nine rules covering common code-injection / XSS / unsafe-deserialisation
 * vectors. Patterns are matched against the proposed file content of a
 * PreToolUse Edit / Write / MultiEdit / NotebookEdit call.
 *
 * Each pattern declares either a path predicate (for files we identify by
 * path alone, like GitHub Actions workflows) or a list of substrings to
 * search inside the content. Substring patterns may declare an allow-list
 * of file extensions to suppress cross-language false positives (for
 * example, `pickle` only fires inside `.py`).
 */

export type PatternKind = "substring" | "path";

export interface SecurityPattern {
  ruleId: string;
  kind: PatternKind;
  substrings?: string[];
  pathPredicate?: (normalisedPath: string) => boolean;
  /** When set, the pattern only fires for files whose extension is in this list. */
  allowedExtensions?: string[];
  /** Codi-authored reminder shown to the agent. */
  reminder: string;
  /** Concrete safer-alternative suggestion. */
  suggestedAction: string;
}

const ghaWorkflowPath = (p: string): boolean =>
  p.includes(".github/workflows/") && (p.endsWith(".yml") || p.endsWith(".yaml"));

export const SECURITY_PATTERNS: SecurityPattern[] = [
  {
    ruleId: "gha-injection",
    kind: "path",
    pathPredicate: ghaWorkflowPath,
    reminder:
      "GitHub Actions workflow detected. Untrusted event payload fields (issue title, PR body, commit message, author email) must never appear inside `run:` blocks. Pass them through `env:` and reference the env var instead.",
    suggestedAction:
      'Bind the value to an env var, then use the env var in `run:` (env: { TITLE: ${{ github.event.issue.title }} } then run: echo "$TITLE").',
  },
  {
    ruleId: "child-process-exec",
    kind: "substring",
    substrings: ["child_process.exec", "exec(", "execSync("],
    allowedExtensions: [".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx"],
    reminder:
      "Shell-spawning APIs interpolate strings through a shell, so any user-controlled input enables command injection.",
    suggestedAction:
      "Prefer execFile / spawn with an argv array. If shell features are required, validate the input against a strict allowlist first.",
  },
  {
    ruleId: "new-function",
    kind: "substring",
    substrings: ["new Function("],
    allowedExtensions: [".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx"],
    reminder: "new Function(...) evaluates arbitrary source code at runtime — equivalent to eval.",
    suggestedAction:
      "Replace with a static dispatch table or a typed parser. Only keep new Function when input is provably static at build time.",
  },
  {
    ruleId: "eval-call",
    kind: "substring",
    substrings: ["eval("],
    allowedExtensions: [".js", ".ts", ".mjs", ".cjs", ".py", ".rb", ".php"],
    reminder: "eval executes arbitrary code from a string and is a top-tier injection vector.",
    suggestedAction:
      "Use JSON.parse for data, a real parser for expressions, or a typed lookup table for command dispatch.",
  },
  {
    ruleId: "dangerously-set-html",
    kind: "substring",
    substrings: ["dangerouslySetInnerHTML"],
    allowedExtensions: [".jsx", ".tsx"],
    reminder:
      "dangerouslySetInnerHTML injects raw HTML and bypasses Reacts escape — XSS unless content is trusted.",
    suggestedAction:
      "Render text via JSX children, or sanitise with DOMPurify before assignment if HTML is required.",
  },
  {
    ruleId: "document-write",
    kind: "substring",
    substrings: ["document.write"],
    allowedExtensions: [".js", ".ts", ".mjs", ".cjs", ".html"],
    reminder: "document.write is XSS-prone and blocks rendering.",
    suggestedAction:
      "Build nodes with createElement and appendChild, or set textContent. Avoid HTML strings entirely.",
  },
  {
    ruleId: "inner-html-assign",
    kind: "substring",
    substrings: [".innerHTML =", ".innerHTML="],
    allowedExtensions: [".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx", ".html"],
    reminder: "Assigning to .innerHTML injects HTML directly. Untrusted strings here become XSS.",
    suggestedAction:
      "Use textContent for plain text. For rich content, sanitise with DOMPurify or build a DOM fragment.",
  },
  {
    ruleId: "pickle-deserialize",
    kind: "substring",
    substrings: ["pickle.load", "pickle.loads"],
    allowedExtensions: [".py"],
    reminder:
      "pickle deserialises arbitrary Python objects, which is equivalent to remote code execution if the data came from an untrusted source.",
    suggestedAction:
      "Use json for data interchange. Only pickle data you produced yourself in trusted local files.",
  },
  {
    ruleId: "os-system",
    kind: "substring",
    substrings: ["os.system", "from os import system"],
    allowedExtensions: [".py"],
    reminder:
      "os.system runs a shell command from a string and inherits the shells interpolation behaviour.",
    suggestedAction: "Use subprocess.run([...], check=True) with an argv list and shell=False.",
  },
];
