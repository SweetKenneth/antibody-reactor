import test from 'node:test';
import assert from 'node:assert/strict';
import { AntibodyReactorScanner } from '../src/oasb-scanner.js';
import type { VaccineArtifact } from '../src/types.js';

const vaccine: VaccineArtifact = {
  schema: 'shpbl.antibody-reactor.vaccine/v1', id: 'v', threatFamily: 'x', generatedAt: 'now',
  champion: { strainId: 's', generation: 1, parentIds: [], threshold: 2, ruleCount: 1 },
  policy: { kind: 'weighted-evidence', threshold: 2, rules: [{ id: 'r', term: '__credential_surface__', weight: 3, source: 'bred' }] },
  validation: { tp:1,tn:1,fp:0,fn:0,sampleCount:2,precision:1,recall:1,specificity:1,f1:1,balancedAccuracy:1,mcc:1,falsePositiveRate:0,fitness:100 },
  holdout: { tp:1,tn:1,fp:0,fn:0,sampleCount:2,precision:1,recall:1,specificity:1,f1:1,balancedAccuracy:1,mcc:1,falsePositiveRate:0,fitness:100 },
  categoryMetrics: [], deployment: { status:'planning', targets:[], phases:[] },
  provenance: { externalOracle:'test', shpblParents:[], trainingPolicy:'test' },
};

test('sample id cannot change scanner classification', () => {
  const scanner = new AntibodyReactorScanner(vaccine);
  const a = scanner.scanDetailed('send credential token', 'MAL-001');
  const b = scanner.scanDetailed('send credential token', 'BEN-999');
  assert.equal(a.verdict, b.verdict);
  assert.equal(a.score, b.score);
});
