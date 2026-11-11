// PNG quality gates for screenshot capture: reject blank / header-only / wrong-screen frames.
const fs = require('fs');
const { execFileSync } = require('child_process');
const { createRequire } = require('module');

let Image;
try {
  // Prefer sharp-free Pillow via python for pixel stats; Node uses tesseract CLI for OCR.
  Image = null;
} catch {
  Image = null;
}

const MIN_BYTES = 40_000; // Real iPhone UI PNGs are typically >80KB; tiny files are blank/header-only.
const MAX_HEADER_ONLY_BOTTOM_VARIANCE = 8; // Mean absolute deviation in lower 55% of frame.

function fileSizeOk(filePath) {
  const size = fs.statSync(filePath).size;
  return { ok: size >= MIN_BYTES, size, reason: size < MIN_BYTES ? `file too small (${size}B)` : null };
}

function pythonPixelCheck(filePath) {
  const script = `
from PIL import Image
import statistics, sys
path = sys.argv[1]
im = Image.open(path).convert('RGB')
w, h = im.size
# Sample a grid in the lower 55% of the frame (below status/header band).
y0 = int(h * 0.45)
step = max(8, min(w, h) // 80)
vals = []
for y in range(y0, h, step):
  for x in range(0, w, step):
    vals.append(sum(im.getpixel((x, y))) / 3.0)
if len(vals) < 20:
  print('FAIL|too-few-samples')
  raise SystemExit(0)
mad = statistics.mean(abs(v - statistics.mean(vals)) for v in vals)
uniq = len(set(int(v)//8 for v in vals))
# Reject near-flat lower region (blank / spinner-only / header-only).
if mad < ${MAX_HEADER_ONLY_BOTTOM_VARIANCE} and uniq < 6:
  print(f'FAIL|low-variance mad={mad:.2f} uniq={uniq}')
else:
  print(f'OK|mad={mad:.2f} uniq={uniq}')
`;
  try {
    const out = execFileSync('python3', ['-c', script, filePath], { encoding: 'utf8' }).trim();
    const [status, detail] = out.split('|', 2);
    return { ok: status === 'OK', detail: detail || out };
  } catch (err) {
    return { ok: false, detail: `pixel-check-error: ${err.message}` };
  }
}

function ocrText(filePath) {
  try {
    return execFileSync(
      'tesseract',
      [filePath, 'stdout', '--psm', '6', '-l', 'eng'],
      { encoding: 'utf8', maxBuffer: 5_000_000 },
    );
  } catch (err) {
    return '';
  }
}

function expectMatches(ocr, expectPatterns) {
  if (!expectPatterns || !expectPatterns.length) return { ok: true, matched: [] };
  const hay = (ocr || '').replace(/\s+/g, ' ').toLowerCase();
  const matched = [];
  const missing = [];
  for (const pattern of expectPatterns) {
    const alts = String(pattern).split('|').map((a) => a.trim().toLowerCase()).filter(Boolean);
    const hit = alts.some((alt) => hay.includes(alt));
    if (hit) matched.push(pattern);
    else missing.push(pattern);
  }
  // Pass if at least one expected pattern group matches (screens vary by data).
  return { ok: matched.length > 0, matched, missing };
}

function verifyPng(filePath, expectPatterns) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: 'file missing', ocr: '' };
  }
  const size = fileSizeOk(filePath);
  if (!size.ok) return { ok: false, reason: size.reason, size: size.size, ocr: '' };

  const pixels = pythonPixelCheck(filePath);
  if (!pixels.ok) return { ok: false, reason: pixels.detail, size: size.size, ocr: '' };

  const ocr = ocrText(filePath);
  const text = expectMatches(ocr, expectPatterns);
  if (!text.ok) {
    return {
      ok: false,
      reason: `OCR missing expected UI text (saw none of: ${expectPatterns.join(' ; ')}); ocrSnippet=${ocr.slice(0, 180).replace(/\n/g, ' ')}`,
      size: size.size,
      ocr,
      pixel: pixels.detail,
    };
  }
  return { ok: true, reason: null, size: size.size, ocr, matched: text.matched, pixel: pixels.detail };
}

module.exports = { verifyPng, MIN_BYTES };
