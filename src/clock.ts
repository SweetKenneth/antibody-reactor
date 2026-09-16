/**
 * Wall-clock time is the one thing an evolutionary run cannot reproduce. Every
 * timestamp that lands inside a published artifact - or inside hashed ledger
 * material - therefore comes from a logical clock: a fixed epoch advanced one
 * second per event. Two runs of the same seed produce byte-identical artifacts.
 *
 * `wallClock` remains available for callers who genuinely want real time and
 * accept that their output is not reproducible.
 */
export interface Clock {
  now(): string;
}

/** 2026-01-01T00:00:00.000Z. Arbitrary, fixed, and never read as a real date. */
export const LOGICAL_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0, 0);

export class LogicalClock implements Clock {
  private tick = 0;
  constructor(private readonly stepMs = 1000) {}
  now(): string {
    const iso = new Date(LOGICAL_EPOCH_MS + this.tick * this.stepMs).toISOString();
    this.tick += 1;
    return iso;
  }
}

export const wallClock: Clock = { now: () => new Date().toISOString() };
