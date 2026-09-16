import type { VaccineArtifact } from './types.js';
import { extractTerms } from './features.js';

export interface OasbCompatibleScannerResult {
  sampleId: string;
  verdict: 'malicious' | 'benign' | 'unknown';
  category?: string;
  confidence?: number;
  scanTimeMs?: number;
}

export interface DetailedScanResult extends OasbCompatibleScannerResult {
  score: number;
  threshold: number;
  matched: Array<{ id: string; term: string; weight: number; category?: string }>;
}

/**
 * Structurally compatible with OASB's skills-security ScannerAdapter.
 * sampleId is echoed for the harness only; it is never used to classify content.
 */
export class AntibodyReactorScanner {
  readonly name = 'SHPBL Antibody Reactor';
  readonly version = '0.1.1';
  readonly id = 'shpbl-antibody-reactor';

  constructor(private readonly vaccine: VaccineArtifact) {}

  scanDetailed(content: string, sampleId: string, _artifactType?: string): DetailedScanResult {
    const start = performance.now();
    const terms = extractTerms(content);
    let score = 0;
    const categoryScores = new Map<string, number>();
    const matched: DetailedScanResult['matched'] = [];
    for (const rule of this.vaccine.policy.rules) {
      if (!terms.has(rule.term)) continue;
      score += rule.weight;
      matched.push({ id: rule.id, term: rule.term, weight: rule.weight, category: rule.category });
      if (rule.category) categoryScores.set(rule.category, (categoryScores.get(rule.category) ?? 0) + rule.weight);
    }
    const malicious = score >= this.vaccine.policy.threshold;
    const category = malicious
      ? [...categoryScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      : undefined;
    const margin = score - this.vaccine.policy.threshold;
    const confidence = malicious
      ? Math.min(0.99, 0.5 + Math.max(0, margin) / Math.max(1, this.vaccine.policy.threshold * 2))
      : Math.min(0.99, 0.5 + Math.max(0, -margin) / Math.max(1, this.vaccine.policy.threshold * 2));
    return {
      sampleId,
      verdict: malicious ? 'malicious' : 'benign',
      category,
      confidence,
      scanTimeMs: performance.now() - start,
      score,
      threshold: this.vaccine.policy.threshold,
      matched: matched.sort((a, b) => b.weight - a.weight),
    };
  }

  async scan(content: string, sampleId: string, artifactType?: string): Promise<OasbCompatibleScannerResult> {
    const { score: _score, threshold: _threshold, matched: _matched, ...result } = this.scanDetailed(content, sampleId, artifactType);
    return result;
  }
}
