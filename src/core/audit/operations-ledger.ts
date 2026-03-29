import fs from 'node:fs/promises';
import path from 'node:path';
import { OPERATIONS_LEDGER_FILENAME } from '../../constants.js';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';

// ── Interfaces ──────────────────────────────────────────────────────

export interface LedgerInitialization {
  timestamp: string;
  preset: string;
  agents: string[];
  stack: string[];
  codiVersion: string;
}

export interface LedgerActivePreset {
  name: string;
  installedAt: string;
  artifactSelection: {
    rules: string[];
    skills: string[];
    agents: string[];
    commands: string[];
    mcpServers?: string[];
  };
}

export interface LedgerGeneratedFile {
  path: string;
  agent: string;
  type: 'instruction' | 'rule' | 'skill' | 'command' | 'agent' | 'mcp' | 'settings';
  createdAt: string;
  updatedAt: string;
}

export interface LedgerHookFile {
  path: string;
  framework: 'husky' | 'pre-commit' | 'lefthook' | 'standalone';
  type: 'pre-commit' | 'commit-msg' | 'secret-scan' | 'file-size-check' | 'version-check';
  createdAt: string;
}

export interface LedgerConfigFile {
  path: string;
  type: 'manifest' | 'flags' | 'mcp' | 'state' | 'lock' | 'ledger';
  createdAt: string;
}

export type OperationType =
  | 'init'
  | 'generate'
  | 'clean'
  | 'add'
  | 'update'
  | 'preset-install'
  | 'preset-remove'
  | 'revert'
  | 'skill-feedback'
  | 'skill-evolve'
  | 'skill-stats';

export interface LedgerOperation {
  type: OperationType;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface OperationsLedgerData {
  version: '1';
  initialized: LedgerInitialization | null;
  activePreset: LedgerActivePreset | null;
  files: {
    generated: LedgerGeneratedFile[];
    hooks: LedgerHookFile[];
    config: LedgerConfigFile[];
  };
  operations: LedgerOperation[];
}

// ── Constants ───────────────────────────────────────────────────────

const EMPTY_LEDGER: OperationsLedgerData = {
  version: '1',
  initialized: null,
  activePreset: null,
  files: { generated: [], hooks: [], config: [] },
  operations: [],
};

// ── Manager ─────────────────────────────────────────────────────────

export class OperationsLedgerManager {
  private readonly ledgerPath: string;

  constructor(codiDir: string) {
    this.ledgerPath = path.join(codiDir, OPERATIONS_LEDGER_FILENAME);
  }

  async read(): Promise<Result<OperationsLedgerData>> {
    try {
      const raw = await fs.readFile(this.ledgerPath, 'utf8');
      const data = JSON.parse(raw) as OperationsLedgerData;
      return ok(data);
    } catch (cause) {
      if (isFileNotFound(cause)) {
        return ok(structuredClone(EMPTY_LEDGER));
      }
      return err([createError('E_CONFIG_PARSE_FAILED', {
        file: this.ledgerPath,
      }, cause as Error)]);
    }
  }

  async write(data: OperationsLedgerData): Promise<Result<void>> {
    try {
      const dir = path.dirname(this.ledgerPath);
      await fs.mkdir(dir, { recursive: true });
      const tmpPath = `${this.ledgerPath}.tmp.${Date.now()}`;
      await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
      await fs.rename(tmpPath, this.ledgerPath);
      return ok(undefined);
    } catch (cause) {
      return err([createError('E_CONFIG_PARSE_FAILED', {
        file: this.ledgerPath,
      }, cause as Error)]);
    }
  }

  async setInitialization(init: LedgerInitialization): Promise<Result<void>> {
    const readResult = await this.read();
    if (!readResult.ok) return readResult;

    const data = readResult.data;
    data.initialized = init;
    data.operations.push({
      type: 'init',
      timestamp: init.timestamp,
      details: {
        preset: init.preset,
        agents: init.agents,
        stack: init.stack,
        codiVersion: init.codiVersion,
      },
    });

    return this.write(data);
  }

  async setActivePreset(preset: LedgerActivePreset): Promise<Result<void>> {
    const readResult = await this.read();
    if (!readResult.ok) return readResult;

    const data = readResult.data;
    data.activePreset = preset;

    return this.write(data);
  }

  async addGeneratedFiles(files: LedgerGeneratedFile[]): Promise<Result<void>> {
    const readResult = await this.read();
    if (!readResult.ok) return readResult;

    const data = readResult.data;

    for (const file of files) {
      const existingIndex = data.files.generated.findIndex(
        (f) => f.path === file.path,
      );
      if (existingIndex !== -1) {
        data.files.generated[existingIndex] = {
          ...data.files.generated[existingIndex],
          ...file,
          updatedAt: file.updatedAt,
        };
      } else {
        data.files.generated.push(file);
      }
    }

    return this.write(data);
  }

  async addHookFiles(files: LedgerHookFile[]): Promise<Result<void>> {
    const readResult = await this.read();
    if (!readResult.ok) return readResult;

    const data = readResult.data;

    for (const file of files) {
      const exists = data.files.hooks.some((f) => f.path === file.path);
      if (!exists) {
        data.files.hooks.push(file);
      }
    }

    return this.write(data);
  }

  async addConfigFiles(files: LedgerConfigFile[]): Promise<Result<void>> {
    const readResult = await this.read();
    if (!readResult.ok) return readResult;

    const data = readResult.data;

    for (const file of files) {
      const exists = data.files.config.some((f) => f.path === file.path);
      if (!exists) {
        data.files.config.push(file);
      }
    }

    return this.write(data);
  }

  async logOperation(op: LedgerOperation): Promise<Result<void>> {
    const readResult = await this.read();
    if (!readResult.ok) return readResult;

    const data = readResult.data;
    data.operations.push(op);

    return this.write(data);
  }

  async clearFiles(): Promise<Result<void>> {
    const readResult = await this.read();
    if (!readResult.ok) return readResult;

    const data = readResult.data;
    data.files = { generated: [], hooks: [], config: [] };

    return this.write(data);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function isFileNotFound(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
