import { AntibodyReactorScanner, SCANNER_VERSION } from './oasb-scanner.js';
import { policyFingerprint } from './vaccine-validate.js';
import type { CorpusSample, VaccineArtifact } from './types.js';

export type BinaryLabel = 'malicious' | 'benign';

/** Every prediction in one measurement must come from the same scanner, policy and dataset. */
export interface BinaryPrediction {
  sampleId: string;
  actual: BinaryLabel;
  predicted: BinaryLabel | 'unknown';
  evaluationId: string;
  datasetSha256: string;
  policyFingerprint: string;
}

export interface ConfusionCounts { tp: number; fp: number; fn: number; tn: number }
export interface EvidenceRates { precision: number; recall: number; f1: number; falsePositiveRate: number }
export interface PredictionMeasurement extends ConfusionCounts, EvidenceRates {
  evaluationId: string;
  datasetSha256: string;
  policyFingerprint: string;
  samples: number;
}

export function ratesFromConfusion(c: ConfusionCounts): EvidenceRates {
  for (const name of ['tp', 'fp', 'fn', 'tn'] as const) {
    const value = c[name];
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  }
  const precision = c.tp + c.fp > 0 ? c.tp / (c.tp + c.fp) : 0;
  const recall = c.tp + c.fn > 0 ? c.tp / (c.tp + c.fn) : 0;
  return {
    precision,
    recall,
    f1: precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0,
    falsePositiveRate: c.fp + c.tn > 0 ? c.fp / (c.fp + c.tn) : 0,
  };
}

/**
 * Score one coherent prediction set. Mixing five-fold out-of-fold predictions
 * with a frozen champion's benign predictions is rejected, not assigned an F1.
 */
export function measurePredictions(predictions: readonly BinaryPrediction[]): PredictionMeasurement {
  const first = predictions[0];
  if (!first) throw new Error('cannot measure an empty prediction set');
  const ids = new Set<string>();
  const counts: ConfusionCounts = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const p of predictions) {
    if (!p.sampleId || ids.has(p.sampleId)) throw new Error(`duplicate or empty sample id: ${p.sampleId}`);
    ids.add(p.sampleId);
    if (p.evaluationId !== first.evaluationId) throw new Error('cross-experiment metric mixing refused: evaluationId differs');
    if (p.datasetSha256 !== first.datasetSha256) throw new Error('cross-dataset metric mixing refused: dataset SHA-256 differs');
    if (p.policyFingerprint !== first.policyFingerprint) throw new Error('cross-policy metric mixing refused: vaccine fingerprint differs');
    if (p.predicted === 'unknown') throw new Error(`unknown verdict for ${p.sampleId}; refusing to convert it into a flattering score`);
    if (p.actual === 'malicious') {
      if (p.predicted === 'malicious') counts.tp++; else counts.fn++;
    } else {
      if (p.predicted === 'malicious') counts.fp++; else counts.tn++;
    }
  }
  return {
    evaluationId: first.evaluationId,
    datasetSha256: first.datasetSha256,
    policyFingerprint: first.policyFingerprint,
    samples: predictions.length,
    ...counts,
    ...ratesFromConfusion(counts),
  };
}

export interface FrozenOasbEvaluation extends PredictionMeasurement {
  schema: 'shpbl.antibody-reactor.frozen-oasb-evaluation/v1';
  scannerVersion: string;
  vaccineId: string;
  independent: false;
  exposure: 'training-and-selection-exposed';
  malicious: number;
  benign: number;
  categories: Array<{ category: string; malicious: number; detected: number }>;
}

function hasScannerVerdict(sample: CorpusSample): boolean {
  const metadata = sample['metadata'];
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)['scanVerdict'] !== undefined
    && (metadata as Record<string, unknown>)['scanVerdict'] !== null;
}

/** Reproduce OASB PR #411's exact sample-selection predicate without hard-coded fixture IDs. */
export function oasbUnlabelledBenignSet(samples: readonly CorpusSample[]): CorpusSample[] {
  return samples.filter(s => (s.label === 'malicious' && s.category !== undefined)
    || (s.label === 'benign' && !hasScannerVerdict(s)));
}

export function evaluateFrozenOasb(
  vaccine: VaccineArtifact,
  datasetSha256: string,
  samples: readonly CorpusSample[],
): FrozenOasbEvaluation {
  const selected = oasbUnlabelledBenignSet(samples);
  const scanner = new AntibodyReactorScanner(vaccine);
  const fingerprint = policyFingerprint(vaccine);
  const evaluationId = 'oasb-pr411-frozen-v0.2.0-research-only';
  const predictions: BinaryPrediction[] = selected.map(s => ({
    sampleId: s.id,
    actual: s.label === 'malicious' ? 'malicious' : 'benign',
    predicted: scanner.scanDetailed(s.content, s.id, s.artifactType).verdict,
    evaluationId,
    datasetSha256,
    policyFingerprint: fingerprint,
  }));
  const measured = measurePredictions(predictions);
  const byCategory = new Map<string, { malicious: number; detected: number }>();
  for (const p of predictions) {
    if (p.actual !== 'malicious') continue;
    const sample = selected.find(s => s.id === p.sampleId);
    const category = sample?.category;
    if (!category) throw new Error(`categorized attack ${p.sampleId} lost its category`);
    const current = byCategory.get(category) ?? { malicious: 0, detected: 0 };
    current.malicious++;
    if (p.predicted === 'malicious') current.detected++;
    byCategory.set(category, current);
  }
  return {
    schema: 'shpbl.antibody-reactor.frozen-oasb-evaluation/v1',
    ...measured,
    scannerVersion: SCANNER_VERSION,
    vaccineId: vaccine.id,
    independent: false,
    exposure: 'training-and-selection-exposed',
    malicious: measured.tp + measured.fn,
    benign: measured.fp + measured.tn,
    categories: [...byCategory.entries()]
      .map(([category, counts]) => ({ category, ...counts }))
      .sort((a, b) => a.category.localeCompare(b.category)),
  };
}

export interface CrossValidationArtifact {
  schema: string;
  folds: number;
  foldResults: Array<{
    fold: number;
    malicious: number;
    detected: number;
    safeLabeled: number;
    safeFlagged: number;
    recall: number;
    safeDisagreementRate: number;
    championId: string;
    categoryMetrics: Array<{ category: string; malicious: number; detected: number; recall: number }>;
  }>;
  aggregate: {
    malicious: number;
    detected: number;
    recall: number;
    safeLabeled: number;
    safeFlagged: number;
    safeDisagreementRate: number;
    categories: Array<{ category: string; malicious: number; detected: number; recall: number }>;
  };
}

/** Rebuild the aggregate from the five original fold objects; never trust copied prose. */
export function reconstructFiveFold(cv: CrossValidationArtifact, foldFiles: readonly unknown[]): CrossValidationArtifact['aggregate'] & { championIds: string[] } {
  if (cv.schema !== 'shpbl.antibody-reactor.crossvalidation/v1' || cv.folds !== 5 || cv.foldResults.length !== 5 || foldFiles.length !== 5) {
    throw new Error('expected the original five-fold artifact and five fold files');
  }
  for (let i = 0; i < 5; i++) {
    if (JSON.stringify(foldFiles[i]) !== JSON.stringify(cv.foldResults[i])) throw new Error(`fold ${i} file differs from the aggregate artifact`);
  }
  const sum = (key: 'malicious' | 'detected' | 'safeLabeled' | 'safeFlagged') => cv.foldResults.reduce((n, f) => n + f[key], 0);
  const aggregate = {
    malicious: sum('malicious'),
    detected: sum('detected'),
    recall: 0,
    safeLabeled: sum('safeLabeled'),
    safeFlagged: sum('safeFlagged'),
    safeDisagreementRate: 0,
    categories: [] as CrossValidationArtifact['aggregate']['categories'],
  };
  aggregate.recall = aggregate.malicious ? aggregate.detected / aggregate.malicious : 0;
  aggregate.safeDisagreementRate = aggregate.safeLabeled ? aggregate.safeFlagged / aggregate.safeLabeled : 0;
  const categories = new Map<string, { malicious: number; detected: number }>();
  for (const fold of cv.foldResults) {
    for (const c of fold.categoryMetrics) {
      const current = categories.get(c.category) ?? { malicious: 0, detected: 0 };
      current.malicious += c.malicious;
      current.detected += c.detected;
      categories.set(c.category, current);
    }
  }
  aggregate.categories = [...categories.entries()].map(([category, c]) => ({
    category, ...c, recall: c.malicious ? c.detected / c.malicious : 0,
  })).sort((a, b) => a.category.localeCompare(b.category));
  if (JSON.stringify(aggregate) !== JSON.stringify(cv.aggregate)) throw new Error('five-fold aggregate does not match its original fold records');
  if (new Set(cv.foldResults.map(f => f.championId)).size !== 5) throw new Error('five-fold experiment must retain five distinct champion policies');
  return { ...aggregate, championIds: cv.foldResults.map(f => f.championId) };
}
