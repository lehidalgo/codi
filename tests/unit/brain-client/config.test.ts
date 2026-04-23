import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resolveBrainConfig } from "#src/brain-client/config.js";

describe("resolveBrainConfig", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-brain-cfg-"));
    delete process.env.BRAIN_URL;
    delete process.env.BRAIN_BEARER_TOKEN;
    delete process.env.BRAIN_AUTO_EXTRACT;
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
    delete process.env.BRAIN_URL;
    delete process.env.BRAIN_BEARER_TOKEN;
    delete process.env.BRAIN_AUTO_EXTRACT;
  });

  it("uses defaults when nothing configured", async () => {
    const cfg = await resolveBrainConfig({ projectRoot: tmp, homeDir: tmp });
    expect(cfg.url).toBe("http://127.0.0.1:8000");
    expect(cfg.token).toBeNull();
    expect(cfg.autoExtract).toBe(false);
    expect(cfg.autoExtractModel).toBe("gemini-2.5-flash");
    expect(cfg.autoExtractConfidenceThreshold).toBe(0.8);
  });

  it("env wins over yaml", async () => {
    await fs.mkdir(path.join(tmp, ".codi"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, ".codi/config.yaml"),
      "brain:\n  url: http://yaml.example\n  bearer_token: yaml-token\n",
    );
    process.env.BRAIN_URL = "http://env.example";
    process.env.BRAIN_BEARER_TOKEN = "env-token";
    const cfg = await resolveBrainConfig({ projectRoot: tmp, homeDir: tmp });
    expect(cfg.url).toBe("http://env.example");
    expect(cfg.token).toBe("env-token");
  });

  it("project yaml wins over user-global", async () => {
    await fs.mkdir(path.join(tmp, ".codi"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, ".codi/config.yaml"),
      "brain:\n  url: http://project.example\n",
    );
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "codi-brain-home-"));
    try {
      await fs.mkdir(path.join(home, ".codi"), { recursive: true });
      await fs.writeFile(
        path.join(home, ".codi/config.yaml"),
        "brain:\n  url: http://user.example\n",
      );
      const cfg = await resolveBrainConfig({ projectRoot: tmp, homeDir: home });
      expect(cfg.url).toBe("http://project.example");
    } finally {
      await fs.rm(home, { recursive: true, force: true });
    }
  });

  it("malformed yaml falls back to defaults with warning", async () => {
    await fs.mkdir(path.join(tmp, ".codi"), { recursive: true });
    await fs.writeFile(path.join(tmp, ".codi/config.yaml"), "brain: [unclosed");
    // Use a separate empty home so only the project config fires the warning.
    const emptyHome = await fs.mkdtemp(path.join(os.tmpdir(), "codi-cfg-home-"));
    const warnings: string[] = [];
    try {
      const cfg = await resolveBrainConfig({
        projectRoot: tmp,
        homeDir: emptyHome,
        onWarn: (m) => warnings.push(m),
      });
      expect(cfg.url).toBe("http://127.0.0.1:8000");
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("brain config");
    } finally {
      await fs.rm(emptyHome, { recursive: true, force: true });
    }
  });

  it("auto_extract settings from yaml", async () => {
    await fs.mkdir(path.join(tmp, ".codi"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, ".codi/config.yaml"),
      "brain:\n  auto_extract: true\n  auto_extract_confidence_threshold: 0.9\n  auto_extract_model: gemini-pro\n",
    );
    const cfg = await resolveBrainConfig({ projectRoot: tmp, homeDir: tmp });
    expect(cfg.autoExtract).toBe(true);
    expect(cfg.autoExtractConfidenceThreshold).toBe(0.9);
    expect(cfg.autoExtractModel).toBe("gemini-pro");
  });

  it("GEMINI_API_KEY env overrides yaml gemini_api_key", async () => {
    await fs.mkdir(path.join(tmp, ".codi"), { recursive: true });
    await fs.writeFile(path.join(tmp, ".codi/config.yaml"), "brain:\n  gemini_api_key: yaml-key\n");
    process.env.GEMINI_API_KEY = "env-key";
    try {
      const cfg = await resolveBrainConfig({ projectRoot: tmp, homeDir: tmp });
      expect(cfg.geminiApiKey).toBe("env-key");
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });
});
