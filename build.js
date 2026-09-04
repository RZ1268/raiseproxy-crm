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

const patchTarget = path.join(root, 'public', 'cloud_patch.js');
for (const patchName of ['migration_patch.js', 'export_patch.js']) {
  const patchPath = path.join(root, patchName);
  if (fs.existsSync(patchPath)) {
    fs.appendFileSync(patchTarget, '\n' + fs.readFileSync(patchPath, 'utf8'), 'utf8');
  }
}

console.log(`Raiseproxy cloud source restored: ${Object.keys(files).length} files; PBKDF2 iterations clamped to Cloudflare-compatible 100000; cloud patches loaded`);
