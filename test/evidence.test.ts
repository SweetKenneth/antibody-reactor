import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { measurePredictions, ratesFromConfusion, reconstructFiveFold, type BinaryPrediction } from '../src/evidence.js';

const readJson = (rel: string) => JSON.parse(readFileSync(rel, 'utf8'));

test('E1 five-fold recall is reconstructed from five distinct original populations', () => {
  const cv = readJson('artifacts/oasb-cv5/cross-validation.json');
  const folds = Array.from({ length: 5 }, (_, i) => readJson(`artifacts/oasb-cv5/fold-${i}.json`));
  const result = reconstructFiveFold(cv, folds);
  assert.equal(result.detected, 220);
  assert.equal(result.malicious, 270);
  assert.equal(result.recall, 220 / 270);
  assert.equal(result.safeFlagged, 49);
  assert.equal(result.safeLabeled, 3975);
  assert.equal(new Set(result.championIds).size, 5);
});

test('E2 the original cross-experiment precision/F1 mistake is refused', () => {
  const base = { sampleId: 'one', actual: 'malicious', predicted: 'malicious', datasetSha256: 'a'.repeat(64), policyFingerprint: 'b'.repeat(64) } as const;
  const fiveFold: BinaryPrediction = { ...base, evaluationId: 'five-fold-populations' };
  const frozen: BinaryPrediction = { ...base, sampleId: 'two', evaluationId: 'single-frozen-champion' };
  assert.throws(() => measurePredictions([fiveFold, frozen]), /cross-experiment metric mixing refused/);
});

test('E3 one metric cannot combine different policies or datasets', () => {
  const p: BinaryPrediction = { sampleId: 'one', actual: 'benign', predicted: 'benign', evaluationId: 'frozen', datasetSha256: 'a'.repeat(64), policyFingerprint: 'b'.repeat(64) };
  assert.throws(() => measurePredictions([p, { ...p, sampleId: 'two', policyFingerprint: 'c'.repeat(64) }]), /cross-policy metric mixing refused/);
  assert.throws(() => measurePredictions([p, { ...p, sampleId: 'two', datasetSha256: 'c'.repeat(64) }]), /cross-dataset metric mixing refused/);
});

test('E4 unknown verdicts cannot be silently scored as correct benign predictions', () => {
  const p: BinaryPrediction = { sampleId: 'one', actual: 'benign', predicted: 'unknown', evaluationId: 'frozen', datasetSha256: 'a'.repeat(64), policyFingerprint: 'b'.repeat(64) };
  assert.throws(() => measurePredictions([p]), /unknown verdict/);
});

test('E5 corrected frozen counts derive precision, recall, F1 and FPR from one confusion matrix', () => {
  const rates = ratesFromConfusion({ tp: 229, fp: 9, fn: 41, tn: 168 });
  assert.equal(rates.precision, 229 / 238);
  assert.equal(rates.recall, 229 / 270);
  assert.equal(rates.f1, (2 * (229 / 238) * (229 / 270)) / ((229 / 238) + (229 / 270)));
  assert.equal(rates.falsePositiveRate, 9 / 177);
});

test('E6 committed correction artifact retains the reproduced frozen result and exposure boundary', () => {
  const audit = readJson('artifacts/evidence-audit-v0.3.1/results.json');
  const frozen = audit.frozenOasbPr411;
  assert.deepEqual({ tp: frozen.tp, fp: frozen.fp, fn: frozen.fn, tn: frozen.tn }, { tp: 229, fp: 9, fn: 41, tn: 168 });
  assert.equal(frozen.samples, 447);
  assert.equal(frozen.independent, false);
  assert.equal(frozen.exposure, 'training-and-selection-exposed');
  assert.equal(frozen.categories.reduce((n: number, c: { malicious: number }) => n + c.malicious, 0), 270);
  assert.equal(frozen.categories.reduce((n: number, c: { detected: number }) => n + c.detected, 0), 229);
});
