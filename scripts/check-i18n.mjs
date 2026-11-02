/* =====================================================================
   i18n check: fails when a used key is missing from a dictionary, when
   en/ar drift apart, or when a key-like literal refers to no dictionary
   entry (catches keys referenced indirectly through maps).
   Run: npm run check:i18n
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { en } from '../src/locales/en.js';
import { ar } from '../src/locales/ar.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });

const files = walk(path.join(root, 'src')).filter(f => !f.includes(`${path.sep}locales${path.sep}`) && !f.endsWith('i18n.js') && !f.endsWith('seed.js'));
const prefixes = new Set(Object.keys(en).map(k => k.split('.')[0]));
const isKeyLike = s => /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_-]+)*$/.test(s) && s.includes('.') && prefixes.has(s.split('.')[0]);

const used = new Map(); // key -> first file
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) if (!used.has(m[1])) used.set(m[1], path.relative(root, f));
  for (const m of src.matchAll(/'([^']+)'/g)) {
    const s = m[1];
    if (isKeyLike(s) && !s.endsWith('.') && !used.has(s)) used.set(s, path.relative(root, f));
  }
}

const dynamic = k => k.endsWith('.'); // prefixes concatenated at runtime (ds.cls., filesv.type.)
const missingEn = [...used].filter(([k]) => !dynamic(k) && !(k in en));
const missingAr = [...used].filter(([k]) => !dynamic(k) && !(k in ar));
const enOnly = Object.keys(en).filter(k => !(k in ar));
const arOnly = Object.keys(ar).filter(k => !(k in en));

let failed = false;
const report = (label, rows) => {
  if (!rows.length) return;
  failed = true;
  console.error(`\n✖ ${label} (${rows.length}):`);
  for (const r of rows) console.error('  ' + (Array.isArray(r) ? `${r[0]}  —  ${r[1]}` : r));
};

report('Keys missing from en.js', missingEn);
report('Keys missing from ar.js', missingAr);
report('Keys only in en.js', enOnly);
report('Keys only in ar.js', arOnly);

if (failed) process.exit(1);
console.log(`✓ i18n OK — ${used.size} keys used, en ${Object.keys(en).length}, ar ${Object.keys(ar).length}`);
