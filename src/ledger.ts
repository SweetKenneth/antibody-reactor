import { sha256 } from './hash.js';
import type { LedgerEntry } from './types.js';
import { LogicalClock, type Clock } from './clock.js';

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
}

/**
 * The literal used when a ledger is not bound to a specific run. Anchoring is
 * preferred: an unanchored chain is internally tamper-evident but says nothing
 * about which corpus and seed produced it, so a whole ledger can be swapped for
 * another valid one without detection.
 */
export const UNANCHORED = 'GENESIS';

/** Bind a chain to the exact corpus bytes and seed that produced it. */
export function ledgerAnchor(corpusSha256: string, seed: number): string {
  return `anchor:${sha256(`${corpusSha256}:${seed}`)}`;
}

export interface LedgerVerification {
  valid: boolean;
  brokenAt?: number;
  head: string;
  anchor: string;
  anchorMatches?: boolean;
}

export function verifyLedgerEntries(
  entries: readonly LedgerEntry[],
  expectedAnchor?: string,
): LedgerVerification {
  const head = entries.at(-1)?.hash ?? UNANCHORED;
  const anchor = entries[0]?.previousHash ?? UNANCHORED;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const expectedPrevious = i === 0 ? anchor : entries[i - 1]!.hash;
    if (e.index !== i) return { valid: false, brokenAt: i, head, anchor };
    if (e.previousHash !== expectedPrevious) return { valid: false, brokenAt: i, head, anchor };
    const expected = sha256(canonical({ index: e.index, timestamp: e.timestamp, type: e.type, payload: e.payload, previousHash: e.previousHash }));
    if (e.hash !== expected) return { valid: false, brokenAt: i, head, anchor };
  }
  if (expectedAnchor !== undefined) {
    const anchorMatches = anchor === expectedAnchor;
    return { valid: anchorMatches, head, anchor, anchorMatches };
  }
  return { valid: true, head, anchor };
}

export class EvidenceLedger {
  private readonly entries: LedgerEntry[] = [];

  constructor(
    private readonly anchor: string = UNANCHORED,
    private readonly clock: Clock = new LogicalClock(),
  ) {}

  append<T>(type: string, payload: T, timestamp: string = this.clock.now()): LedgerEntry<T> {
    const index = this.entries.length;
    const previousHash = index === 0 ? this.anchor : this.entries[index - 1]!.hash;
    const hash = sha256(canonical({ index, timestamp, type, payload, previousHash }));
    const entry: LedgerEntry<T> = { index, timestamp, type, payload, previousHash, hash };
    this.entries.push(entry);
    return entry;
  }

  all(): LedgerEntry[] { return this.entries.map(e => structuredClone(e)); }
  head(): string { return this.entries.at(-1)?.hash ?? this.anchor; }
  verify(): LedgerVerification { return verifyLedgerEntries(this.entries, this.anchor); }
}
