/**
 * Smoke-test Claude certification vision with a generated sample "certificate" image.
 * Usage (from repo root, with server .env loaded):
 *   node server/scripts/testVerifyTrainerCertification.js
 *
 * Requires ANTHROPIC_API_KEY. Does not write to Firestore unless FIREBASE is initialized
 * and RUN_FIRESTORE=1 is set.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (_) {
  /* optional */
}

const {
  analyzeCertificationWithClaude,
  decideVerificationOutcome,
} = require('../lib/verifyTrainerCertification');

/** Minimal valid 1x1 PNG, then we build a larger solid PNG via raw scanlines (simple test fixture). */
function buildSolidPng(width, height, rgb = [255, 255, 255]) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
    return ~c >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 3;
      raw[i] = rgb[0];
      raw[i + 1] = rgb[1];
      raw[i + 2] = rgb[2];
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  if (!process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY =
      process.env.CLAUDE_API_KEY || process.env.EXPO_PUBLIC_CLAUDE_API_KEY || '';
  }
  if (!String(process.env.ANTHROPIC_API_KEY || '').trim()) {
    console.error('Missing ANTHROPIC_API_KEY — set it in .env or the environment.');
    process.exit(1);
  }

  const outDir = path.join(__dirname, '../tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const samplePath = path.join(outDir, 'sample-cert.png');

  // Prefer a real sample if present at fixtures/
  const fixture = path.join(__dirname, '../fixtures/sample-certification.png');
  let png;
  if (fs.existsSync(fixture)) {
    png = fs.readFileSync(fixture);
    console.log('Using fixture:', fixture);
  } else {
    png = buildSolidPng(640, 400, [245, 245, 250]);
    fs.writeFileSync(samplePath, png);
    console.log(
      'No fixtures/sample-certification.png found — using a blank PNG (Claude should likely reject / low confidence).',
      '\nAdd a real cert photo at server/fixtures/sample-certification.png for a meaningful check.',
    );
  }

  const base64 = png.toString('base64');
  console.log('Calling Claude vision…');
  const analysis = await analyzeCertificationWithClaude({
    imageBase64: base64,
    mediaType: 'image/png',
    trainerName: 'Alex Trainer',
  });
  const outcome = decideVerificationOutcome(analysis);
  console.log(JSON.stringify({ analysis, outcome }, null, 2));
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
