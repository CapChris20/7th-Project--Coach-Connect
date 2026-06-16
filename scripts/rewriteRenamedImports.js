#!/usr/bin/env node
/**
 * Re-run import path rewrites from applyFileRenames MOVES list only.
 * Does not move files — use after manual git mv or applyFileRenames --apply.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const script = path.join(__dirname, 'applyFileRenames.js');
const result = spawnSync(process.execPath, [script, '--apply', '--rewrite-only'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
});
process.exit(result.status ?? 1);
