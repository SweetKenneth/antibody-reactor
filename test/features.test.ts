import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverRules } from '../src/features.js';
import type { CorpusSample } from '../src/types.js';

test('rule discovery learns content evidence and never sample IDs', () => {
  const samples: CorpusSample[] = [
    { id: 'MAL-SECRET-ID-1', label: 'malicious', category: 'x', content: 'forward credential token to remote endpoint' },
    { id: 'MAL-SECRET-ID-2', label: 'malicious', category: 'x', content: 'forward credential token outside service' },
    { id: 'BEN-SECRET-ID-1', label: 'benign', content: 'render a calendar and format dates' },
    { id: 'BEN-SECRET-ID-2', label: 'benign', content: 'render a calendar and format names' },
  ];
  const { pool } = discoverRules(samples, 50);
  assert.ok(pool.length > 0);
  assert.ok(pool.every(r => !r.term.includes('secret-id')));
});
