import { readBoundedText } from './bounded-read.js';
import { sha256 } from './hash.js';
import { AntibodyReactorScanner } from './oasb-scanner.js';
import type { VaccineArtifact } from './types.js';

/**
 * Evaluate a FROZEN vaccine against samples it never saw. Nothing here learns,
 * tunes a threshold or selects rules: the vaccine is read, fingerprinted, and
 * applied. Each sample file is hashed before any sample is scanned, so the
 * reported set is the set that was scored.
 */
export interface IndependentSample { id: string; label: 'malicious' | 'benign'; content: string }

export interface IndependentSetResult {
  name: string;
  fileSha256: string;
  samples: number;
  malicious: number;
  benign: number;
  detected: number;
  missed: number;
  flaggedBenign: number;
  unknown: number;
  recall: number;
  falsePositiveRate: number;
  missedIds: string[];
  flaggedBenignIds: string[];
}

export async function loadSamples(file: string): Promise<{ sha: string; samples: IndependentSample[] }> {
  const raw = await readBoundedText(file, 64 * 1024 * 1024);
  const sha = sha256(raw);
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 100_000) throw new Error(`${file}: expected 1–100000 samples`);
  const ids = new Set<string>();
  const samples = parsed.map((s, i) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error(`${file}: sample ${i} malformed`);
    const o = s as Record<string, unknown>;
    if (typeof o['id'] !== 'string' || !o['id'] || o['id'].length > 256 || ids.has(o['id']) || typeof o['content'] !== 'string' || (o['label'] !== 'malicious' && o['label'] !== 'benign')) {
      throw new Error(`${file}: sample ${i} malformed`);
    }
    if (Buffer.byteLength(o['content'], 'utf8') > 1024 * 1024) throw new Error(`${file}: sample ${i} exceeds 1 MiB`);
    ids.add(o['id']);
    return { id: o['id'], label: o['label'], content: o['content'] } as IndependentSample;
  });
  if (!samples.some(s => s.label === 'malicious') || !samples.some(s => s.label === 'benign')) throw new Error(`${file}: both classes required`);
  return { sha, samples };
}

export function evaluateFrozen(vaccine: VaccineArtifact, name: string, sha: string, samples: IndependentSample[]): IndependentSetResult {
  const scanner = new AntibodyReactorScanner(vaccine);
  let detected = 0, missed = 0, flaggedBenign = 0, unknown = 0, malicious = 0, benign = 0;
  const missedIds: string[] = [], flaggedBenignIds: string[] = [];
  for (const s of samples) {
    const r = scanner.scanDetailed(s.content, s.id);
    if (r.verdict === 'unknown') unknown++;
    if (s.label === 'malicious') {
      malicious++;
      if (r.verdict === 'malicious') detected++; else { missed++; missedIds.push(s.id); }
    } else {
      benign++;
      if (r.verdict === 'malicious') { flaggedBenign++; flaggedBenignIds.push(s.id); }
    }
  }
  return {
    name, fileSha256: sha, samples: samples.length, malicious, benign, detected, missed, flaggedBenign, unknown,
    recall: malicious ? detected / malicious : 0,
    falsePositiveRate: benign ? flaggedBenign / benign : 0,
    missedIds, flaggedBenignIds,
  };
}
