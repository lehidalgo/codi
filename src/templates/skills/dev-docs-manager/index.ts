import { resolveStaticDir } from "../resolve-static-dir.js";

export { template } from "./template.js";

export const staticDir = resolveStaticDir("dev-docs-manager", import.meta.url);
