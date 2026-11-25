import { readBoundedText } from './bounded-read.js';

/**
 * Trusted fingerprints for a published release. A pin is only as trustworthy
 * as the channel it came from: pins read from the same directory an attacker
 * can write are a consistency check, not an independent one. For an
 * independent check, obtain the pins from the checksum-verified release at an independently known commit, the GitHub release
 * page, or https://shpbl.com/antibody-reactor and pass them explicitly
 * (--expect-head / --expect-anchor / --vaccine-sha256), or point --trusted at a
 * copy fetched from one of those channels.
 */
export interface TrustedRelease {
  version: string;
  vaccine: { id: string; fileSha256: string; policyFingerprint: string };
  ledger: { fileSha256: string; anchor: string; head: string; entries: number };
}

export interface TrustedFingerprints {
  schema: 'shpbl.antibody-reactor.trusted-fingerprints/v1';
  releases: TrustedRelease[];
}

const HEX64 = /^[0-9a-f]{64}$/;

export function parseTrusted(raw: unknown): TrustedFingerprints {
  const t = raw as TrustedFingerprints;
  if (!t || t.schema !== 'shpbl.antibody-reactor.trusted-fingerprints/v1' || !Array.isArray(t.releases)) {
    throw new Error('trusted fingerprints file has the wrong schema');
  }
  const versions = new Set<string>();
  for (const r of t.releases) {
    if (!r || typeof r !== 'object' || typeof r.version !== 'string' || !r.version || versions.has(r.version) || typeof r.vaccine?.id !== 'string' || !r.vaccine.id
      || !HEX64.test(r.vaccine?.fileSha256 ?? '') || !HEX64.test(r.vaccine?.policyFingerprint ?? '')
      || !HEX64.test(r.ledger?.fileSha256 ?? '') || !HEX64.test(r.ledger?.head ?? '')
      || typeof r.ledger?.anchor !== 'string' || !Number.isSafeInteger(r.ledger?.entries) || r.ledger.entries <= 0) {
      throw new Error(`trusted release ${String(r?.version)} is malformed`);
    }
    versions.add(r.version);
  }
  return structuredClone(t);
}

export async function loadTrustedRelease(file: string, version: string): Promise<TrustedRelease> {
  const t = parseTrusted(JSON.parse(await readBoundedText(file, 1024 * 1024)));
  const r = t.releases.find(x => x.version === version);
  if (!r) throw new Error(`no trusted pins for release ${version}`);
  return r;
}
