import { sha256 } from './hash.js';
import type { LedgerEntry } from './types.js';
import { LogicalClock, type Clock } from './clock.js';

export function canonical(value: unknown): string {
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
  headMatches?: boolean;
  entriesMatch?: boolean;
  /** Why verification failed. Absent when valid. */
  reason?: string;
}

/**
 * Pins that come from a channel the ledger's author cannot also rewrite: a
 * out-of-band root hash, PROVENANCE.json at a known commit, the project page. Without at
 * least an anchor and a head pin, a forger can rewrite payloads and re-chain
 * every hash; the chain stays internally consistent and only the pins catch it.
 */
export interface LedgerPins {
  expectedHead?: string;
  expectedEntries?: number;
  /** An empty ledger proves nothing. Rejected unless explicitly allowed. */
  allowEmpty?: boolean;
}

const HEX64 = /^[0-9a-f]{64}$/;

function isEntryShape(e: unknown): e is LedgerEntry {
  if (e === null || typeof e !== 'object' || Array.isArray(e)) return false;
  const o = e as Record<string, unknown>;
  return Number.isInteger(o['index'])
    && typeof o['timestamp'] === 'string'
    && typeof o['type'] === 'string'
    && 'payload' in o
    && typeof o['previousHash'] === 'string'
    && typeof o['hash'] === 'string'
    && HEX64.test(o['hash'] as string);
}

export function verifyLedgerEntries(
  entries: readonly LedgerEntry[] | unknown,
  expectedAnchor?: string,
  pins: LedgerPins = {},
): LedgerVerification {
  if (!Array.isArray(entries)) return { valid: false, head: UNANCHORED, anchor: UNANCHORED, reason: 'ledger is not an array' };
  const list = entries as unknown[];
  if (list.length === 0 && !pins.allowEmpty) return { valid: false, head: UNANCHORED, anchor: UNANCHORED, reason: 'empty ledger' };
  for (let i = 0; i < list.length; i++) {
    if (!isEntryShape(list[i])) return { valid: false, brokenAt: i, head: UNANCHORED, anchor: UNANCHORED, reason: `malformed entry at ${i}` };
  }
  const typed = list as LedgerEntry[];
  const head = typed.at(-1)?.hash ?? UNANCHORED;
  const anchor = typed[0]?.previousHash ?? UNANCHORED;
  for (let i = 0; i < typed.length; i++) {
    const e = typed[i];
    if (!e) return { valid: false, head, anchor, reason: 'missing entry' };
    const expectedPrevious = i === 0 ? anchor : typed[i - 1]?.hash;
    if (e.index !== i) return { valid: false, brokenAt: i, head, anchor, reason: `index mismatch at ${i}` };
    if (e.previousHash !== expectedPrevious) return { valid: false, brokenAt: i, head, anchor, reason: `broken link at ${i}` };
    let expected: string;
    try { expected = sha256(canonical({ index: e.index, timestamp: e.timestamp, type: e.type, payload: e.payload, previousHash: e.previousHash })); }
    catch { return { valid: false, brokenAt: i, head, anchor, reason: 'unserializable entry' }; }
    if (e.hash !== expected) return { valid: false, brokenAt: i, head, anchor, reason: `hash mismatch at ${i}` };
  }
  const out: LedgerVerification = { valid: true, head, anchor };
  if (expectedAnchor !== undefined) {
    out.anchorMatches = anchor === expectedAnchor;
    if (!out.anchorMatches) { out.valid = false; out.reason = 'anchor does not match trusted pin'; }
  }
  if (pins.expectedHead !== undefined) {
    out.headMatches = head === pins.expectedHead;
    if (!out.headMatches) { out.valid = false; out.reason ??= 'head does not match trusted pin'; }
  }
  if (pins.expectedEntries !== undefined) {
    out.entriesMatch = typed.length === pins.expectedEntries;
    if (!out.entriesMatch) { out.valid = false; out.reason ??= 'entry count does not match trusted pin'; }
  }
  return out;
}

export class EvidenceLedger {
  private readonly entries: LedgerEntry[] = [];

  constructor(
    private readonly anchor: string = UNANCHORED,
    private readonly clock: Clock = new LogicalClock(),
  ) {}

  append<T>(type: string, payload: T, timestamp: string = this.clock.now()): LedgerEntry<T> {
    const index = this.entries.length;
    const previousHash = this.entries.at(-1)?.hash ?? this.anchor;
    const ownedPayload = structuredClone(payload);
    const hash = sha256(canonical({ index, timestamp, type, payload: ownedPayload, previousHash }));
    const entry: LedgerEntry<T> = { index, timestamp, type, payload: ownedPayload, previousHash, hash };
    this.entries.push(entry);
    return structuredClone(entry);
  }

  /** Restore only a verified checkpoint; the caller must authenticate its external file digest. */
  restore(entries: unknown): void {
    if (this.entries.length) throw new Error('cannot replace a populated ledger');
    const check = verifyLedgerEntries(entries, this.anchor, { allowEmpty: true });
    if (!Array.isArray(entries) || (entries.length > 0 && !check.valid)) throw new Error('invalid checkpoint ledger');
    this.entries.push(...structuredClone(entries as LedgerEntry[]));
  }

  all(): LedgerEntry[] { return this.entries.map(e => structuredClone(e)); }
  head(): string { return this.entries.at(-1)?.hash ?? this.anchor; }
  verify(): LedgerVerification { return verifyLedgerEntries(this.entries, this.anchor); }
}
