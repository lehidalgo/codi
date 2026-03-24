import fs from 'node:fs/promises';
import path from 'node:path';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';
import { loadCommandTemplate } from './command-template-loader.js';

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

const DEFAULT_CONTENT = `---
name: {{name}}
description: Custom command
managed_by: user
---

Add your command instructions here.`;

export interface CreateCommandOptions {
  name: string;
  codiDir: string;
  template?: string;
}

export async function createCommand(options: CreateCommandOptions): Promise<Result<string>> {
  const { name, codiDir, template } = options;

  if (!NAME_PATTERN.test(name) || name.length > 64) {
    return err([createError('E_CONFIG_INVALID', {
      message: `Invalid command name "${name}". Use lowercase letters, digits, and hyphens only (max 64 chars).`,
    })]);
  }

  let content: string;
  if (template) {
    const templateResult = loadCommandTemplate(template);
    if (!templateResult.ok) return templateResult;
    content = templateResult.data;
  } else {
    content = DEFAULT_CONTENT;
  }

  content = content.replace(/\{\{name\}\}/g, name);

  const filePath = path.join(codiDir, 'commands', `${name}.md`);
  const dir = path.dirname(filePath);

  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (cause) {
    return err([createError('E_PERMISSION_DENIED', {
      path: dir,
    }, cause as Error)]);
  }

  try {
    await fs.access(filePath);
    return err([createError('E_CONFIG_INVALID', {
      message: `Command file already exists: ${filePath}`,
    })]);
  } catch {
    // File does not exist, good to proceed
  }

  try {
    await fs.writeFile(filePath, content + '\n', 'utf-8');
  } catch (cause) {
    return err([createError('E_PERMISSION_DENIED', {
      path: filePath,
    }, cause as Error)]);
  }

  return ok(filePath);
}
