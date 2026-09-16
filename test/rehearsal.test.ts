import test from 'node:test';
import assert from 'node:assert/strict';
import { metricsFromCounts } from '../src/evaluate.js';
import { rehearseMutation } from '../src/rehearsal.js';

test('rehearsal blocks compound security regressions', () => {
  const baseline = metricsFromCounts(90, 900, 10, 10);
  const candidate = metricsFromCounts(60, 830, 80, 40);
  const r = rehearseMutation({ mutation: 'too-aggressive', baseline, candidate, baselineRuleCount: 40, candidateRuleCount: 100, generation: 2 });
  assert.equal(r.verdict, 'blocked');
  assert.ok(r.failureModes.length >= 3);
});
