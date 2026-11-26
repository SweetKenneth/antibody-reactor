import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

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
