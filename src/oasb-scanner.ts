import type { VaccineArtifact } from './types.js';
import { extractTerms } from './features.js';
import { assertValidVaccine, policyFingerprint, VaccineValidationError } from './vaccine-validate.js';

export const SCANNER_VERSION = '0.3.1';

export interface OasbCompatibleScannerResult {
  sampleId: string;
  verdict: 'malicious' | 'benign' | 'unknown';
  category?: string;
  confidence?: number;
  scanTimeMs?: number;
}

export interface DetailedScanResult extends OasbCompatibleScannerResult {
  policyFingerprint: string;
  score: number;
  threshold: number;
  /** score - threshold. Positive means flagged. */
  margin: number;
  matched: Array<{ id: string; term: string; weight: number; category?: string }>;
  /** What `confidence` is. It is a bounded margin heuristic, not a calibrated probability. */
  confidenceBasis: 'margin-heuristic-uncalibrated' | 'none';
  /** Present only when verdict is 'unknown'. */
  error?: string;
}

export interface ScannerOptions {
  /** Inputs larger than this many UTF-8 bytes are refused (verdict 'unknown'). Default 1 MiB. */
  maxInputBytes?: number;
  /** When set, the vaccine's canonical policy SHA-256 must equal this value or construction fails. */
  expectedPolicyFingerprint?: string;
}

export const DEFAULT_MAX_INPUT_BYTES = 1024 * 1024;
/** Upper bound on a "benign" confidence. Absence of matched evidence is weak evidence of safety. */
export const BENIGN_CONFIDENCE_CAP = 0.75;
export const MALICIOUS_CONFIDENCE_CAP = 0.95;

/**
 * Structurally compatible with OASB's skills-security ScannerAdapter.
 * sampleId is echoed for the harness only; it is never used to classify content.
 *
 * Fail-closed: the vaccine is validated (and optionally fingerprint-pinned) at
 * construction; any input that cannot be scanned yields verdict 'unknown',
 * never 'benign'.
 */
export class AntibodyReactorScanner {
  readonly name = 'SHPBL Antibody Reactor';
  readonly version = SCANNER_VERSION;
  readonly id = 'shpbl-antibody-reactor';
  readonly policyFingerprint: string;
  private readonly maxInputBytes: number;
  private readonly vaccine: VaccineArtifact;

  constructor(vaccine: VaccineArtifact | unknown, options: ScannerOptions = {}) {
    assertValidVaccine(vaccine);
    this.vaccine = structuredClone(vaccine);
    this.policyFingerprint = policyFingerprint(this.vaccine);
    if (options.expectedPolicyFingerprint !== undefined && options.expectedPolicyFingerprint !== this.policyFingerprint) {
      throw new VaccineValidationError(['policy fingerprint does not match trusted pin']);
    }
    const max = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
    if (!Number.isInteger(max) || max <= 0) throw new RangeError('maxInputBytes must be a positive integer');
    this.maxInputBytes = max;
  }

  private unknown(sampleId: string, error: string, start: number): DetailedScanResult {
    return {
      sampleId, verdict: 'unknown', confidence: 0, scanTimeMs: performance.now() - start,
      policyFingerprint: this.policyFingerprint, score: 0, threshold: this.vaccine.policy.threshold, margin: 0, matched: [], confidenceBasis: 'none', error,
    };
  }

  scanDetailed(content: string | unknown, sampleId: string, _artifactType?: string): DetailedScanResult {
    const start = performance.now();
    const id = typeof sampleId === 'string' ? sampleId : '[invalid-sample-id]';
    if (typeof content !== 'string') return this.unknown(id, 'content is not a string', start);
    // Cheap pre-check before encoding: UTF-8 is at most 3 bytes per UTF-16 unit.
    if (content.length > this.maxInputBytes || Buffer.byteLength(content, 'utf8') > this.maxInputBytes) {
      return this.unknown(id, `content exceeds ${this.maxInputBytes} bytes`, start);
    }
    try {
      const threshold = this.vaccine.policy.threshold;
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
      if (!Number.isFinite(score)) return this.unknown(id, 'non-finite score', start);
      const malicious = score >= threshold;
      const category = malicious ? [...categoryScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
      const margin = score - threshold;
      // Distance from the threshold, in units of the threshold, squashed into a bounded band.
      // Benign confidence is capped lower: zero matched rules is "no known evidence", not proof of safety,
      // and recall on unseen distributions is not measured by the training oracle.
      const strength = Math.min(1, Math.abs(margin) / threshold);
      const confidence = malicious
        ? 0.5 + (MALICIOUS_CONFIDENCE_CAP - 0.5) * strength
        : 0.5 + (BENIGN_CONFIDENCE_CAP - 0.5) * strength;
      return {
        sampleId: id,
        policyFingerprint: this.policyFingerprint,
        verdict: malicious ? 'malicious' : 'benign',
        category,
        confidence,
        scanTimeMs: performance.now() - start,
        score,
        threshold,
        margin,
        matched: matched.sort((a, b) => b.weight - a.weight),
        confidenceBasis: 'margin-heuristic-uncalibrated',
      };
    } catch (error) {
      return this.unknown(id, error instanceof Error ? error.message : 'scan failed', start);
    }
  }

  async scan(content: string, sampleId: string, artifactType?: string): Promise<OasbCompatibleScannerResult> {
    const d = this.scanDetailed(content, sampleId, artifactType);
    return { sampleId: d.sampleId, verdict: d.verdict, category: d.category, confidence: d.confidence, scanTimeMs: d.scanTimeMs };
  }
}
