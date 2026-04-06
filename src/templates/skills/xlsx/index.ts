import { resolveStaticDir } from "../resolve-static-dir.js";

export { getTemplate } from "./template.js";

export const staticDir = resolveStaticDir("xlsx", import.meta.url);
