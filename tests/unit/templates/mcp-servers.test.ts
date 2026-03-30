import { describe, it, expect } from 'vitest';
import {
  BUILTIN_MCP_SERVERS,
  AVAILABLE_MCP_SERVER_TEMPLATES,
} from '../../../src/templates/mcp-servers/index.js';

describe('MCP server templates', () => {
  it('AVAILABLE_MCP_SERVER_TEMPLATES matches BUILTIN_MCP_SERVERS keys', () => {
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toEqual(Object.keys(BUILTIN_MCP_SERVERS));
  });

  it('all templates have required name field', () => {
    for (const [key, tmpl] of Object.entries(BUILTIN_MCP_SERVERS)) {
      expect(tmpl.name).toBe(key);
    }
  });

  it('all templates have a description', () => {
    for (const [, tmpl] of Object.entries(BUILTIN_MCP_SERVERS)) {
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.description.length).toBeGreaterThan(5);
    }
  });

  it('all templates have either command or url', () => {
    for (const [key, tmpl] of Object.entries(BUILTIN_MCP_SERVERS)) {
      const hasCommand = !!tmpl.command;
      const hasUrl = !!tmpl.url;
      expect(hasCommand || hasUrl, `Template "${key}" must have command or url`).toBe(true);
    }
  });

  it('stdio templates have args array', () => {
    for (const [key, tmpl] of Object.entries(BUILTIN_MCP_SERVERS)) {
      if (tmpl.command) {
        expect(Array.isArray(tmpl.args), `Template "${key}" with command should have args`).toBe(true);
      }
    }
  });

  it('has expected builtin servers', () => {
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain('github');
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain('memory');
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain('sequential-thinking');
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain('filesystem');
  });
});
