/**
 * Content security scanner for imported skills and presets.
 *
 * Scans markdown, code, and binary files for prompt injection,
 * malicious scripts, data exfiltration, and disguised executables.
 */

import { readdir, readFile, stat, access } from "node:fs/promises";
import { join, relative, extname, basename } from "node:path";
import {
  INJECTION_PATTERNS,
  SCRIPT_PATTERNS,
  EXFIL_PATTERNS,
  DEPENDENCY_PATTERNS,
  MAGIC_BYTES,
  EXECUTABLE_SIGNATURES,
} from "./scan-patterns.js";
import type { ScanSeverity, PatternDef } from "./scan-patterns.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanFinding {
  severity: ScanSeverity;
  category: string;
  file: string;
  line?: number;
  pattern: string;
  description: string;
}

export interface ScanReport {
  target: string;
  scannedAt: string;
  filesScanned: number;
  verdict: ScanSeverity | "pass";
  findings: ScanFinding[];
  summary: Record<ScanSeverity, number>;
}

interface FileInfo {
  path: string;
  relativePath: string;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 1_048_576; // 1 MB warn
const MAX_FILE_BYTES_BLOCK = 10_485_760; // 10 MB block
const MAX_DIR_BYTES = 10_485_760; // 10 MB total warn
const MAX_DIR_BYTES_BLOCK = 52_428_800; // 50 MB total block

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".py",
  ".sh",
  ".bash",
  ".js",
  ".ts",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".html",
  ".css",
  ".csv",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".r",
  ".sql",
  ".lua",
  ".pl",
]);

const CODE_EXTENSIONS = new Set([
  ".py",
  ".sh",
  ".bash",
  ".js",
  ".ts",
  ".mjs",
  ".rb",
  ".pl",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".mp3",
  ".mp4",
  ".wav",
  ".avi",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip content inside markdown code fences to avoid false positives
 * on documentation that discusses dangerous patterns as examples.
 */
export function stripCodeFences(content: string): string {
  return content.replace(/```[\s\S]*?```/g, "");
}

async function collectFiles(dir: string, root: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, root)));
    } else {
      try {
        const s = await stat(fullPath);
        files.push({
          path: fullPath,
          relativePath: relative(root, fullPath),
          sizeBytes: s.size,
        });
      } catch {
        // Skip unreadable files
      }
    }
  }
  return files;
}

export function matchPatterns(
  content: string,
  filePath: string,
  patterns: PatternDef[],
  category: string,
  shouldStripFences: boolean,
): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const scanContent = shouldStripFences ? stripCodeFences(content) : content;
  const lines = scanContent.split("\n");

  for (const def of patterns) {
    for (let i = 0; i < lines.length; i++) {
      if (def.pattern.test(lines[i]!)) {
        findings.push({
          severity: def.severity,
          category,
          file: filePath,
          line: i + 1,
          pattern: def.pattern.source.slice(0, 60),
          description: def.description,
        });
        break; // One finding per pattern per file
      }
    }
  }
  return findings;
}

function computeVerdict(
  summary: Record<ScanSeverity, number>,
): ScanSeverity | "pass" {
  if (summary.critical > 0) return "critical";
  if (summary.high > 0) return "high";
  if (summary.medium > 0) return "medium";
  if (summary.low > 0) return "low";
  return "pass";
}

function computeSummary(findings: ScanFinding[]): Record<ScanSeverity, number> {
  const summary: Record<ScanSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const f of findings) summary[f.severity]++;
  return summary;
}

// ---------------------------------------------------------------------------
// File Type Validation
// ---------------------------------------------------------------------------

export async function validateFileType(
  filePath: string,
): Promise<ScanFinding | null> {
  const ext = extname(filePath).toLowerCase();

  let header: Buffer;
  try {
    const data = await readFile(filePath);
    header = Buffer.from(data.buffer, 0, Math.min(8, data.length));
  } catch {
    return null;
  }

  // Check for executables regardless of extension
  for (const sig of EXECUTABLE_SIGNATURES) {
    if (header.length >= sig.bytes.length) {
      const match = sig.bytes.every((b, i) => header[i] === b);
      if (match) {
        return {
          severity: "critical",
          category: "file_type_mismatch",
          file: filePath,
          pattern: `magic_bytes:${sig.name}`,
          description: `File is a ${sig.name} — executables must not be included`,
        };
      }
    }
  }

  // Check if known binary extension matches its magic bytes
  const expected = MAGIC_BYTES[ext];
  if (expected && header.length >= expected.bytes.length) {
    const match = expected.bytes.every((b, i) => header[i] === b);
    if (!match) {
      return {
        severity: "high",
        category: "file_type_mismatch",
        file: filePath,
        pattern: `expected_${expected.name}_magic`,
        description: `File has ${ext} extension but does not match ${expected.name} magic bytes — possible disguised file`,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Content Size Checks
// ---------------------------------------------------------------------------

function checkContentSizes(files: FileInfo[]): ScanFinding[] {
  const findings: ScanFinding[] = [];
  let totalBytes = 0;

  for (const file of files) {
    totalBytes += file.sizeBytes;
    if (file.sizeBytes > MAX_FILE_BYTES_BLOCK) {
      findings.push({
        severity: "high",
        category: "content_size",
        file: file.relativePath,
        pattern: "file_too_large_block",
        description: `File is ${(file.sizeBytes / 1_048_576).toFixed(1)} MB (max ${MAX_FILE_BYTES_BLOCK / 1_048_576} MB)`,
      });
    } else if (file.sizeBytes > MAX_FILE_BYTES) {
      findings.push({
        severity: "medium",
        category: "content_size",
        file: file.relativePath,
        pattern: "file_too_large_warn",
        description: `File is ${(file.sizeBytes / 1_048_576).toFixed(1)} MB (recommended max ${MAX_FILE_BYTES / 1_048_576} MB)`,
      });
    }
  }

  if (totalBytes > MAX_DIR_BYTES_BLOCK) {
    findings.push({
      severity: "high",
      category: "content_size",
      file: ".",
      pattern: "dir_too_large_block",
      description: `Total size is ${(totalBytes / 1_048_576).toFixed(1)} MB (max ${MAX_DIR_BYTES_BLOCK / 1_048_576} MB)`,
    });
  } else if (totalBytes > MAX_DIR_BYTES) {
    findings.push({
      severity: "medium",
      category: "content_size",
      file: ".",
      pattern: "dir_too_large_warn",
      description: `Total size is ${(totalBytes / 1_048_576).toFixed(1)} MB (recommended max ${MAX_DIR_BYTES / 1_048_576} MB)`,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Public API: Scan a directory
// ---------------------------------------------------------------------------

export async function scanDirectory(dir: string): Promise<ScanReport> {
  const findings: ScanFinding[] = [];

  try {
    await access(dir);
  } catch {
    const summary = { critical: 1, high: 0, medium: 0, low: 0 };
    return {
      target: dir,
      scannedAt: new Date().toISOString(),
      filesScanned: 0,
      verdict: "critical",
      findings: [
        {
          severity: "critical",
          category: "content_size",
          file: dir,
          pattern: "dir_not_found",
          description: `Directory not found: ${dir}`,
        },
      ],
      summary,
    };
  }

  const files = await collectFiles(dir, dir);
  findings.push(...checkContentSizes(files));

  for (const file of files) {
    const ext = extname(file.path).toLowerCase();

    if (BINARY_EXTENSIONS.has(ext) || !TEXT_EXTENSIONS.has(ext)) {
      const ftFinding = await validateFileType(file.path);
      if (ftFinding) {
        ftFinding.file = file.relativePath;
        findings.push(ftFinding);
      }
      continue;
    }

    let content: string;
    try {
      content = await readFile(file.path, "utf-8");
    } catch {
      continue;
    }

    // Prompt injection + exfiltration on markdown
    if (ext === ".md") {
      findings.push(
        ...matchPatterns(
          content,
          file.relativePath,
          INJECTION_PATTERNS,
          "prompt_injection",
          true,
        ),
      );
      findings.push(
        ...matchPatterns(
          content,
          file.relativePath,
          EXFIL_PATTERNS,
          "data_exfiltration",
          false,
        ),
      );
    }

    // Script + exfiltration on code files
    if (CODE_EXTENSIONS.has(ext)) {
      findings.push(
        ...matchPatterns(
          content,
          file.relativePath,
          SCRIPT_PATTERNS,
          "malicious_script",
          false,
        ),
      );
      findings.push(
        ...matchPatterns(
          content,
          file.relativePath,
          EXFIL_PATTERNS,
          "data_exfiltration",
          false,
        ),
      );
      findings.push(
        ...matchPatterns(
          content,
          file.relativePath,
          DEPENDENCY_PATTERNS,
          "suspicious_dependency",
          false,
        ),
      );
    }
  }

  const summary = computeSummary(findings);
  return {
    target: dir,
    scannedAt: new Date().toISOString(),
    filesScanned: files.length,
    verdict: computeVerdict(summary),
    findings,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Public API: Scan a single skill file
// ---------------------------------------------------------------------------

export function scanSkillFile(filePath: string, content: string): ScanReport {
  const findings: ScanFinding[] = [];
  const fileSize = Buffer.byteLength(content, "utf-8");
  const fileName = basename(filePath);

  // Size check
  if (fileSize > MAX_FILE_BYTES_BLOCK) {
    findings.push({
      severity: "high",
      category: "content_size",
      file: fileName,
      pattern: "file_too_large_block",
      description: `File is ${(fileSize / 1_048_576).toFixed(1)} MB (max ${MAX_FILE_BYTES_BLOCK / 1_048_576} MB)`,
    });
  } else if (fileSize > MAX_FILE_BYTES) {
    findings.push({
      severity: "medium",
      category: "content_size",
      file: fileName,
      pattern: "file_too_large_warn",
      description: `File is ${(fileSize / 1_048_576).toFixed(1)} MB (recommended max ${MAX_FILE_BYTES / 1_048_576} MB)`,
    });
  }

  // Prompt injection
  findings.push(
    ...matchPatterns(
      content,
      fileName,
      INJECTION_PATTERNS,
      "prompt_injection",
      true,
    ),
  );

  // Data exfiltration
  findings.push(
    ...matchPatterns(
      content,
      fileName,
      EXFIL_PATTERNS,
      "data_exfiltration",
      false,
    ),
  );

  // Malicious scripts (markdown can contain shell commands)
  findings.push(
    ...matchPatterns(
      content,
      fileName,
      SCRIPT_PATTERNS,
      "malicious_script",
      false,
    ),
  );

  // Dependency patterns
  findings.push(
    ...matchPatterns(
      content,
      fileName,
      DEPENDENCY_PATTERNS,
      "suspicious_dependency",
      false,
    ),
  );

  const summary = computeSummary(findings);
  return {
    target: filePath,
    scannedAt: new Date().toISOString(),
    filesScanned: 1,
    verdict: computeVerdict(summary),
    findings,
    summary,
  };
}
