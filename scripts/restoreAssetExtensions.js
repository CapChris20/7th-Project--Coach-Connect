#!/usr/bin/env node
/** Restore .png/.json/.gif extensions on asset require() paths Metro needs. */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const ASSET_EXT = ['.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(jsx?|tsx?)$/.test(ent.name)) out.push(p);
  }
  return out;
}

let fixed = 0;
for (const file of walk(SRC)) {
  let text = fs.readFileSync(file, 'utf8');
  const orig = text;
  text = text.replace(/require\((['"])(\.[^'"]+)\1\)/g, (full, q, spec) => {
    if (!spec.startsWith('.')) return full;
    if (/\.(png|jpe?g|gif|webp|svg|json)$/i.test(spec)) return full;
    const base = path.resolve(path.dirname(file), spec);
    for (const ext of ASSET_EXT) {
      if (fs.existsSync(base + ext)) {
        fixed += 1;
        return `require(${q}${spec}${ext}${q})`;
      }
    }
    return full;
  });
  if (text !== orig) fs.writeFileSync(file, text);
}
console.log(`Restored ${fixed} asset require extensions.`);
