// Built-in default logo SVG. Mirrors the bytes returned by the server-side
// logo-resolver.cjs BUILTIN_DEFAULT_SVG so the same mark renders whether the
// browser app or an export script picks the fallback.
//
// Single source of truth for the default mark; all consumers import from here.

export const BUILTIN_DEFAULT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 64">' +
  '<defs><linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">' +
  '<stop offset="0%" stop-color="#56b6c2"/>' +
  '<stop offset="100%" stop-color="#61afef"/>' +
  "</linearGradient></defs>" +
  '<text x="100" y="44" font-family="\'Geist Mono\',monospace" font-size="40" font-weight="500" fill="url(#cg)" text-anchor="middle">codi</text>' +
  "</svg>";
