import { fileURLToPath } from "node:url";
import path from "node:path";

export { template } from "./template.js";

export const staticDir = path.dirname(fileURLToPath(import.meta.url));
