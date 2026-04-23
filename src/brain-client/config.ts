import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

export interface BrainClientConfig {
  url: string;
  token: string | null;
  autoExtract: boolean;
  autoExtractModel: string;
  autoExtractConfidenceThreshold: number;
  geminiApiKey: string | null;
}

export interface ResolveOptions {
  projectRoot: string;
  homeDir: string;
  onWarn?: (message: string) => void;
}

const DEFAULTS: BrainClientConfig = {
  url: "http://127.0.0.1:8000",
  token: null,
  autoExtract: false,
  autoExtractModel: "gemini-2.5-flash",
  autoExtractConfidenceThreshold: 0.8,
  geminiApiKey: null,
};

interface YamlShape {
  brain?: {
    url?: string;
    bearer_token?: string;
    auto_extract?: boolean;
    auto_extract_model?: string;
    auto_extract_confidence_threshold?: number;
    gemini_api_key?: string;
  };
}

async function readYaml(filePath: string, onWarn?: (m: string) => void): Promise<YamlShape | null> {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    return YAML.parse(text) as YamlShape;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return null;
    onWarn?.(`WARN brain config parse error at ${filePath}: ${err.message}`);
    return null;
  }
}

function applyYaml(cfg: BrainClientConfig, yaml: YamlShape | null): BrainClientConfig {
  if (!yaml?.brain) return cfg;
  const b = yaml.brain;
  return {
    ...cfg,
    ...(b.url !== undefined && { url: b.url }),
    ...(b.bearer_token !== undefined && { token: b.bearer_token }),
    ...(b.auto_extract !== undefined && { autoExtract: b.auto_extract }),
    ...(b.auto_extract_model !== undefined && {
      autoExtractModel: b.auto_extract_model,
    }),
    ...(b.auto_extract_confidence_threshold !== undefined && {
      autoExtractConfidenceThreshold: b.auto_extract_confidence_threshold,
    }),
    ...(b.gemini_api_key !== undefined && { geminiApiKey: b.gemini_api_key }),
  };
}

export async function resolveBrainConfig(opts: ResolveOptions): Promise<BrainClientConfig> {
  let cfg: BrainClientConfig = { ...DEFAULTS };

  // 3. User-global yaml (lowest non-default precedence)
  const userYaml = await readYaml(path.join(opts.homeDir, ".codi/config.yaml"), opts.onWarn);
  cfg = applyYaml(cfg, userYaml);

  // 2. Project yaml (overrides user-global)
  const projYaml = await readYaml(path.join(opts.projectRoot, ".codi/config.yaml"), opts.onWarn);
  cfg = applyYaml(cfg, projYaml);

  // 1. Env (highest precedence)
  if (process.env.BRAIN_URL) cfg.url = process.env.BRAIN_URL;
  if (process.env.BRAIN_BEARER_TOKEN) cfg.token = process.env.BRAIN_BEARER_TOKEN;
  if (process.env.BRAIN_AUTO_EXTRACT === "true") cfg.autoExtract = true;
  if (process.env.BRAIN_AUTO_EXTRACT === "false") cfg.autoExtract = false;
  if (process.env.GEMINI_API_KEY) cfg.geminiApiKey = process.env.GEMINI_API_KEY;

  return cfg;
}
