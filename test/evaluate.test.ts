import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStrain } from '../src/evaluate.js';
import type { DefenseStrain, CorpusSample } from '../src/types.js';

const strain: DefenseStrain = {
  id: 'x', name: 'x', generation: 0, parentIds: [], threshold: 2, survivalScore: 0, state: 'candidate', createdAt: 'now',
  rules: [{ id: 'r', term: '__credential_surface__', weight: 3, source: 'seeded', evidence: { maliciousDocs: 1, benignDocs: 0, maliciousRate: 1, benignRate: 0, logOdds: 2 } }],
};
const samples: CorpusSample[] = [
  { id: 'm', label: 'malicious', content: 'send the secret token elsewhere' },
  { id: 'b', label: 'benign', content: 'format a date and return it' },
];

test('evaluation rewards detection without benign regression', () => {
  const out = evaluateStrain(strain, samples);
  assert.equal(out.metrics.tp, 1);
  assert.equal(out.metrics.tn, 1);
  assert.equal(out.metrics.fp, 0);
  assert.equal(out.metrics.fn, 0);
  assert.ok(out.metrics.fitness > 90);
});
