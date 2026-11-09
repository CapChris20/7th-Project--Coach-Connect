// Temporarily overlays metro.config.js with a Stripe web stub for screenshot capture,
// then restores the original file. Avoids a permanent app-source change.

const fs = require('fs');
const path = require('path');
const { REPO_ROOT, TOOLS_ROOT } = require('./constants');

const METRO_PATH = path.join(REPO_ROOT, 'metro.config.js');
const BACKUP_PATH = path.join(TOOLS_ROOT, '.metro.config.js.screenshot-bak');
const STRIPE_STUB = path.join(TOOLS_ROOT, 'stubs/stripe-react-native-web.js').replace(/\\/g, '/');
const WEBVIEW_STUB = path.join(TOOLS_ROOT, 'stubs/react-native-web-webview.js').replace(/\\/g, '/');

const PATCH_MARKER = '/* SCREENSHOT_STRIP_WEB_STUB */';

function isPatched() {
  if (!fs.existsSync(METRO_PATH)) return false;
  return fs.readFileSync(METRO_PATH, 'utf8').includes(PATCH_MARKER);
}

function apply() {
  if (isPatched()) return { already: true };
  const original = fs.readFileSync(METRO_PATH, 'utf8');
  fs.writeFileSync(BACKUP_PATH, original);
  if (!original.includes('module.exports = config;')) {
    throw new Error('metro.config.js does not end with module.exports = config; — refuse to patch');
  }
  const patch = `
${PATCH_MARKER}
// Injected by tools/screenshots for Expo web capture only. Restored after run.
(() => {
  const stubStripe = ${JSON.stringify(STRIPE_STUB)};
  const stubWebView = ${JSON.stringify(WEBVIEW_STUB)};
  const prev = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web') {
      if (
        moduleName === '@stripe/stripe-react-native' ||
        moduleName.startsWith('@stripe/stripe-react-native/')
      ) {
        return { type: 'sourceFile', filePath: stubStripe };
      }
      if (
        moduleName === 'react-native-web-webview' ||
        moduleName.startsWith('react-native-web-webview/')
      ) {
        return { type: 'sourceFile', filePath: stubWebView };
      }
    }
    if (typeof prev === 'function') return prev(context, moduleName, platform);
    return context.resolveRequest(context, moduleName, platform);
  };
})();
`;
  const next = original.replace(
    'module.exports = config;',
    `${patch}\nmodule.exports = config;`,
  );
  fs.writeFileSync(METRO_PATH, next);
  return { already: false };
}

function restore() {
  if (fs.existsSync(BACKUP_PATH)) {
    fs.writeFileSync(METRO_PATH, fs.readFileSync(BACKUP_PATH, 'utf8'));
    fs.unlinkSync(BACKUP_PATH);
    return true;
  }
  if (isPatched()) {
    throw new Error('metro stub patch present but backup missing');
  }
  return false;
}

module.exports = { apply, restore, isPatched, METRO_PATH, BACKUP_PATH };
