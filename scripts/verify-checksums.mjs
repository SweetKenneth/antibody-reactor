import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const manifest = process.argv[2];
const write = process.argv.includes('--write');
const complete = process.argv.includes('--complete');
if (!manifest) throw new Error('usage: node scripts/verify-checksums.mjs MANIFEST [--write] [--complete]');
const excludedDirs = new Set(['node_modules', 'dist', 'dist-test', '.git']);
async function files(dir = '.') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (excludedDirs.has(entry.name)) continue;
    const rel = path.join(dir, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) out.push(...await files(rel));
    else if (entry.isFile() && rel !== manifest) out.push(rel.replace(/^\.\//, ''));
  }
  return out;
}
const digest = async rel => createHash('sha256').update(await readFile(rel)).digest('hex');
if (write) {
  const rows = [];
  for (const rel of (await files()).sort()) rows.push(`${await digest(rel)}  ${rel}`);
  await writeFile(manifest, `${rows.join('\n')}\n`);
  console.log(`Wrote ${manifest} with ${rows.length} entries`);
} else {
  const listed = new Map();
  for (const line of (await readFile(manifest, 'utf8')).split('\n')) {
    if (!line.trim()) continue;
    const match = /^([0-9a-f]{64})\s+(?:\.\/)?(.+)$/.exec(line);
    if (!match) throw new Error(`${manifest}: malformed line`);
    listed.set(match[2], match[1]);
  }
  for (const [rel, expected] of listed) {
    const actual = await digest(rel);
    if (actual !== expected) throw new Error(`${manifest}: checksum mismatch: ${rel}`);
  }
  if (complete) {
    const current = (await files()).sort();
    const expected = [...listed.keys()].sort();
    if (JSON.stringify(current) !== JSON.stringify(expected)) {
      const missing = current.filter(f => !listed.has(f));
      const absent = expected.filter(f => !current.includes(f));
      throw new Error(`${manifest}: file set differs; unlisted=${missing.join(',')} absent=${absent.join(',')}`);
    }
  }
  console.log(`${manifest}: ${listed.size} files verified${complete ? ' with complete file-set coverage' : ''}`);
}
