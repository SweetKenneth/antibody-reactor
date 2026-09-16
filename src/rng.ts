export class DeterministicRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 0x5f3759df;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return (this.state % 1_000_000) / 1_000_000;
  }
  int(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }
  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }
  pick<T>(values: readonly T[]): T {
    if (!values.length) throw new Error('Cannot pick from an empty array');
    return values[this.int(values.length)]!;
  }
  shuffle<T>(values: readonly T[]): T[] {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
}
