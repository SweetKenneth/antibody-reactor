import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const cli = path.join(process.cwd(), 'dist-test/src/cli.js');
const vaccine = 'artifacts/oasb-final/vaccine.json';
function run(args: string[]) { return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000 }); }

test('CLI validation distinguishes hashing from pinned verification', () => {
  const unpinned = run(['validate-vaccine', '--vaccine', vaccine]);
  assert.equal(unpinned.status, 0); assert.match(JSON.parse(unpinned.stdout).integrity, /unpinned/);
  const pinned = run(['validate-vaccine', '--vaccine', vaccine, '--trusted', 'TRUSTED-FINGERPRINTS.json', '--release', '0.2.0']);
  assert.equal(pinned.status, 0); assert.equal(JSON.parse(pinned.stdout).integrity, 'pinned');
});
test('CLI oversized and malformed UTF-8 artifacts yield unknown', () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ar-cli-')), 'artifact');
  writeFileSync(file, 'ab'); const large = run(['scan', '--vaccine', vaccine, '--file', file, '--max-bytes', '1']);
  assert.equal(large.status, 3); assert.equal(JSON.parse(large.stdout).verdict, 'unknown');
  writeFileSync(file, Buffer.from([0xff])); const invalid = run(['scan', '--vaccine', vaccine, '--file', file]);
  assert.equal(invalid.status, 3); assert.equal(JSON.parse(invalid.stdout).verdict, 'unknown');
});
test('CLI rejects wrong vaccine pins and missing sample paths', () => {
  assert.equal(run(['scan', '--vaccine', vaccine, '--file', vaccine, '--vaccine-sha256', '0'.repeat(64)]).status, 4);
  assert.equal(run(['independent', '--vaccine', vaccine, '--samples']).status, 1);
});
test('CLI pinned ledger verification succeeds', () => {
  const r = run(['verify', '--ledger', 'artifacts/oasb-final/evidence-ledger.json', '--trusted', 'TRUSTED-FINGERPRINTS.json', '--release', '0.2.0', '--require-pins']);
  assert.equal(r.status, 0); assert.equal(JSON.parse(r.stdout).valid, true);
});
test('CLI refuses FIFO artifact paths without waiting for a writer', { skip: process.platform === 'win32' }, () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ar-cli-')), 'fifo');
  assert.equal(spawnSync('mkfifo', [file]).status, 0);
  const r = run(['scan', '--vaccine', vaccine, '--file', file]);
  assert.equal(r.status, 3); assert.equal(JSON.parse(r.stdout).verdict, 'unknown');
});