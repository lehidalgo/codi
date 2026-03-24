import fs from 'node:fs/promises';
import path from 'node:path';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';
import { hashContent } from '../../utils/hash.js';
import { STATE_FILENAME } from '../../constants.js';

export interface GeneratedFileState {
  path: string;
  sourceHash: string;
  generatedHash: string;
  sources: string[];
  timestamp: string;
}

export interface StateData {
  version: '1';
  lastGenerated: string;
  agents: Record<string, GeneratedFileState[]>;
}

export interface DriftFile {
  path: string;
  status: 'synced' | 'drifted' | 'missing';
  expectedHash?: string;
  currentHash?: string;
}

export interface DriftReport {
  agentId: string;
  files: DriftFile[];
}

const EMPTY_STATE: StateData = {
  version: '1',
  lastGenerated: new Date().toISOString(),
  agents: {},
};

export class StateManager {
  private readonly statePath: string;
  private readonly projectRoot: string;

  constructor(codiDir: string, projectRoot?: string) {
    this.statePath = path.join(codiDir, STATE_FILENAME);
    this.projectRoot = projectRoot ?? path.dirname(codiDir);
  }

  async read(): Promise<Result<StateData>> {
    try {
      const raw = await fs.readFile(this.statePath, 'utf8');
      const parsed = JSON.parse(raw) as StateData;
      return ok(parsed);
    } catch (cause) {
      if (isNodeError(cause) && cause.code === 'ENOENT') {
        return ok(structuredClone(EMPTY_STATE));
      }
      return err([createError('E_CONFIG_PARSE_FAILED', {
        file: this.statePath,
      }, cause as Error)]);
    }
  }

  async write(state: StateData): Promise<Result<void>> {
    try {
      const dir = path.dirname(this.statePath);
      await fs.mkdir(dir, { recursive: true });
      const tmpPath = `${this.statePath}.tmp.${Date.now()}`;
      await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf8');
      await fs.rename(tmpPath, this.statePath);
      return ok(undefined);
    } catch (cause) {
      return err([createError('E_CONFIG_PARSE_FAILED', {
        file: this.statePath,
      }, cause as Error)]);
    }
  }

  async updateAgent(agentId: string, files: GeneratedFileState[]): Promise<Result<void>> {
    const stateResult = await this.read();
    if (!stateResult.ok) return stateResult;

    const state = stateResult.data;
    state.agents[agentId] = files;
    state.lastGenerated = new Date().toISOString();
    return this.write(state);
  }

  async getAgentFiles(agentId: string): Promise<Result<GeneratedFileState[]>> {
    const stateResult = await this.read();
    if (!stateResult.ok) return stateResult;
    return ok(stateResult.data.agents[agentId] ?? []);
  }

  async detectDrift(agentId: string): Promise<Result<DriftReport>> {
    const filesResult = await this.getAgentFiles(agentId);
    if (!filesResult.ok) return filesResult;

    const storedFiles = filesResult.data;
    const driftFiles: DriftFile[] = [];

    for (const stored of storedFiles) {
      try {
        const fullPath = path.resolve(this.projectRoot, stored.path);
        const content = await fs.readFile(fullPath, 'utf8');
        const currentHash = hashContent(content);
        if (currentHash === stored.generatedHash) {
          driftFiles.push({ path: stored.path, status: 'synced' });
        } else {
          driftFiles.push({
            path: stored.path,
            status: 'drifted',
            expectedHash: stored.generatedHash,
            currentHash,
          });
        }
      } catch {
        driftFiles.push({ path: stored.path, status: 'missing' });
      }
    }

    return ok({ agentId, files: driftFiles });
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
