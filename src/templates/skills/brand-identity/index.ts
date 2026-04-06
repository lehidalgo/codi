import { resolveStaticDir } from "../resolve-static-dir.js";

export { template } from "./template.js";

export const staticDir = resolveStaticDir("brand-identity", import.meta.url);
