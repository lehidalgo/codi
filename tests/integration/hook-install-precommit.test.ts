import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { installHooks } from "#src/core/hooks/hook-installer.js";
import { generateHooksConfig } from "#src/core/hooks/hook-config-generator.js";
import type { ResolvedFlags } from "#src/types/flags.js";

async function makeRepo(extra: Record<string, string> = {}): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "codi-pc-"));
  await mkdir(path.join(dir, ".git"), { recursive: true });
  await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");
  for (const [rel, content] of Object.entries(extra)) {
    const full = path.join(dir, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  return dir;
}

const minimalFlags: ResolvedFlags = {
  security_scan: { value: true, mode: "enabled" },
  type_checking: { value: "strict", mode: "enabled" },
  python_type_checker: { value: "basedpyright", mode: "enabled" },
  js_format_lint: { value: "eslint-prettier", mode: "enabled" },
  commit_type_check: { value: "off", mode: "enabled" },
  commit_test_run: { value: "off", mode: "enabled" },
} as unknown as ResolvedFlags;

describe("installHooks for pre-commit framework runner — polyglot", () => {
  it("produces a valid YAML with managed entries for TS+Python", async () => {
    const root = await makeRepo({
      "package.json": '{"name":"app"}',
      "pyproject.toml": '[project]\nname = "x"\ndependencies = ["fastapi"]\n',
      "tsconfig.json": "{}",
    });
    const cfg = generateHooksConfig(minimalFlags, ["typescript", "python"]);
    const result = await installHooks({
      projectRoot: root,
      runner: "pre-commit",
      hooks: cfg.hooks,
      flags: minimalFlags,
      secretScan: cfg.secretScan,
      fileSizeCheck: cfg.fileSizeCheck,
      stagedJunkCheck: cfg.stagedJunkCheck,
      commitMsgValidation: cfg.commitMsgValidation,
      importDepthCheck: cfg.importDepthCheck,
      docNamingCheck: cfg.docNamingCheck,
    });
    expect(result.ok).toBe(true);
    const yaml = await readFile(path.join(root, ".pre-commit-config.yaml"), "utf-8");
    expect(yaml).toMatch(/repos:/);
    expect(yaml).toMatch(/managed by codi/);
    expect(yaml).toMatch(/astral-sh\/ruff-pre-commit/);
    expect(yaml).toMatch(/gitleaks/);
    expect(yaml).toMatch(/default_install_hook_types/);
    expect(yaml).toMatch(/exclude:/);
    // basedpyright is the resolved python_type_checker — the others must be filtered out
    expect(yaml).toMatch(/basedpyright/);
    expect(yaml).not.toMatch(/mirrors-mypy/);
  });

  it("migrates a file with the legacy text-marker block (commit 1 layout)", async () => {
    const broken = [
      "repos:",
      "  - repo: https://github.com/external/tool",
      "    rev: v1.0.0",
      "  # Codi hooks: BEGIN (auto-generated — do not edit between markers)",
      "  - repo: local",
      "    hooks:",
      "      - id: codi-staged-junk-check",
      "        entry: node .git/hooks/codi-staged-junk-check.mjs",
      "  # Codi hooks: END",
      "",
    ].join("\n");
    const root = await makeRepo({ ".pre-commit-config.yaml": broken });
    const cfg = generateHooksConfig(minimalFlags, ["typescript"]);
    const result = await installHooks({
      projectRoot: root,
      runner: "pre-commit",
      hooks: cfg.hooks,
      flags: minimalFlags,
      secretScan: cfg.secretScan,
      stagedJunkCheck: cfg.stagedJunkCheck,
      commitMsgValidation: cfg.commitMsgValidation,
    });
    expect(result.ok).toBe(true);
    const yaml = await readFile(path.join(root, ".pre-commit-config.yaml"), "utf-8");
    expect(yaml).not.toMatch(/Codi hooks: BEGIN/);
    expect(yaml).toMatch(/external\/tool/);
    expect(yaml).toMatch(/managed by codi/);
  });

  it("preserves user-pinned rev across regeneration", async () => {
    const root = await makeRepo();
    const cfg = generateHooksConfig(minimalFlags, ["python"]);
    await installHooks({
      projectRoot: root,
      runner: "pre-commit",
      hooks: cfg.hooks,
      flags: minimalFlags,
    });
    const first = await readFile(path.join(root, ".pre-commit-config.yaml"), "utf-8");
    // Simulate the user manually pinning ruff to an older rev
    const userEdited = first.replace(/rev: v0\.15\.\d+/g, "rev: v0.15.5");
    await writeFile(path.join(root, ".pre-commit-config.yaml"), userEdited);

    await installHooks({
      projectRoot: root,
      runner: "pre-commit",
      hooks: cfg.hooks,
      flags: minimalFlags,
    });
    const second = await readFile(path.join(root, ".pre-commit-config.yaml"), "utf-8");
    expect(second).toMatch(/rev: v0\.15\.5/);
  });

  it("backs up malformed YAML before regenerating", async () => {
    const root = await makeRepo({
      ".pre-commit-config.yaml": ": :: not yaml :::\n  - foo\n bar baz",
    });
    const cfg = generateHooksConfig(minimalFlags, ["python"]);
    const result = await installHooks({
      projectRoot: root,
      runner: "pre-commit",
      hooks: cfg.hooks,
      flags: minimalFlags,
    });
    expect(result.ok).toBe(true);
    const backup = await readFile(path.join(root, ".pre-commit-config.yaml.codi-backup"), "utf-8");
    expect(backup).toMatch(/not yaml/);
    const fresh = await readFile(path.join(root, ".pre-commit-config.yaml"), "utf-8");
    expect(fresh).toMatch(/repos:/);
    expect(fresh).toMatch(/astral-sh\/ruff-pre-commit/);
  });
});
