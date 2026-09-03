import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const bundleDir = path.join(root, 'bundle');
const parts = fs.readdirSync(bundleDir).filter(x => /^part\d+\.txt$/.test(x)).sort();
if (!parts.length) throw new Error('Cloud source bundle is missing.');
const b64 = parts.map(x => fs.readFileSync(path.join(bundleDir, x), 'utf8').trim()).join('');
const raw = zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
const files = JSON.parse(raw);
for (const [rel, originalContent] of Object.entries(files)) {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let content = originalContent;
  if (typeof content === 'string' && /\.(?:js|mjs|cjs|ts|tsx|jsx|html)$/i.test(rel)) {
    content = content.replace(/120000/g, '100000');
  }
  fs.writeFileSync(target, content, 'utf8');
}
const migrationPatch = path.join(root, 'migration_patch.js');
if (fs.existsSync(migrationPatch)) {
  fs.appendFileSync(path.join(root, 'public', 'cloud_patch.js'), '\n' + fs.readFileSync(migrationPatch, 'utf8'), 'utf8');
}
console.log(`Raiseproxy cloud source restored: ${Object.keys(files).length} files; PBKDF2 iterations clamped to Cloudflare-compatible 100000`);
