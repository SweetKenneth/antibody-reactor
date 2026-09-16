import type { EvaluationMetrics, RehearsalResult } from './types.js';
import { shortHash } from './hash.js';

export function rehearseMutation(params: {
  mutation: string;
  baseline: EvaluationMetrics;
  candidate: EvaluationMetrics;
  baselineRuleCount: number;
  candidateRuleCount: number;
  generation: number;
  /** Injected so rehearsal evidence is reproducible; defaults to real time. */
  now?: string;
}): RehearsalResult {
  const { baseline, candidate } = params;
  const delta = baseline.fitness > 0 ? (candidate.fitness - baseline.fitness) / baseline.fitness : 0;
  const failures: string[] = [];

  if (candidate.falsePositiveRate > baseline.falsePositiveRate + 0.02) failures.push('false-positive-regression');
  if (candidate.recall < baseline.recall - 0.035) failures.push('malicious-recall-regression');
  if (candidate.mcc < baseline.mcc - 0.04) failures.push('correlation-regression');
  if (params.candidateRuleCount > Math.max(params.baselineRuleCount * 1.6, params.baselineRuleCount + 24)) failures.push('complexity-explosion');
  if (candidate.fitness < baseline.fitness - 3) failures.push('fitness-regression');

  const severe = failures.includes('false-positive-regression') && failures.includes('malicious-recall-regression');
  const verdict: RehearsalResult['verdict'] = severe || failures.length >= 3 ? 'blocked' : failures.length ? 'risky' : 'safe';
  const rollbackSafe = params.candidateRuleCount <= params.baselineRuleCount * 2 + 8;
  const confidence = Math.min(0.99, Math.max(0.35, 0.95 - failures.length * 0.12 - Math.min(0.2, Math.abs(delta) * 0.15)));
  const id = `reh-${params.generation}-${shortHash(`${params.mutation}:${candidate.fitness}:${params.candidateRuleCount}`, 10)}`;

  return {
    id,
    mutation: params.mutation,
    performanceDelta: delta,
    failureModes: failures,
    verdict,
    rollbackSafe,
    confidence,
    rehearsedAt: params.now ?? new Date().toISOString(),
  };
}
