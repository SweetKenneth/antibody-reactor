import test from 'node:test';
import assert from 'node:assert/strict';
import { splitCorpus } from '../src/split.js';
import type { CorpusSample } from '../src/types.js';

test('split is deterministic and mutually exclusive', () => {
  const samples: CorpusSample[] = Array.from({ length: 200 }, (_, i) => ({ id: `s-${i}`, label: i % 5 ? 'benign' : 'malicious', content: `content ${i}` }));
  const a = splitCorpus(samples);
  const b = splitCorpus(samples);
  assert.deepEqual(a, b);
  const ids = [...a.train, ...a.validation, ...a.holdout].map(s => s.id);
  assert.equal(new Set(ids).size, samples.length);
});

import { crossValidationSplit } from '../src/split.js';

test('cross validation holds every sample out exactly once', () => {
  const samples: CorpusSample[] = Array.from({ length: 137 }, (_, i) => ({ id: `cv-${i}`, label: i % 4 ? 'benign' : 'malicious', content: `x ${i}` }));
  const counts = new Map<string, number>();
  for (let fold = 0; fold < 5; fold++) {
    const p = crossValidationSplit(samples, fold, 5);
    for (const s of p.holdout) counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
  }
  assert.equal(counts.size, samples.length);
  assert.ok([...counts.values()].every(n => n === 1));
});
