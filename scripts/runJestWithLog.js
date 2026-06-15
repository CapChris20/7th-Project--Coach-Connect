#!/usr/bin/env node
/**
 * Runs Jest and mirrors full stdout/stderr to test-results.txt at repo root.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const rawArgs = process.argv.slice(2);
const clearLog = rawArgs.includes('--clear-test-log') || process.env.CLEAR_TEST_LOG === '1';
const jestArgs = rawArgs.filter((arg) => arg !== '--clear-test-log');
const result = spawnSync('npx', ['jest', ...jestArgs], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
  env: process.env,
});

const stdout = result.stdout || '';
const stderr = result.stderr || '';
const combined = stderr ? `${stdout}${stdout ? '\n' : ''}${stderr}` : stdout;

if (stdout) process.stdout.write(stdout);
if (stderr) process.stderr.write(stderr);

const outFile = path.join(ROOT, 'test-results.txt');
const header = [
  `Timestamp: ${new Date().toISOString()}`,
  `Command: jest ${jestArgs.join(' ')}`,
  `Exit code: ${result.status ?? 1}`,
  '',
].join('\n');

if (clearLog) {
  fs.writeFileSync(outFile, '', 'utf8');
}
fs.writeFileSync(outFile, header + combined, 'utf8');

process.exit(result.status ?? 1);
