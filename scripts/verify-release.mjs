import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function verifyHistoricalManifest(file) {
  const manifest = await readFile(file, 'utf8');
  let checked = 0;
  for (const line of manifest.split('\n')) {
    if (!line.trim()) continue;
    const match = /^([0-9a-f]{64})\s+(?:\.\/)?(.+)$/.exec(line);
    assert.ok(match, `${file}: malformed checksum line`);
    const [, expected, rel] = match;
    if (!rel.startsWith('artifacts/') && rel !== '.shpbl/parents/manifest.json') continue;
    const actual = sha256(await readFile(rel));
    assert.equal(actual, expected, `${file}: historical artifact changed: ${rel}`);
    checked++;
  }
  console.log(`${file}: ${checked} historical evidence files unchanged`);
}
await verifyHistoricalManifest('CHECKSUMS.sha256');
await verifyHistoricalManifest('CHECKSUMS-v0.3.0-candidate.sha256');
const pins = JSON.parse(await readFile('TRUSTED-FINGERPRINTS.json', 'utf8')).releases.find(r => r.version === '0.2.0');
assert.ok(pins);
assert.equal(sha256(await readFile('artifacts/oasb-final/vaccine.json')), pins.vaccine.fileSha256);
assert.equal(sha256(await readFile('artifacts/oasb-final/evidence-ledger.json')), pins.ledger.fileSha256);
console.log('Trusted vaccine and ledger fingerprints match; published research evidence is unchanged.');
