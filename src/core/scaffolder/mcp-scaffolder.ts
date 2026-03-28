import fs from 'node:fs/promises';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';
import { loadMcpServerTemplate } from './mcp-template-loader.js';
import { MAX_NAME_LENGTH, NAME_PATTERN_STRICT } from '../../constants.js';

export interface CreateMcpServerOptions {
  name: string;
  codiDir: string;
  template?: string;
}

export async function createMcpServer(options: CreateMcpServerOptions): Promise<Result<string>> {
  const { name, codiDir, template } = options;

  if (!NAME_PATTERN_STRICT.test(name) || name.length > MAX_NAME_LENGTH) {
    return err([createError('E_CONFIG_INVALID', {
      message: `Invalid MCP server name "${name}". Use lowercase letters, digits, and hyphens only (max ${MAX_NAME_LENGTH} chars).`,
    })]);
  }

  const filePath = path.join(codiDir, 'mcp-servers', `${name}.yaml`);
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
      message: `MCP server file already exists: ${filePath}`,
    })]);
  } catch {
    // File does not exist, good to proceed
  }

  let yamlObj: Record<string, unknown>;

  if (template) {
    const tmplResult = loadMcpServerTemplate(template);
    if (!tmplResult.ok) return tmplResult;
    const tmpl = tmplResult.data;

    yamlObj = {
      name: tmpl.name,
      managed_by: 'codi',
      ...(tmpl.type && { type: tmpl.type }),
      ...(tmpl.command && { command: tmpl.command }),
      ...(tmpl.args && tmpl.args.length > 0 && { args: tmpl.args }),
      ...(tmpl.env && Object.keys(tmpl.env).length > 0 && { env: tmpl.env }),
      ...(tmpl.url && { url: tmpl.url }),
      ...(tmpl.headers && Object.keys(tmpl.headers).length > 0 && { headers: tmpl.headers }),
    };
  } else {
    yamlObj = {
      name,
      managed_by: 'user',
      command: '',
      args: [],
    };
  }

  try {
    await fs.writeFile(filePath, stringifyYaml(yamlObj), 'utf-8');
  } catch (cause) {
    return err([createError('E_PERMISSION_DENIED', {
      path: filePath,
    }, cause as Error)]);
  }

  return ok(filePath);
}
