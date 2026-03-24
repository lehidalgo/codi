import fs from 'node:fs/promises';
import path from 'node:path';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';
import { loadSkillTemplate } from './skill-template-loader.js';
import { MAX_NAME_LENGTH, NAME_PATTERN_STRICT } from '../../constants.js';

const DEFAULT_CONTENT = `---
name: {{name}}
description: Custom skill
compatibility: []
tools: []
managed_by: user
---

# {{name}}

Describe what this skill does and when to use it.`;

export interface CreateSkillOptions {
  name: string;
  codiDir: string;
  template?: string;
}

export async function createSkill(options: CreateSkillOptions): Promise<Result<string>> {
  const { name, codiDir, template } = options;

  if (!NAME_PATTERN_STRICT.test(name) || name.length > MAX_NAME_LENGTH) {
    return err([createError('E_CONFIG_INVALID', {
      message: `Invalid skill name "${name}". Use lowercase letters, digits, and hyphens only (max ${MAX_NAME_LENGTH} chars).`,
    })]);
  }

  let content: string;
  if (template) {
    const templateResult = loadSkillTemplate(template);
    if (!templateResult.ok) return templateResult;
    content = templateResult.data;
  } else {
    content = DEFAULT_CONTENT;
  }

  content = content.replace(/\{\{name\}\}/g, name);

  const filePath = path.join(codiDir, 'skills', `${name}.md`);
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
      message: `Skill file already exists: ${filePath}`,
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
