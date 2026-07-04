/**
 * Ensures Firestore emulator is running for rules-unit-testing.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8080;

let managedChild = null;

function resolveJavaEnv() {
  const brewJava = '/opt/homebrew/opt/openjdk@17';
  const env = { ...process.env };
  if (!env.JAVA_HOME && fs.existsSync(`${brewJava}/bin/java`)) {
    env.JAVA_HOME = brewJava;
    env.PATH = `${brewJava}/bin:${env.PATH || ''}`;
  }
  return env;
}

function parseEmulatorHost() {
  const raw = process.env.FIRESTORE_EMULATOR_HOST || `${DEFAULT_HOST}:${DEFAULT_PORT}`;
  const [host, portStr] = raw.split(':');
  return { host, port: Number(portStr || DEFAULT_PORT) };
}

function waitForPort(host, port, timeoutMs = 90000) {
  const net = require('net');
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(
            new Error(
              `Firestore emulator not ready on ${host}:${port}. Install Java (JDK 17+) or run: npm run test:firestore-rules`,
            ),
          );
          return;
        }
        setTimeout(tryConnect, 400);
      });
    };
    tryConnect();
  });
}

function isPortOpen(host, port) {
  return waitForPort(host, port, 1500).then(() => true).catch(() => false);
}

async function ensureFirestoreEmulatorRunning() {
  const { host, port } = parseEmulatorHost();
  process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;

  if (await isPortOpen(host, port)) {
    return { host, port };
  }

  managedChild = spawn(
    'firebase',
    ['emulators:start', '--only', 'firestore', '--project', 'coachconnect-rules-test'],
    {
      cwd: ROOT,
      env: resolveJavaEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  managedChild.stdout?.on('data', () => {});
  managedChild.stderr?.on('data', () => {});

  await waitForPort(host, port);
  return { host, port };
}

async function stopManagedFirestoreEmulator() {
  const child = managedChild;
  if (!child || child.killed) {
    managedChild = null;
    return;
  }

  managedChild = null;

  await new Promise((resolve) => {
    const forceKillTimer = setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
      resolve();
    }, 5000);

    child.once('exit', () => {
      clearTimeout(forceKillTimer);
      resolve();
    });
    child.kill('SIGINT');
  });
}

module.exports = {
  ensureFirestoreEmulatorRunning,
  stopManagedFirestoreEmulator,
  parseEmulatorHost,
};
