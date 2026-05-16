import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import type { Result } from "#src/types/result.js";
import { loadMcpServerTemplate } from "./mcp-template-loader.js";
import { MANAGED_BY_USER, PROJECT_NAME } from "#src/constants.js";
import { assertNotExists, ensureDir, validateArtifactName, writeFileSafe } from "./common.js";

export interface CreateMcpServerOptions {
  name: string;
  configDir: string;
  template?: string;
  force?: boolean;
}

/**
 * Scaffold an MCP server YAML file. MCP cannot use `writeArtifactFile`
 * directly because (a) the content is YAML, not the standard markdown
 * frontmatter shape, and (b) the `{{name}}` placeholder replacement does
 * not apply — the object is constructed programmatically. We compose the
 * shared primitives (`validateArtifactName`, `ensureDir`, `assertNotExists`,
 * `writeFileSafe`) instead.
 */
export async function createMcpServer(options: CreateMcpServerOptions): Promise<Result<string>> {
  const { name, configDir, template, force } = options;

  const nameResult = validateArtifactName(name, "MCP server");
  if (!nameResult.ok) return nameResult;

  const filePath = path.join(configDir, "mcp-servers", `${name}.yaml`);
  const dir = path.dirname(filePath);

  const dirResult = await ensureDir(dir);
  if (!dirResult.ok) return dirResult;

  const existsResult = await assertNotExists(filePath, "MCP server", Boolean(force));
  if (!existsResult.ok) return existsResult;

  let yamlObj: Record<string, unknown>;
  if (template) {
    const tmplResult = loadMcpServerTemplate(template);
    if (!tmplResult.ok) return tmplResult;
    const tmpl = tmplResult.data;

    yamlObj = {
      name: tmpl.name,
      version: tmpl.version,
      managed_by: PROJECT_NAME,
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
      version: 1,
      managed_by: MANAGED_BY_USER,
      command: "",
      args: [],
    };
  }

  return writeFileSafe(filePath, stringifyYaml(yamlObj));
}
