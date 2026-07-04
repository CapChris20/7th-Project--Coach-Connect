#!/usr/bin/env node
/**
 * Renders phone-frame PNG snapshots for every client + trainer onboarding step.
 * Output: docs/onboarding-snapshots/*.png + index.html gallery
 *
 * Run: node scripts/generateOnboardingSnapshots.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { allSnapshotSteps, OPTION_GRADIENTS, FOOD_CARD_GRADIENTS } from './onboardingStepCatalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs/onboarding-snapshots');

function hexToRgba(hex, alpha) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function pillBg(stops, strong = false) {
  const a0 = strong ? 0.2 : 0.1;
  const a1 = strong ? 0.14 : 0.06;
  return `linear-gradient(135deg, ${hexToRgba(stops[0], a0)}, ${hexToRgba(stops[1], a1)})`;
}

function iconWell(stops, selected, label) {
  const initial = label.charAt(0).toUpperCase();
  const color = selected ? stops[1] : stops[0];
  return `
    <div class="icon-well" style="background:${pillBg(stops, selected)}; border-color:${hexToRgba(stops[0], 0.25)}">
      <div class="icon-accent" style="background:linear-gradient(90deg,${stops[0]},${stops[1]})"></div>
      <span class="icon-letter" style="color:${color}">${initial}</span>
    </div>`;
}

function optionRow(label, index, selected = false) {
  const g = OPTION_GRADIENTS[index % OPTION_GRADIENTS.length];
  return `
    <div class="option-row ${selected ? 'selected' : ''}">
      ${iconWell(g, selected, label)}
      <div class="option-text">
        <div class="option-label">${label}</div>
      </div>
      ${selected ? '<span class="check">✓</span>' : ''}
    </div>`;
}

function pill(label, index, on = false) {
  const g = OPTION_GRADIENTS[index % OPTION_GRADIENTS.length];
  const style = on
    ? `background:${pillBg(g, true)}; border-color:${hexToRgba(g[1], 0.5)}; color:${g[1]}`
    : '';
  return `<span class="pill ${on ? 'on' : ''}" style="${style}">${label}</span>`;
}

function renderStepBody(step) {
  const { type, options = [], fields = [] } = step;

  if (type === 'inputs') {
    const fieldHtml = fields
      .map(
        (f) => `
      <div class="input-row">
        <div class="input-icon"></div>
        <div><div class="input-label">${f.toUpperCase()}</div><div class="input-placeholder">Enter ${f.toLowerCase()}</div></div>
      </div>`
      )
      .join('');
    const genderHtml = (options || [])
      .map((o, i) => optionRow(o, i, i === 0))
      .join('');
    return fieldHtml + (options.length ? `<div class="section-label">GENDER</div>${genderHtml}` : '');
  }

  if (type === 'grid') {
    const gridItems = options.slice(0, 5).map((o, i) => {
      const g = OPTION_GRADIENTS[i % OPTION_GRADIENTS.length];
      return `
        <div class="grid-item ${i === 0 ? 'selected' : ''}">
          ${iconWell(g, i === 0, o)}
          <span>${o}</span>
        </div>`;
    }).join('');
    const listItems = options.slice(5).map((o, i) => optionRow(o, i + 5, i === 0)).join('');
    return `<div class="grid">${gridItems}</div>${listItems ? `<div class="section-label">WHERE DO YOU PREFER TO TRAIN?</div>${listItems}` : ''}`;
  }

  if (type === 'days') {
    const days = [1, 2, 3, 4, 5, 6, 7]
      .map((n) => {
        const on = n === 4;
        const g = FOOD_CARD_GRADIENTS.protein;
        return on
          ? `<div class="day on" style="background:linear-gradient(90deg,${g[0]},${g[1]})">${n}</div>`
          : `<div class="day">${n}</div>`;
      })
      .join('');
    const times = options.map((o, i) => optionRow(o, i, i === 0)).join('');
    return `<div class="days">${days}</div><div class="section-label">PREFERRED WORKOUT TIME</div>${times}`;
  }

  if (type === 'pills') {
    return `<div class="pills">${options.map((o, i) => pill(o, i, i === 0 || i === 2)).join('')}</div>`;
  }

  if (type === 'textarea') {
    return `
      <div class="textarea">Tap to enter details…</div>
      ${options.map((o, i) => `<div class="section-label">${o.toUpperCase()}</div><div class="textarea short"></div>`).join('')}
    `;
  }

  if (type === 'invite') {
    const g = FOOD_CARD_GRADIENTS.carbs;
    return `
      <div class="invite-card">
        <div class="invite-border" style="background:linear-gradient(90deg,${g[0]},${g[1]})"></div>
        <div class="invite-inner">TRAINER-DEMO12</div>
      </div>
      <div class="btn-row">
        <div class="btn outline" style="border-color:${g[0]}">Copy Code</div>
        <div class="btn fill" style="background:linear-gradient(90deg,${g[0]},${g[1]})">Share</div>
      </div>`;
  }

  if (type === 'subscription') {
    return `
      <div class="hero-box">Subscription hero</div>
      ${options.map((o, i) => optionRow(o, i, i === 0)).join('')}
      <div class="btn fill wide" style="background:linear-gradient(90deg,${FOOD_CARD_GRADIENTS.protein[0]},${FOOD_CARD_GRADIENTS.protein[1]})">Start free trial</div>`;
  }

  if (type === 'ai') {
    return options
      .map((o, i) => {
        const g = OPTION_GRADIENTS[i % OPTION_GRADIENTS.length];
        return `
        <div class="ai-card">
          ${iconWell(g, false, o)}
          <div><div class="option-label">${o}</div><div class="option-sub">Feature description</div></div>
        </div>`;
      })
      .join('');
  }

  return options.map((o, i) => optionRow(o, i, i === 0)).join('');
}

function renderPhoneHtml(stepMeta) {
  const { role, step, title, subtitle } = stepMeta;
  const total = role === 'client' ? 9 : 8;
  const pct = Math.round((step / total) * 100);
  const cta = FOOD_CARD_GRADIENTS.protein;
  const progress = role === 'trainer' ? FOOD_CARD_GRADIENTS.carbs : cta;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 390px; height: 844px; overflow: hidden;
    background: #0A0A0F; color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
    padding: 52px 20px 24px;
  }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .back { width: 36px; height: 36px; border-radius: 18px; background: rgba(255,255,255,0.06); }
  .progress { flex: 1; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.08); overflow: hidden; }
  .progress-fill { height: 100%; width: ${pct}%; background: linear-gradient(90deg, ${progress[0]}, ${progress[1]}); border-radius: 2px; }
  .step-count { font-size: 12px; color: rgba(255,255,255,0.5); font-weight: 600; min-width: 36px; text-align: right; }
  .lottie { width: 200px; height: 160px; margin: 0 auto 8px; border-radius: 20px; background: rgba(255,255,255,0.04); border: 1px dashed rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.25); font-size:11px; }
  h1 { font-size: 24px; font-weight: 800; text-align: center; line-height: 1.2; margin: 12px 0 6px; }
  .subtitle { font-size: 14px; text-align: center; color: rgba(255,255,255,0.5); margin-bottom: 16px; line-height: 1.4; }
  .role-badge { text-align:center; font-size:11px; font-weight:700; letter-spacing:1px; color:${progress[1]}; margin-bottom:4px; text-transform:uppercase; }
  .option-row { display:flex; align-items:center; padding: 12px 14px; margin-bottom:8px; border-radius:14px; border:1.5px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); }
  .option-row.selected { border-color: ${hexToRgba(FOOD_CARD_GRADIENTS.protein[1], 0.6)}; background: ${hexToRgba(FOOD_CARD_GRADIENTS.protein[1], 0.1)}; }
  .icon-well { width:40px; height:40px; border-radius:10px; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; margin-right:12px; border:1px solid; flex-shrink:0; }
  .icon-accent { position:absolute; top:0; left:0; right:0; height:3px; }
  .icon-letter { font-size:15px; font-weight:800; position:relative; z-index:1; }
  .option-label { font-size:15px; font-weight:600; }
  .option-sub { font-size:12px; color:rgba(255,255,255,0.5); margin-top:2px; }
  .check { color: ${FOOD_CARD_GRADIENTS.protein[1]}; font-weight:700; margin-left:8px; }
  .section-label { font-size:10px; font-weight:700; letter-spacing:1px; color:rgba(255,255,255,0.35); margin: 12px 0 8px; }
  .input-row { display:flex; align-items:center; height:64px; padding:0 14px; margin-bottom:10px; border-radius:14px; border:1.5px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.05); }
  .input-icon { width:22px; height:22px; border-radius:6px; background:rgba(255,255,255,0.08); margin-right:12px; }
  .input-label { font-size:10px; font-weight:700; letter-spacing:1px; color:rgba(255,255,255,0.35); }
  .input-placeholder { font-size:15px; color:rgba(255,255,255,0.25); margin-top:2px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }
  .grid-item { min-height:100px; border-radius:14px; border:1.5px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:14px; font-size:13px; font-weight:600; text-align:center; }
  .grid-item.selected { border-color: ${hexToRgba(FOOD_CARD_GRADIENTS.protein[1], 0.6)}; }
  .grid-item .icon-well { margin-right:0; }
  .days { display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin:16px 0; }
  .day { width:40px; height:40px; border-radius:20px; border:1.5px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; }
  .day.on { border:none; color:#fff; }
  .pills { display:flex; flex-wrap:wrap; gap:8px; }
  .pill { padding:8px 14px; border-radius:50px; border:1.5px solid rgba(255,255,255,0.08); font-size:13px; font-weight:600; color:#fff; }
  .textarea { min-height:100px; border-radius:14px; border:1.5px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.05); padding:14px; color:rgba(255,255,255,0.3); font-size:14px; margin-bottom:10px; }
  .textarea.short { min-height:64px; }
  .invite-card { margin: 24px auto; max-width: 320px; position:relative; padding:3px; border-radius:18px; overflow:hidden; }
  .invite-border { position:absolute; inset:0; }
  .invite-inner { position:relative; background:#1a1a22; border-radius:15px; padding:32px; text-align:center; font-size:22px; font-weight:800; letter-spacing:2px; }
  .btn-row { display:flex; gap:10px; margin-top:16px; }
  .btn { flex:1; height:48px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; }
  .btn.outline { border:2px solid; background:#1a1a22; color:#fff; }
  .btn.fill { color:#fff; }
  .btn.wide { margin-top:20px; width:100%; }
  .hero-box { height:120px; border-radius:16px; background:rgba(255,255,255,0.04); border:1px dashed rgba(255,255,255,0.1); margin-bottom:16px; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.3); font-size:12px; }
  .ai-card { display:flex; align-items:flex-start; gap:12px; padding:14px; margin-bottom:10px; border-radius:14px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03); }
  .footer-cta { position:absolute; bottom:28px; left:20px; right:20px; height:56px; border-radius:16px; background:linear-gradient(90deg,${cta[0]},${cta[1]}); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:16px; }
</style></head>
<body>
  <div class="header">
    <div class="back"></div>
    <div class="progress"><div class="progress-fill"></div></div>
    <div class="step-count">${step}/${total}</div>
  </div>
  <div class="role-badge">${role} onboarding</div>
  <div class="lottie">Lottie animation</div>
  <h1>${title}</h1>
  ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
  <div class="content">${renderStepBody(stepMeta)}</div>
  <div class="footer-cta">Continue</div>
</body></html>`;
}

function slugify(role, step, title) {
  const t = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${role}-step-${String(step).padStart(2, '0')}-${t}`;
}

function writeGalleryIndex(files) {
  const cards = files
    .map(
      (f) => `
    <a class="card" href="${f.file}">
      <img src="${f.file}" alt="${f.label}" loading="lazy" />
      <div class="meta"><span class="role ${f.role}">${f.role}</span> Step ${f.step}: ${f.title}</div>
    </a>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Coach Connect — Onboarding Snapshots</title>
<style>
  body { font-family: system-ui, sans-serif; background:#0f0f14; color:#eee; margin:0; padding:24px; }
  h1 { font-size:28px; margin-bottom:8px; }
  p { color:#888; margin-bottom:24px; }
  .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:20px; }
  .card { text-decoration:none; color:inherit; background:#1a1a22; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); }
  .card img { width:100%; display:block; aspect-ratio: 390/844; object-fit:cover; object-position: top; background:#0A0A0F; }
  .meta { padding:12px 14px; font-size:13px; line-height:1.4; }
  .role { font-size:10px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; display:inline-block; padding:2px 8px; border-radius:999px; margin-right:6px; }
  .role.client { background:rgba(255,61,138,0.15); color:#FF6B9D; }
  .role.trainer { background:rgba(166,124,0,0.2); color:#FCD34D; }
</style></head>
<body>
  <h1>Onboarding step snapshots</h1>
  <p>All ${files.length} steps — client (9) + trainer (8). Food-card macro gradients on icon wells and CTAs.</p>
  <div class="grid">${cards}</div>
</body></html>`;

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.log('Installing puppeteer (one-time)…');
    const { execSync } = await import('child_process');
    execSync('npm install --save-dev puppeteer@24', { cwd: ROOT, stdio: 'inherit' });
    puppeteer = await import('puppeteer');
  }

  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  const executablePath = chromePaths.find((p) => fs.existsSync(p));

  const browser = await puppeteer.default.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  const steps = allSnapshotSteps();
  const manifest = [];

  for (const stepMeta of steps) {
    const file = `${slugify(stepMeta.role, stepMeta.step, stepMeta.title)}.png`;
    const outPath = path.join(OUT_DIR, file);
    const html = renderPhoneHtml(stepMeta);
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.screenshot({ path: outPath, type: 'png' });
    manifest.push({
      file,
      role: stepMeta.role,
      step: stepMeta.step,
      title: stepMeta.title,
      label: `${stepMeta.role} step ${stepMeta.step}`,
    });
    console.log(`✓ ${file}`);
  }

  await browser.close();
  writeGalleryIndex(manifest);
  console.log(`\nDone — ${manifest.length} PNGs + docs/onboarding-snapshots/index.html`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
