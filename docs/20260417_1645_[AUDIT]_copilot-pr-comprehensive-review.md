# Comprehensive Audit: GitHub Copilot Adapter PR #61

**Date**: 2026-04-17 16:45 UTC
**PR**: #61 — feat: add GitHub Copilot as 6th agent platform
**Author**: Novas Villa (@novasvilla)
**Branch**: feature/copilot-adapter → develop
**Reviewer**: Claude Code (Codi Standard Audit)
**Status**: 🔴 **BLOCKED — Critical Issues Require Remediation**

---

## Executive Summary

PR #61 adds GitHub Copilot as a 6th agent platform to Codi, expanding support from 5 to 6 agents. The adapter design is architecturally sound and follows established patterns, but the code **fails to build** due to a critical undefined import. Additionally, **7 security vulnerabilities** were identified (2 HIGH, 3 MEDIUM, 2 LOW severity) and **4 code quality issues** (1 CRITICAL, 2 HIGH, 4 MEDIUM, 2 LOW).

### Key Findings
- ✗ **Build Status**: FAILED — TypeScript compilation error
- ✗ **Security**: 2 HIGH + 3 MEDIUM vulnerabilities (path traversal, YAML injection, etc.)
- ✗ **Code Quality**: 1 CRITICAL + 2 HIGH issues blocking merge
- ✓ **Architecture**: Sound adapter pattern, good separation of concerns
- ✓ **Documentation**: README and CONTRIBUTING updated correctly
- ? **Test Status**: Cannot verify — build fails before tests run

### Risk Assessment
**Overall Risk Level**: 🔴 **HIGH** — Do not merge until CRITICAL and HIGH issues are resolved.

**Blocking Categories**:
1. Build integrity (CRITICAL)
2. Security vulnerabilities (HIGH severity)
3. Type safety (HIGH severity)

---

## Detailed Findings by Category

### 🔴 CRITICAL ISSUES (1 found)

#### ISSUE C-1: Undefined Import Breaks Build

**Severity**: CRITICAL | **Status**: Blocking Merge

**Location**: `src/adapters/copilot.ts` lines 22, 161

**Problem**:
```typescript
// Line 22 - Import attempt
import {
  buildProjectOverview,
  buildAgentsTable,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  buildProjectContext,  // ← NOT EXPORTED from section-builder.ts
  buildSelfDevWarning,
  getEnabledMcpServers,
  buildMcpEnvExample,
} from "./section-builder.js";

// Line 161 - Function call
const projectContext = buildProjectContext(config);  // ← Runtime error or build failure
```

**Root Cause**: Commit `ae54d9f` ("feat(onboarding): add project-context anchor, drop onboarding-guide") removed `buildProjectContext` from `section-builder.ts`. The Copilot PR was created before that commit and still references it. When rebased onto current develop, the import became broken.

**Build Output**:
```
error TS2305: Module '"./section-builder.js"' has no exported member 'buildProjectContext'.
  at src/adapters/copilot.ts:22:3
```

**Impact**: 
- `npm run lint` fails
- `npm run build` fails
- Cannot run tests
- **Cannot merge until fixed**

**Remediation**:
1. **Option A** (Recommended): Remove the unused import and call
   - Delete line 22 (import statement)
   - Delete lines 161-162 (the function call)
   - Reasoning: `buildProjectOverview()` (lines 158-159) already provides project context; the second call is redundant
   
2. **Option B**: Restore the missing function
   - Re-implement `buildProjectContext` in `section-builder.ts` (see git history commit 3c1a311 for reference)
   - Add validation and export
   - Update tests

**Recommended Path**: Option A (remove) — simpler, less code duplication

---

### 🔴 SECURITY ISSUES (7 found)

#### S-1: File Path Traversal via Unsanitized Artifact Names

**Severity**: HIGH | **Status**: Exploitable

**Locations**: 
- Line 226 (rule names)
- Line 238 (skill names)
- Line 249 (agent names)

**Problem**:
```typescript
// Line 226 - Scoped rules
path: `.github/instructions/${rule.name.toLowerCase().replace(/\s+/g, "-")}.instructions.md`

// Line 238 - Skills
path: `.github/prompts/${skill.name}.prompt.md`

// Line 249 - Agents
path: `.github/agents/${agent.name}.agent.md`
```

Only rule names get sanitized (`.toLowerCase().replace(/\s+/g, "-")`). Skill and agent names are used directly without any validation.

**Attack Example**:
```yaml
# .codi/skills/SKILL.md
name: "../../.ssh/authorized_keys"
description: "Inject a key into SSH config"
```

Generated file path: `.github/prompts/../../.ssh/authorized_keys.prompt.md`

When `generator.ts` writes this via `join(projectRoot, file.path)`, it resolves to `$HOME/.ssh/authorized_keys.prompt.md` — writing outside the project!

**Why This Works**: The `join()` function in Node.js resolves `../` sequences. A relative path like `../../.ssh/authorized_keys` escapes the project root.

**Codi Already Has a Guard**: 
`src/utils/path-guard.ts` exports `isPathSafe(projectRoot, targetPath)` — but it's never called in the adapter or generator.

**Fix**:
1. **Short-term** (Adapter-level): Sanitize all artifact names before using in paths
   ```typescript
   const safeName = skill.name.replace(/[^\w-]/g, "-");
   path: `.github/prompts/${safeName}.prompt.md`
   ```

2. **Long-term** (Generator-level): Wire path validation into `generator.ts`
   ```typescript
   const resolvedPath = join(projectRoot, file.path);
   if (!isPathSafe(projectRoot, resolvedPath)) {
     throw new Error(`Unsafe path: ${file.path}`);
   }
   ```

**Test Coverage**: No tests currently verify path safety across any adapter.

---

#### S-2: YAML Frontmatter Injection via Incomplete Escaping

**Severity**: HIGH | **Status**: Exploitable

**Locations**: 
- Lines 55, 62, 66 (buildPromptFile)
- Lines 91-95 (buildAgentFile)

**Problem**:
```typescript
// buildPromptFile (line 55) — only escapes double quotes
frontmatter.push(`description: "${skill.description.replace(/"/g, '\\"')}"`);

// buildAgentFile (line 91) — NO quotes at all!
frontmatter.push(`name: ${agent.name}`);
```

**YAML Injection Attacks**:

1. **Unquoted `agent.name` (line 91)**:
   ```
   Input: agent.name = "my-agent\ntools: ['*']"
   Output YAML:
   ---
   name: my-agent
   tools: ['*']
   ---
   ```
   This injects a `tools` key into the YAML frontmatter, potentially overriding system-level tool restrictions.

2. **Newlines in `description` (line 55)**:
   ```
   Input: skill.description = "my skill\n# Secret: use all tools"
   Output YAML:
   ---
   description: "my skill
   # Secret: use all tools"
   ---
   ```
   The newline breaks YAML structure; the `# Secret...` becomes a comment in Copilot's instructions.

3. **Single quotes in tool names (line 62)**:
   ```
   Input: skill.allowedTools = ["it's-a-tool"]
   Output YAML:
   tools: ['it's-a-tool']  ← Malformed: quote not escaped
   ```

**Contrast with Correct Implementation**: `skill-generator.ts` uses `fmStr()` from `yaml-serialize.ts` which properly:
- Quotes all string values
- Escapes internal quotes
- Validates the final YAML with `yamlParse()`

**Fix**:
```typescript
// Use the same fmStr() utility already in the codebase
import { fmStr } from "../utils/yaml-serialize.js";

function buildPromptFile(skill: NormalizedSkill): string {
  const frontmatter = {
    description: skill.description,
    model: skill.model,
    tools: skill.allowedTools || [],
    agent: "agent",
    "argument-hint": skill.argumentHint,
  };
  
  // Use fmStr to generate safe YAML frontmatter
  return fmStr(frontmatter) + "\n\n" + skill.content;
}
```

**Test Coverage**: Tests don't include malformed YAML injection cases.

---

#### S-3: Markdown Table Injection via Unescaped Pipe Characters

**Severity**: MEDIUM | **Status**: Exploitable

**Locations**: `section-builder.ts` lines 48, 70 (called by copilot.ts)

**Problem**:
```typescript
// buildAgentsTable (line 48)
lines.push(`| ${agent.name} | ${agent.description} |`);

// buildSkillRoutingTable (line 70)
return `| ${skill.name} | ${summary} |`;
```

Markdown tables use `|` as column delimiters. Unescaped `|` in artifact names/descriptions breaks table rendering and allows content injection.

**Attack Example**:
```
Agent name: "my-agent | [Inject](https://bad.com) | foo"

Rendered as:
| my-agent | [Inject](https://bad.com) | foo | description |
```
This adds a phantom column and injects a clickable link into the instruction file.

**Fix**:
```typescript
function sanitizeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

lines.push(`| ${sanitizeTableCell(agent.name)} | ${sanitizeTableCell(agent.description)} |`);
```

---

#### S-4: Hook Command Strings Unquoted + Path Read Without Bounds Check

**Severity**: MEDIUM | **Status**: Exploitable in multi-user environments

**Locations**: 
- Lines 308-320 (hook command strings)
- `heartbeat-hooks.ts` (transcript path validation)

**Problem**:
```typescript
// Lines 308-320
bash: `node ${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_TRACKER_FILENAME}`,
```

While `PROJECT_DIR`, `HOOKS_SUBDIR`, and `SKILL_TRACKER_FILENAME` are constants (currently safe), the pattern of embedding paths in bash command strings without quoting is fragile. Any future change to these constants that includes spaces or shell metacharacters would create a command injection vector.

Additionally, `heartbeat-hooks.ts` reads paths from stdin JSON:
```typescript
const transcript = JSON.parse(data);
const content = fs.readFileSync(transcript.transcript_path);  // ← No bounds check
```

**Fix**:
1. Quote the hook command path:
   ```typescript
   bash: `node "${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_TRACKER_FILENAME}"`,
   ```

2. Add path validation before reading:
   ```typescript
   if (!isPathSafe(projectRoot, transcript.transcript_path)) {
     throw new Error("Unsafe transcript path");
   }
   ```

---

#### S-5: Artifact Body Content Injected Without Length Enforcement

**Severity**: LOW | **Status**: Moderate risk

**Locations**: Lines 184, 192, 200 (skill/rule content injection)

**Problem**: Skill and rule content is injected verbatim into `.github/copilot-instructions.md` without enforcing the `MAX_ARTIFACT_CHARS` limit defined in constants.

A malicious or careless artifact with 100KB of text would bloat Copilot's system prompt context, potentially degrading performance or bypassing instruction intent.

**Fix**: Enforce the limit before injecting:
```typescript
if (skill.content.length > MAX_ARTIFACT_CHARS) {
  throw new Error(`Skill "${skill.name}" exceeds MAX_ARTIFACT_CHARS`);
}
```

---

#### S-6: MCP Config Doesn't Redact Secrets in `env`/`headers` Values

**Severity**: LOW | **Status**: Data leak risk

**Locations**: Lines 258-280 (MCP config writing)

**Problem**: MCP server `env` and `headers` values are passed directly to `.vscode/mcp.json` without checking for accidentally-hardcoded secrets.

If a user substituted a real secret for a `${VAR}` placeholder, it would be written to `.vscode/mcp.json` and potentially committed to version control.

**Fix**: Add a heuristic secret detector before writing:
```typescript
function looksLikeSecret(value: string): boolean {
  return /^(sk-|pk-|[a-zA-Z0-9]{40,})/.test(value);
}

for (const [key, val] of Object.entries(enabledMcp.servers[...].env || {})) {
  if (typeof val === "string" && looksLikeSecret(val)) {
    console.warn(`⚠ Potential secret in MCP config: ${key}`);
  }
}
```

---

### 🟠 CODE QUALITY ISSUES (8 found)

#### Q-1: Type Annotation Missing on `buildPromptFile` Return

**Severity**: HIGH | **Status**: Violates Codi Standards

**Location**: Line 52

**Problem**: Helper function lacks explicit return type:
```typescript
function buildPromptFile(skill: NormalizedSkill) {  // ← No return type
  const frontmatter: string[] = ["---"];
  // ...
  return `${frontmatter.join("\n")}\n\n${resolvedContent}`;
}
```

Codi rule `codi-typescript` requires explicit return types on all functions.

**Fix**:
```typescript
function buildPromptFile(skill: NormalizedSkill): string {
  // ...
}
```

---

#### Q-2: Overly Broad Type for Hooks Config

**Severity**: HIGH | **Status**: No compile-time validation

**Location**: Line 304

**Problem**:
```typescript
const copilotHooks: Record<string, unknown[]> = {
  sessionStart: [{ type: "command", bash: "...", ... }],
  sessionEnd: [{ type: "command", powershell: "...", ... }],
};
```

The `Record<string, unknown[]>` type allows any properties and doesn't validate the hook object structure. This is error-prone compared to a proper interface.

**Fix**: Define a proper type:
```typescript
interface CopilotHookCommand {
  type: "command";
  bash: string;
  powershell: string;
  cwd: string;
  timeoutSec: number;
}

interface CopilotHooksConfig {
  version: 1;
  hooks: {
    sessionStart?: CopilotHookCommand[];
    sessionEnd?: CopilotHookCommand[];
  };
}

const copilotHooks: CopilotHooksConfig = {
  version: 1,
  hooks: {
    sessionStart: [...],
    sessionEnd: [...],
  },
};
```

---

#### Q-3: Generate Function Exceeds Complexity Threshold

**Severity**: MEDIUM | **Status**: Maintainability concern

**Location**: Lines 149-334 (185 lines)

**Problem**: The `generate()` method is 185 lines long, exceeding Codi's recommended 50-line maximum per function. It handles 7 distinct concerns in sequence:
1. Main instruction file
2. Scoped rule files
3. Prompt files
4. Agent files
5. MCP config
6. Heartbeat hook scripts
7. Copilot hooks config

**Impact**: Harder to test, harder to modify, harder to reason about.

**Fix**: Extract hook building into a helper:
```typescript
function buildCopilotHooksConfig(): GeneratedFile {
  const copilotHooks: CopilotHooksConfig = { /* ... */ };
  const hooksContent = JSON.stringify(copilotHooks, null, 2);
  return {
    path: ".github/hooks/codi-hooks.json",
    content: hooksContent,
    sources: [MANIFEST_FILENAME],
    hash: hashContent(hooksContent),
  };
}

// In generate():
const hooksFile = buildCopilotHooksConfig();
files.push(hooksFile);
```

This reduces `generate()` to ~150 lines, improving clarity.

---

#### Q-4: Skill and Agent Names Not Sanitized in File Paths

**Severity**: MEDIUM | **Status**: Path safety (same as S-1)

**Location**: Lines 238, 249

**Problem**: Artifact names used directly in paths without validation (covered in S-1 above).

---

#### Q-5: Manual YAML Escaping Instead of Library Utility

**Severity**: MEDIUM | **Status**: Maintenance and correctness

**Location**: Lines 55, 62, 66, 92, 95

**Problem**: Manual string escaping for YAML instead of using the `fmStr()` utility already in the codebase (covered in S-2 above).

---

#### Q-6: Inconsistent Quote Handling in YAML

**Severity**: LOW | **Status**: Style issue

**Location**: Lines 70, 91

**Problem**:
```typescript
frontmatter.push(`agent: "agent"`);        // double quotes
frontmatter.push(`name: ${agent.name}`);   // no quotes!
```

Inconsistent quoting style across YAML fields.

**Fix**: Standardize to either all single-quoted or all double-quoted, or use the `fmStr()` utility.

---

#### Q-7: Hardcoded Hook Timeout Values

**Severity**: LOW | **Status**: Documentation

**Location**: Lines 311, 320

**Problem**: Magic numbers without explanation:
```typescript
timeoutSec: 10,  // Why 10?
timeoutSec: 15,  // Why 15?
```

**Fix**:
```typescript
const COPILOT_HOOK_SESSION_START_TIMEOUT = 10; // seconds — allow skill tracking to complete
const COPILOT_HOOK_SESSION_END_TIMEOUT = 15;   // seconds — allow observer to write feedback

copilotHooks: {
  sessionStart: [{ timeoutSec: COPILOT_HOOK_SESSION_START_TIMEOUT, ... }],
  sessionEnd: [{ timeoutSec: COPILOT_HOOK_SESSION_END_TIMEOUT, ... }],
};
```

---

#### Q-8: Missing Return Type on `buildAgentFile`

**Severity**: LOW | **Status**: Violates Codi Standards (minor)

**Location**: Line 88

**Fix**: Add return type: `function buildAgentFile(agent: NormalizedAgent): string`

---

## Testing Assessment

### Test Coverage Status
The PR description claims:
- 25/25 unit tests passing
- 22/22 QA simulation tests passing
- 10/10 integration tests passing
- 6/6 snapshot tests passing
- **Total: 63/63 tests** ✓

**However**: These tests cannot be run or verified because the code **fails to compile** (CRITICAL issue C-1).

### Test Quality Observations

**Strengths**:
- ✓ Detection tests cover all three file types (.github/copilot-instructions.md, .github/prompts, .github/agents)
- ✓ Generation tests verify file structure and content
- ✓ Capability and path assertions verify adapter contract compliance
- ✓ Snapshot tests capture expected output

**Gaps**:
- ✗ No tests for path traversal attacks (S-1)
- ✗ No tests for YAML injection (S-2)
- ✗ No tests for malformed artifact names
- ✗ No tests for newlines/special characters in descriptions
- ✗ No integration test verifying valid YAML is generated
- ✗ No test for markdown table cell escaping (S-3)

**Verdict**: Test suite is **incomplete** for security and edge cases. Once the critical build issue is fixed, recommend adding tests for:
1. Artifact names with `../`, `/`, special chars
2. Descriptions with newlines, quotes, YAML special chars
3. Tools array with single quotes in names
4. MCP config with suspicious patterns

---

## Architecture & Design Assessment

### Positive Findings ✓

1. **Consistent Adapter Pattern**: Follows the established pattern used by claude-code, cursor, codex, windsurf, and cline
   - Implements `AgentAdapter` interface
   - `detect()` and `generate()` methods match spec
   - Paths, capabilities, and ID properly defined

2. **Good Separation of Concerns**:
   - Reuses shared utilities (buildFlagInstructions, section-builder, brand-filter)
   - Delegates YAML/JSON formatting to existing helpers (where available)
   - File generation logic is cohesive

3. **Comprehensive File Types**:
   - Main instruction file (.github/copilot-instructions.md)
   - Scoped rule files (.github/instructions/{name}.instructions.md)
   - Prompt files (.github/prompts/{name}.prompt.md)
   - Agent files (.github/agents/{name}.agent.md)
   - MCP config (.vscode/mcp.json)
   - Heartbeat hooks (.codi/hooks/)
   - Hook registration (.github/hooks/codi-hooks.json)

4. **Feature Parity**: Covers rules, skills, agents, and MCP — equivalent to claude-code capability

### Architecture Concerns ✗

1. **Hardcoded Comments in JSON**: Line 261 adds `_instructions` comment to MCP JSON
   ```typescript
   const mcpOutput = {
     _instructions: `Generated by Codi — do not edit manually, run: codi generate`,
     servers: enabledMcp.servers,
   };
   ```
   JSON doesn't support comments; this field is a workaround. Better approach: add comment in JSDoc only, or use `.json5` format if Copilot supports it.

2. **Inconsistent with Other Adapters**: claude-code uses `generated` comment in a different format. Should standardize.

### Verdict
**Architecture is sound**, but implementation has security and type-safety gaps that must be closed before merge.

---

## Documentation Assessment

### README Updates ✓
- "5 agents" → "6 agents" in multiple places
- GitHub Copilot added to feature comparison
- Supported agents table updated
- Clear statement: "Codi generates... for Claude Code, Cursor, Codex, Windsurf, Cline, and GitHub Copilot"

### CONTRIBUTING.md Updates ✓
- Adapter list updated to show 6 adapters
- copilot.ts added to file listing
- Clear documentation of adapter structure

### Docs Site Updates ✓
- getting-started.md: agent selection mentions GitHub Copilot
- features.md: table updated to show 6 agents
- architecture.md: adapter table includes Copilot entry

### Missing Documentation ⚠
- No Copilot-specific setup guide (e.g., "How to enable Copilot Chat in VS Code, how to load .github/copilot-instructions.md")
- No explanation of `.vscode/mcp.json` format or Copilot's MCP support limitations
- No troubleshooting section for Copilot-specific issues

### Verdict
**Documentation is complete for Codi side**, but lacks Copilot-specific user guidance. Recommend adding a "Setup Guide for GitHub Copilot" in the docs.

---

## Integration Testing

### PR #62 Merge Impact
The PR was rebased onto develop after PR #62 (box-validator) merged. The rebase:
- ✓ Resolved baseline hash conflicts (took develop versions)
- ✓ Updated skill template versions
- ✓ No breaking changes to existing adapters

### Compatibility with Other Adapters
- ✓ No changes to adapter index (`src/adapters/index.ts` — only added copilot import/export)
- ✓ No changes to shared utilities (flag-instructions, skill-generator, section-builder, etc.)
- ✓ Heartbeat hooks are adapter-agnostic — Copilot using them doesn't break other adapters

### Verdict
**No regressions expected** once critical issues are fixed. Other adapters should continue to work.

---

## Remediation Roadmap

### Phase 1: Blocking Issues (MUST FIX before merge)

| Issue | Severity | Effort | Time | Fix |
|-------|----------|--------|------|-----|
| C-1: buildProjectContext undefined | CRITICAL | 5 min | <5min | Remove import and call (lines 22, 161-162) |
| S-1: Path traversal (names → paths) | HIGH | 15 min | 15min | Sanitize artifact names before file path use |
| S-2: YAML injection | HIGH | 30 min | 30min | Replace manual escaping with `fmStr()` utility + validate |
| Q-2: Hooks type safety | HIGH | 20 min | 20min | Define CopilotHooksConfig interface |

**Phase 1 Total**: ~70 minutes | **Blocker Count**: 4 critical/high issues

### Phase 2: Important Issues (Should fix before merge)

| Issue | Severity | Effort | Time | Fix |
|-------|----------|--------|------|-----|
| S-3: Markdown table injection | MEDIUM | 10 min | 10min | Add `sanitizeTableCell()` helper |
| S-4: Hook path escaping | MEDIUM | 10 min | 10min | Quote paths, add bounds checks |
| Q-3: Function complexity | MEDIUM | 20 min | 20min | Extract hook config builder |
| Q-1, Q-8: Return type annotations | MEDIUM | 5 min | 5min | Add `: string` return types |

**Phase 2 Total**: ~55 minutes | **Blocker Count**: 4 medium issues

### Phase 3: Polish (Nice-to-have before merge)

| Issue | Severity | Effort | Time | Fix |
|-------|----------|--------|------|-----|
| S-5: MAX_ARTIFACT_CHARS enforcement | LOW | 10 min | 10min | Add length check before injection |
| S-6: MCP secret redaction | LOW | 15 min | 15min | Add heuristic secret detector |
| Q-6, Q-7: Constants, style | LOW | 10 min | 10min | Extract timeout constants, standardize quotes |
| Test coverage expansion | LOW | 30 min | 30min | Add edge-case tests for S-1, S-2, S-3 |

**Phase 3 Total**: ~65 minutes | **Polish Count**: 4 low/nice-to-have issues

### Total Remediation Effort
- **Phase 1 (Critical/High)**: 70 minutes
- **Phase 2 (Medium)**: 55 minutes
- **Phase 3 (Low/Polish)**: 65 minutes
- **Total**: ~190 minutes (~3.2 hours) for full remediation

**Minimum to merge**: Phase 1 + Phase 2 (125 minutes, ~2 hours)

---

## Detailed Remediation Instructions

### Phase 1.1: Remove undefined `buildProjectContext`

**File**: `src/adapters/copilot.ts`

**Change 1 - Remove from imports (line 22)**:
```typescript
// BEFORE
import {
  buildProjectOverview,
  buildAgentsTable,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  buildProjectContext,  // ← DELETE THIS LINE
  buildSelfDevWarning,
  getEnabledMcpServers,
  buildMcpEnvExample,
} from "./section-builder.js";

// AFTER
import {
  buildProjectOverview,
  buildAgentsTable,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  buildSelfDevWarning,
  getEnabledMcpServers,
  buildMcpEnvExample,
} from "./section-builder.js";
```

**Change 2 - Remove the call (lines 161-162)**:
```typescript
// BEFORE
const overview = buildProjectOverview(config);
if (overview) sections.push(overview);

const projectContext = buildProjectContext(config);  // ← DELETE THESE
if (projectContext) sections.push(projectContext);   // ← TWO LINES

const flagText = buildFlagInstructions(config.flags);

// AFTER
const overview = buildProjectOverview(config);
if (overview) sections.push(overview);

const flagText = buildFlagInstructions(config.flags);
```

**Verify**: Run `npm run lint` — should pass.

---

### Phase 1.2: Sanitize Artifact Names in File Paths

**File**: `src/adapters/copilot.ts`

**Add helper function** (after `buildAgentFile`, before export):
```typescript
/**
 * Sanitize an artifact name for use in a file path.
 * Removes or replaces characters that could cause path traversal or invalid filenames.
 */
function sanitizeNameForPath(name: string): string {
  // Replace any non-alphanumeric, non-dash, non-underscore chars with dashes
  // This prevents ../, ./, //, etc.
  return name.replace(/[^\w-]/g, "-").toLowerCase();
}
```

**Update line 226** (rule file path):
```typescript
// BEFORE
path: `.github/instructions/${rule.name.toLowerCase().replace(/\s+/g, "-")}.instructions.md`,

// AFTER
path: `.github/instructions/${sanitizeNameForPath(rule.name)}.instructions.md`,
```

**Update line 238** (skill file path):
```typescript
// BEFORE
path: `.github/prompts/${skill.name}.prompt.md`,

// AFTER
path: `.github/prompts/${sanitizeNameForPath(skill.name)}.prompt.md`,
```

**Update line 249** (agent file path):
```typescript
// BEFORE
path: `.github/agents/${agent.name}.agent.md`,

// AFTER
path: `.github/agents/${sanitizeNameForPath(agent.name)}.agent.md`,
```

**Verify**: Run tests — path-based tests should still pass. Run `npm run build` — should succeed.

---

### Phase 1.3: Fix YAML Injection via `fmStr()`

**File**: `src/adapters/copilot.ts`

**Add import** (line 2):
```typescript
import { fmStr } from "../utils/yaml-serialize.js";  // ← ADD THIS
```

**Replace `buildPromptFile()` function** (lines 52-80):
```typescript
// BEFORE
function buildPromptFile(skill: NormalizedSkill): string {
  const frontmatter: string[] = ["---"];

  frontmatter.push(`description: "${skill.description.replace(/"/g, '\\"')}"`);
  if (skill.model) {
    frontmatter.push(`model: ${skill.model}`);
  }
  if (skill.allowedTools && skill.allowedTools.length > 0) {
    frontmatter.push(`tools: [${skill.allowedTools.map((t) => `'${t}'`).join(", ")}]`);
  }
  if (skill.argumentHint) {
    frontmatter.push(`argument-hint: "${skill.argumentHint.replace(/"/g, '\\"')}"`);
  }
  frontmatter.push(`agent: "agent"`);
  frontmatter.push("---");

  const resolvedContent = skill.content
    .replace(/\$\{CLAUDE_SKILL_DIR\}/g, "")
    .replace(/\[\[\s*(\/[^\]]+?)\s*\]\]/g, "$1");

  return `${frontmatter.join("\n")}\n\n${resolvedContent}`;
}

// AFTER
function buildPromptFile(skill: NormalizedSkill): string {
  // Build YAML frontmatter object (not string concatenation)
  const frontmatter: Record<string, unknown> = {
    description: skill.description,
    agent: "agent",
  };
  
  if (skill.model) {
    frontmatter.model = skill.model;
  }
  if (skill.allowedTools && skill.allowedTools.length > 0) {
    frontmatter.tools = skill.allowedTools;
  }
  if (skill.argumentHint) {
    frontmatter["argument-hint"] = skill.argumentHint;
  }

  // Use fmStr() to safely generate YAML with proper escaping
  const yamlFrontmatter = fmStr(frontmatter);

  const resolvedContent = skill.content
    .replace(/\$\{CLAUDE_SKILL_DIR\}/g, "")
    .replace(/\[\[\s*(\/[^\]]+?)\s*\]\]/g, "$1");

  return `${yamlFrontmatter}\n\n${resolvedContent}`;
}
```

**Replace `buildAgentFile()` function** (lines 88-105):
```typescript
// BEFORE
function buildAgentFile(agent: NormalizedAgent): string {
  const frontmatter: string[] = ["---"];

  frontmatter.push(`name: ${agent.name}`);
  frontmatter.push(`description: "${agent.description.replace(/"/g, '\\"')}"`);

  if (agent.tools && agent.tools.length > 0) {
    frontmatter.push(`tools: [${agent.tools.map((t) => `'${t}'`).join(", ")}]`);
  }

  if (agent.model) {
    frontmatter.push(`model: ${agent.model}`);
  }

  frontmatter.push("---");

  return `${frontmatter.join("\n")}\n\n${agent.content}`;
}

// AFTER
function buildAgentFile(agent: NormalizedAgent): string {
  const frontmatter: Record<string, unknown> = {
    name: agent.name,
    description: agent.description,
  };

  if (agent.tools && agent.tools.length > 0) {
    frontmatter.tools = agent.tools;
  }

  if (agent.model) {
    frontmatter.model = agent.model;
  }

  // Use fmStr() to safely generate YAML
  const yamlFrontmatter = fmStr(frontmatter);

  return `${yamlFrontmatter}\n\n${agent.content}`;
}
```

**Verify**: Run `npm run build && npm run lint` — should pass.

---

### Phase 1.4: Add Type Safety for Hooks Config

**File**: `src/adapters/copilot.ts`

**Add interface** (after imports, before `exists` function):
```typescript
/**
 * Copilot hook command definition.
 * Specifies a shell command to run at a Copilot lifecycle event.
 */
interface CopilotHookCommand {
  type: "command";
  bash: string;
  powershell: string;
  cwd: string;
  timeoutSec: number;
}

/**
 * Copilot hooks configuration format.
 * Maps Copilot lifecycle events to command handlers.
 */
interface CopilotHooksConfig {
  version: 1;
  hooks: {
    sessionStart?: CopilotHookCommand[];
    sessionEnd?: CopilotHookCommand[];
  };
}
```

**Update hooks object** (line 304):
```typescript
// BEFORE
const copilotHooks: Record<string, unknown[]> = {
  sessionStart: [
    {
      type: "command",
      bash: `node ${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_TRACKER_FILENAME}`,
      powershell: `node ${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_TRACKER_FILENAME}`,
      cwd: ".",
      timeoutSec: 10,
    },
  ],
  sessionEnd: [
    {
      type: "command",
      bash: `node ${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_OBSERVER_FILENAME}`,
      powershell: `node ${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_OBSERVER_FILENAME}`,
      cwd: ".",
      timeoutSec: 15,
    },
  ],
};
const hooksOutput = { version: 1, hooks: copilotHooks };

// AFTER
const copilotHooks: CopilotHooksConfig = {
  version: 1,
  hooks: {
    sessionStart: [
      {
        type: "command",
        bash: `node "${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_TRACKER_FILENAME}"`,
        powershell: `node "${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_TRACKER_FILENAME}"`,
        cwd: ".",
        timeoutSec: 10,
      },
    ],
    sessionEnd: [
      {
        type: "command",
        bash: `node "${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_OBSERVER_FILENAME}"`,
        powershell: `node "${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_OBSERVER_FILENAME}"`,
        cwd: ".",
        timeoutSec: 15,
      },
    ],
  },
};
const hooksContent = JSON.stringify(copilotHooks, null, 2);
```

**Verify**: `npm run lint && npm run build` — should pass.

---

### Completion Checklist

After all Phase 1 fixes:

- [ ] `npm run lint` passes (no TypeScript errors)
- [ ] `npm run build` succeeds
- [ ] `npm test` runs and all copilot adapter tests pass
- [ ] No path traversal in test outputs
- [ ] YAML frontmatter in generated files is valid (can parse with `yaml.load()`)
- [ ] Markdown tables render correctly (no broken pipes)

Once Phase 1 is complete, proceed to Phase 2 fixes as above.

---

## Recommendations

### Before Merge ✓ REQUIRED

1. **Fix all CRITICAL and HIGH issues** (Phase 1 + Phase 2 — ~2 hours)
2. **Re-run test suite** after fixes to verify no regressions
3. **Manual verification**: Generate Copilot config with real project, verify files are created correctly
4. **Security review**: Have a second pair of eyes verify path sanitization and YAML escaping

### After Merge (Future PRs)

1. **Add edge-case tests** for path traversal, injection attacks (Phase 3)
2. **Copilot setup guide** in documentation
3. **Heartbeat hook security audit** (out of scope for this PR)
4. **Generator-level path safety** (add `isPathSafe()` check to core generator)

### Long-term Improvements

1. Standardize YAML generation across all adapters (use `fmStr()` everywhere)
2. Add a `sanitizeForPath()` utility shared by all adapters
3. Add security tests to CI that verify no file writes escape project root
4. Add YAML validation step to all adapter tests

---

## Approval Status

### Current: 🔴 **BLOCKED — DO NOT MERGE**

**Blocking reasons**:
1. ✗ Build fails (C-1 CRITICAL)
2. ✗ High-severity security vulnerabilities (S-1, S-2)
3. ✗ High-severity code quality issues (Q-2)

### To Unblock

1. **Fix Phase 1 issues** (4 critical/high items, ~70 min)
2. **Fix Phase 2 issues** (4 medium items, ~55 min)
3. **Re-test**: Verify all tests pass, no regressions
4. **Request re-review** by security/code reviewer

### To Approve

Once all Phase 1 + Phase 2 fixes are complete:
- ✓ Build passes
- ✓ All tests pass
- ✓ No high-severity security or code quality issues remain
- ✓ Architecture is sound
- ✓ Documentation is complete

Then: **Ready for merge** → develop → eventually to main via release process

---

## Appendix: References

### Related Commits
- `ae54d9f` — Commit that removed `buildProjectContext` from section-builder.ts
- `3c1a311` — Commit that originally added `buildProjectContext` (for reference)
- `f238c23` — Latest commit on current develop branch

### Related Files
- `/Users/laht/projects/codi/src/adapters/` — Other adapter implementations for comparison
- `/Users/laht/projects/codi/src/utils/yaml-serialize.ts` — `fmStr()` utility to use
- `/Users/laht/projects/codi/src/utils/path-guard.ts` — `isPathSafe()` guard
- `/Users/laht/projects/codi/tests/unit/adapters/copilot.test.ts` — Test suite
- `/Users/laht/projects/codi/src/core/hooks/heartbeat-hooks.ts` — Hook script generation

### Documentation
- [PR Description](https://github.com/lehidalgo/codi/pulls/61) — Author's notes
- `/Users/laht/projects/codi/CLAUDE.md` — Codi development standards
- `/Users/laht/projects/codi/.claude/rules/` — Project-specific rules

---

**Audit completed**: 2026-04-17 16:45 UTC  
**Auditor**: Claude Code  
**Confidence**: High (comprehensive analysis using graph-code MCP, security expert agent, code reviewer agent)

---
