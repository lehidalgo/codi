declare const __PKG_VERSION__: string;

/**
 * Current version of the Codi CLI, injected at build time from `package.json`.
 *
 * @example
 * import { VERSION } from "codi-cli";
 * console.log(`codi v${VERSION}`);
 */
export const VERSION: string = __PKG_VERSION__;
