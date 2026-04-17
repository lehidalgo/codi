'use strict';

// Inject a <script> tag that loads the inspector into every HTML response.
// Uses a simple replace on </body>; if none found, appends at the end.

const SCRIPT_TAG = '<script src="/__inspect/inspector.js" defer></script>';

function inject(html) {
  const text = typeof html === 'string' ? html : html.toString('utf-8');
  if (text.indexOf(SCRIPT_TAG) >= 0) {
    return text;
  }
  const lower = text.toLowerCase();
  const idx = lower.lastIndexOf('</body>');
  if (idx >= 0) {
    return text.slice(0, idx) + SCRIPT_TAG + '\n' + text.slice(idx);
  }
  return text + '\n' + SCRIPT_TAG + '\n';
}

module.exports = { inject, SCRIPT_TAG };
