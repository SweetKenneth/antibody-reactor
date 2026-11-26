import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { AntibodyReactorScanner } from '../src/oasb-scanner.js';
import { DeploymentController, denyAll } from '../src/deployment.js';

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

test('R19 README examples execute against the real scanner and deployment APIs', () => {
  const readme = readFileSync('README.md', 'utf8');
  const examples = [...readme.matchAll(/```js readme-smoke\n([\s\S]*?)\n```/g)].map(x => x[1]!);
  assert.equal(examples.length, 2);
  for (const [i, source] of examples.entries()) {
    // Imports are supplied from the real compiled test modules; execute the remaining README body unchanged.
    const body = source.replace(/^import [^\n]+\n/gm, '');
    const emitted: string[] = [];
    const execute = new Function('readFileSync', 'AntibodyReactorScanner', 'DeploymentController', 'denyAll', 'console', body);
    execute(readFileSync, AntibodyReactorScanner, DeploymentController, denyAll, { log: (...parts: unknown[]) => emitted.push(parts.join(' ')) });
    assert.ok(emitted.length >= 1, `README example ${i + 1} produced no result`);
    if (i === 1) assert.equal(emitted[0], 'planning');
  }
});
test('R20 evidence and public-claim documentation checks include original unseen results', () => {
  const output = execFileSync(process.execPath, ['scripts/verify-claims.mjs'], { encoding: 'utf8' });
  assert.match(output, /Unseen-test counts, SHPBL provenance and README instructions agree with source evidence/);
});
