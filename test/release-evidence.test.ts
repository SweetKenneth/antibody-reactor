import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('R17 historical artifact verification includes the dotfile parent manifest', () => {
  const output = execFileSync(process.execPath, ['scripts/verify-release.mjs'], { encoding: 'utf8' });
  assert.match(output, /CHECKSUMS\.sha256: 18 historical evidence files unchanged/);
  assert.match(output, /CHECKSUMS-v0\.3\.0-candidate\.sha256: 19 historical evidence files unchanged/);
  assert.match(output, /Trusted vaccine and ledger fingerprints match/);
});

test('R18 candidate checksum verification covers every source, dotfile, document and artifact', () => {
  const output = execFileSync(process.execPath, ['scripts/verify-checksums.mjs', 'CHECKSUMS-v0.3.1-candidate.sha256', '--complete'], { encoding: 'utf8' });
  assert.match(output, /files verified with complete file-set coverage/);
});

test('R19 README code examples actually execute against the public API', () => {
  const readme = readFileSync('README.md', 'utf8');
  const snippets = [...readme.matchAll(/```js readme-smoke\n([\s\S]*?)\n```/g)].map(x => x[1]);
  assert.equal(snippets.length, 2);
  for (const [index, source] of snippets.entries()) {
    const code = source.replace("from './dist/index.js'", "from './dist-test/src/index.js'");
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', code], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
    assert.equal(run.status, 0, `README snippet ${index + 1}: ${run.stderr || run.error?.message || ''}`);
    if (index === 1) assert.match(run.stdout, /planning/);
  }
});

test('R20 evidence and public-claim documentation checks include original unseen results', () => {
  const output = execFileSync(process.execPath, ['scripts/verify-claims.mjs'], { encoding: 'utf8' });
  assert.match(output, /Unseen-test counts, SHPBL provenance and README instructions agree with source evidence/);
});
