import { resolveStaticDir } from "../resolve-static-dir.js";

export { getTemplate } from "./template.js";

export const staticDir = resolveStaticDir("e2e-testing", import.meta.url);
