import { readFile } from 'node:fs/promises';

/**
 * Trusted fingerprints for a published release. A pin is only as trustworthy
 * as the channel it came from: pins read from the same directory an attacker
 * can write are a consistency check, not an independent one. For an
 * independent check, obtain the pins from the signed v-tag, the GitHub release
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
  for (const r of t.releases) {
    if (typeof r.version !== 'string'
      || !HEX64.test(r.vaccine?.fileSha256 ?? '') || !HEX64.test(r.vaccine?.policyFingerprint ?? '')
      || !HEX64.test(r.ledger?.fileSha256 ?? '') || !HEX64.test(r.ledger?.head ?? '')
      || typeof r.ledger?.anchor !== 'string' || !Number.isInteger(r.ledger?.entries)) {
      throw new Error(`trusted release ${String(r.version)} is malformed`);
    }
  }
  return t;
}

export async function loadTrustedRelease(file: string, version: string): Promise<TrustedRelease> {
  const t = parseTrusted(JSON.parse(await readFile(file, 'utf8')));
  const r = t.releases.find(x => x.version === version);
  if (!r) throw new Error(`no trusted pins for release ${version}`);
  return r;
}
