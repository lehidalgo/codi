import { ok, err } from "#src/types/result.js";
import type { Result } from "#src/types/result.js";
import { createError } from "../output/errors.js";
import { BUILTIN_MCP_SERVERS } from "#src/templates/mcp-servers/index.js";
import type { McpServerTemplate } from "#src/templates/mcp-servers/index.js";

export {
  AVAILABLE_MCP_SERVER_TEMPLATES,
  BUILTIN_MCP_SERVERS,
} from "#src/templates/mcp-servers/index.js";

export function loadMcpServerTemplate(name: string): Result<McpServerTemplate> {
  const tmpl = BUILTIN_MCP_SERVERS[name];
  if (!tmpl) {
    return err([
      createError("E_CONFIG_NOT_FOUND", {
        path: `mcp-server-template:${name}`,
      }),
    ]);
  }
  return ok(tmpl);
}

export function getMcpServerTemplateVersion(name: string): number | undefined {
  return BUILTIN_MCP_SERVERS[name]?.version;
}
