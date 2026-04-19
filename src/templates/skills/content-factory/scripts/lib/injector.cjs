'use strict';

// Inject into every HTML response that the browser app previews:
//   1. A <script> tag that loads the inspector module.
//   2. A preview-only stylesheet that overrides canvas-root `overflow:hidden`
//      with `overflow:visible`, so the content-fit validator can detect
//      content that exceeds the active format instead of silently clipping it.
// Exports read source files directly (without running inject) and retain the
// template's original clipping behaviour.

const SCRIPT_TAG = '<script src="/__inspect/inspector.js" defer></script>';

const OVERFLOW_OVERRIDE_STYLE =
  '<style data-codi-preview-overrides>' +
  '.doc-page,.social-card,.slide{overflow:visible !important}' +
  '</style>';

function inject(html) {
  const text = typeof html === 'string' ? html : html.toString('utf-8');
  if (text.indexOf(SCRIPT_TAG) >= 0) {
    return text;
  }
  const lower = text.toLowerCase();
  const headIdx = lower.lastIndexOf('</head>');
  let withStyle = text;
  if (headIdx >= 0) {
    withStyle = text.slice(0, headIdx) + OVERFLOW_OVERRIDE_STYLE + '\n' + text.slice(headIdx);
  }
  const withStyleLower = withStyle.toLowerCase();
  const idx = withStyleLower.lastIndexOf('</body>');
  if (idx >= 0) {
    return withStyle.slice(0, idx) + SCRIPT_TAG + '\n' + withStyle.slice(idx);
  }
  return withStyle + '\n' + SCRIPT_TAG + '\n';
}

module.exports = { inject, SCRIPT_TAG, OVERFLOW_OVERRIDE_STYLE };
