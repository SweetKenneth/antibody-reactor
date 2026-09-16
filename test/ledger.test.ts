import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceLedger } from '../src/ledger.js';

test('evidence ledger forms and verifies a hash chain', () => {
  const ledger = new EvidenceLedger();
  ledger.append('birth', { id: 'a' }, '2026-09-16T00:00:00.000Z');
  ledger.append('trial', { survived: true }, '2026-09-16T00:00:01.000Z');
  assert.equal(ledger.verify().valid, true);
  const entries = ledger.all();
  assert.equal(entries[1]!.previousHash, entries[0]!.hash);
});
