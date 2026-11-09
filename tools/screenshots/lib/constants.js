// Shared IDs and paths for screenshot seed + capture tooling.
// Passwords and service-account material must come from env only — never from this file.

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const TOOLS_ROOT = path.resolve(__dirname, '..');
const SEEDS_ROOT = path.join(TOOLS_ROOT, 'seeds');
const SCREENSHOTS_ROOT = path.join(REPO_ROOT, 'src', 'screenshots');

const CLIENT_UID = 'screenshot_client_001';
const TRAINER_UID = 'screenshot_trainer_001';
const EXTRA_TRAINER_UID = 'screenshot_trainer_002';

const CLIENT_EMAIL = process.env.SCREENSHOT_CLIENT_EMAIL || 'cc-screenshot-client@example.com';
const TRAINER_EMAIL = process.env.SCREENSHOT_TRAINER_EMAIL || 'cc-screenshot-trainer@example.com';

const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2 };
const MAX_ATTEMPTS = 3;
const DEFAULT_WEB_URL = process.env.SCREENSHOT_WEB_URL || 'http://127.0.0.1:8081';

const PLACEHOLDER_PHOTO_URL =
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80';

module.exports = {
  REPO_ROOT,
  TOOLS_ROOT,
  SEEDS_ROOT,
  SCREENSHOTS_ROOT,
  CLIENT_UID,
  TRAINER_UID,
  EXTRA_TRAINER_UID,
  CLIENT_EMAIL,
  TRAINER_EMAIL,
  VIEWPORT,
  MAX_ATTEMPTS,
  DEFAULT_WEB_URL,
  PLACEHOLDER_PHOTO_URL,
};
