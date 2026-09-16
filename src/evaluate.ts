import type { CorpusSample, DefenseStrain, EvaluationMetrics, StrainEvaluation, CategoryMetric } from './types.js';
import { extractTerms } from './features.js';

function safeDiv(n: number, d: number): number { return d === 0 ? 0 : n / d; }

export function metricsFromCounts(tp: number, tn: number, fp: number, fn: number): EvaluationMetrics {
  const precision = safeDiv(tp, tp + fp);
  const recall = safeDiv(tp, tp + fn);
  const specificity = safeDiv(tn, tn + fp);
  const f1 = safeDiv(2 * precision * recall, precision + recall);
  const balancedAccuracy = (recall + specificity) / 2;
  const denom = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  const mcc = denom === 0 ? 0 : ((tp * tn) - (fp * fn)) / denom;
  const falsePositiveRate = 1 - specificity;

  const mcc01 = (mcc + 1) / 2;
  // Recall is deliberately load-bearing: an immune system that stays quiet by missing attacks
  // should not dominate evolution. Benign disagreement remains a hard counter-pressure.
  const fpPenalty = Math.min(0.40, falsePositiveRate * 0.35 + Math.max(0, falsePositiveRate - 0.015) * 2.5);
  const fitness = Math.max(0, (0.45 * mcc01 + 0.40 * recall + 0.15 * specificity - fpPenalty) * 100);

  return {
    tp, tn, fp, fn,
    sampleCount: tp + tn + fp + fn,
    precision, recall, specificity, f1, balancedAccuracy, mcc, falsePositiveRate, fitness,
  };
}

export interface PreparedSample {
  sample: CorpusSample;
  terms: Set<string>;
}

export function prepareSamples(samples: readonly CorpusSample[]): PreparedSample[] {
  return samples.map(sample => ({ sample, terms: extractTerms(sample.content) }));
}

export function evaluatePrepared(strain: DefenseStrain, prepared: readonly PreparedSample[]): StrainEvaluation {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  const categories = new Map<string, { malicious: number; detected: number }>();

  for (const p of prepared) {
    const malicious = p.sample.label === 'malicious';
    let score = 0;
    for (const rule of strain.rules) if (p.terms.has(rule.term)) score += rule.weight;
    const detected = score >= strain.threshold;
    if (malicious && detected) tp++;
    else if (malicious) fn++;
    else if (detected) fp++;
    else tn++;

    if (malicious) {
      const category = p.sample.category ?? 'uncategorized';
      const c = categories.get(category) ?? { malicious: 0, detected: 0 };
      c.malicious++;
      if (detected) c.detected++;
      categories.set(category, c);
    }
  }

  const categoryMetrics: CategoryMetric[] = [...categories.entries()]
    .map(([category, c]) => ({ category, ...c, recall: safeDiv(c.detected, c.malicious) }))
    .sort((a, b) => a.category.localeCompare(b.category));
  return { metrics: metricsFromCounts(tp, tn, fp, fn), categoryMetrics };
}

export function evaluateStrain(strain: DefenseStrain, samples: readonly CorpusSample[]): StrainEvaluation {
  return evaluatePrepared(strain, prepareSamples(samples));
}
