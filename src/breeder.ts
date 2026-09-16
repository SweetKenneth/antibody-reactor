import type { DefenseRule, DefenseStrain, GenerationSummary, ReactorConfig, StrainEvaluation } from './types.js';
import { DeterministicRng } from './rng.js';
import { shortHash } from './hash.js';
import { LogicalClock, type Clock } from './clock.js';

export type FitnessOracle = (strain: DefenseStrain) => StrainEvaluation;

function cloneRule(rule: DefenseRule, source: DefenseRule['source']): DefenseRule {
  return { ...rule, source, evidence: { ...rule.evidence } };
}

function identity(rules: readonly DefenseRule[], threshold: number): string {
  return `${threshold.toFixed(4)}|${rules.map(r => `${r.term}:${r.weight.toFixed(4)}`).sort().join('|')}`;
}

export class DefenseBreeder {
  private generation = 0;
  private sequence = 0;
  private population: DefenseStrain[] = [];
  private readonly history: DefenseStrain[] = [];

  constructor(
    private readonly config: ReactorConfig,
    private readonly rng: DeterministicRng,
    private readonly candidatePool: readonly DefenseRule[],
    private readonly clock: Clock = new LogicalClock(),
  ) {}

  private nextId(prefix: string, payload: string): string {
    this.sequence++;
    return `${prefix}-g${this.generation}-${shortHash(`${this.config.seed}:${this.sequence}:${payload}`, 10)}`;
  }

  seedPopulation(): DefenseStrain[] {
    const sorted = [...this.candidatePool];
    const sizes = [24, 40, 64, 96, 128, 180].filter(n => n <= this.config.maxRules);
    const thresholds = [6, 10, 14, 18, 22, 28];
    const seeds: DefenseStrain[] = [];

    for (let i = 0; i < this.config.population; i++) {
      const size = Math.max(this.config.minRules, Math.min(this.config.maxRules, sizes[i % sizes.length] ?? this.config.minRules));
      const category = i % 3 === 0 ? sorted[i % Math.max(1, sorted.length)]?.category : undefined;
      const categoryRules = category ? sorted.filter(r => r.category === category) : [];
      const generalRules = this.rng.shuffle(sorted).slice(0, size);
      const combined = new Map<string, DefenseRule>();
      for (const r of [...categoryRules.slice(0, Math.ceil(size / 2)), ...generalRules]) {
        if (combined.size >= size) break;
        combined.set(r.id, cloneRule(r, 'seeded'));
      }
      const threshold = thresholds[i % thresholds.length]! * (0.9 + this.rng.next() * 0.2);
      const rules = [...combined.values()];
      const strain: DefenseStrain = {
        id: this.nextId('def', identity(rules, threshold)),
        name: `Seed-${i + 1}`,
        generation: 0,
        parentIds: [],
        rules,
        threshold: Number(threshold.toFixed(4)),
        survivalScore: 50,
        state: 'candidate',
        createdAt: this.clock.now(),
      };
      seeds.push(strain);
      this.history.push(strain);
    }
    this.population = seeds;
    return seeds;
  }

  evaluate(oracle: FitnessOracle): DefenseStrain[] {
    for (const strain of this.population) {
      const evaluation = oracle(strain);
      strain.validation = evaluation;
      strain.survivalScore = evaluation.metrics.fitness;
      strain.state = 'surviving';
    }
    return this.population;
  }

  private crossover(parentA: DefenseStrain, parentB: DefenseStrain): DefenseRule[] {
    const map = new Map<string, DefenseRule>();
    for (const r of [...parentA.rules, ...parentB.rules]) {
      if (this.rng.bool(0.58)) map.set(r.id, cloneRule(r, 'bred'));
    }
    if (map.size < this.config.minRules) {
      for (const r of this.rng.shuffle(this.candidatePool)) {
        map.set(r.id, cloneRule(r, 'bred'));
        if (map.size >= this.config.minRules) break;
      }
    }
    return [...map.values()].slice(0, this.config.maxRules);
  }

  private mutate(rules: DefenseRule[], threshold: number): { rules: DefenseRule[]; threshold: number; description: string } {
    const map = new Map(rules.map(r => [r.id, cloneRule(r, r.source)]));
    const operations: string[] = [];

    const drops = Math.min(map.size - this.config.minRules, 1 + this.rng.int(4));
    if (drops > 0 && this.rng.bool(0.72)) {
      const keys = this.rng.shuffle([...map.keys()]).slice(0, drops);
      for (const key of keys) map.delete(key);
      operations.push(`drop:${keys.length}`);
    }

    const adds = 1 + this.rng.int(5);
    if (this.rng.bool(0.82)) {
      let added = 0;
      for (const r of this.rng.shuffle(this.candidatePool)) {
        if (map.size >= this.config.maxRules || added >= adds) break;
        if (!map.has(r.id)) { map.set(r.id, cloneRule(r, 'mutated')); added++; }
      }
      operations.push(`add:${added}`);
    }

    if (this.rng.bool(0.64) && map.size) {
      const target = this.rng.pick([...map.values()]);
      const factor = 0.82 + this.rng.next() * 0.36;
      target.weight = Number(Math.max(0.15, Math.min(9, target.weight * factor)).toFixed(4));
      target.source = 'mutated';
      operations.push(`weight:${target.id}:${factor.toFixed(3)}`);
    }

    if (this.rng.bool(0.88)) {
      const delta = (this.rng.next() - 0.5) * 1.4;
      threshold = Math.max(0.75, Math.min(18, threshold + delta));
      operations.push(`threshold:${delta.toFixed(3)}`);
    }

    return { rules: [...map.values()], threshold: Number(threshold.toFixed(4)), description: operations.join(',') || 'identity' };
  }

  breedNextGeneration(admit: (baseline: DefenseStrain, candidate: DefenseStrain, mutation: string) => boolean): GenerationSummary {
    const ranked = [...this.population].sort((a, b) => (b.validation?.metrics.fitness ?? 0) - (a.validation?.metrics.fitness ?? 0));
    const elites = ranked.slice(0, Math.min(this.config.elite, ranked.length));
    this.generation++;

    // An elite that survives into this generation is competing in THIS
    // generation. Carrying its original `generation` forward made every report,
    // lineage edge and fossil entry for a long-lived elite claim it belonged to
    // a generation it had already outlived.
    const next: DefenseStrain[] = elites.map(e => ({
      ...e,
      generation: this.generation,
      state: 'surviving' as const,
      rules: e.rules.map(r => cloneRule(r, r.source)),
    }));
    let fallbackClones = 0;

    let attempts = 0;
    while (next.length < this.config.population && attempts < this.config.population * 12) {
      attempts++;
      const parentA = this.rng.pick(elites);
      const parentB = this.rng.pick(elites);
      const crossed = this.crossover(parentA, parentB);
      const baseThreshold = (parentA.threshold + parentB.threshold) / 2;
      const mutated = this.mutate(crossed, baseThreshold);
      const child: DefenseStrain = {
        id: this.nextId('def', identity(mutated.rules, mutated.threshold)),
        name: `Antibody-G${this.generation}-${shortHash(`${parentA.id}:${parentB.id}`, 8)}`,
        generation: this.generation,
        // Two draws can land on the same elite. That is a real self-cross, and
        // recording it once is the truthful lineage edge; recording it twice
        // invented a second parent and doubled the arrow in the lineage graph.
        parentIds: parentA.id === parentB.id ? [parentA.id] : [parentA.id, parentB.id],
        rules: mutated.rules,
        threshold: mutated.threshold,
        survivalScore: 0,
        state: 'candidate',
        createdAt: this.clock.now(),
      };
      if (admit(parentA, child, mutated.description)) {
        next.push(child);
        this.history.push(child);
      } else {
        child.state = 'extinct';
        child.deathReason = child.deathReason ?? 'mutation rehearsal rejected candidate';
        this.history.push(child);
      }
    }

    while (next.length < this.config.population) {
      const source = this.rng.pick(elites);
      const clone = structuredClone(source);
      clone.id = this.nextId('def', `${source.id}:fallback`);
      clone.name = `Clone-G${this.generation}-${shortHash(source.id, 8)}`;
      clone.generation = this.generation;
      clone.parentIds = [source.id];
      next.push(clone);
      this.history.push(clone);
      fallbackClones += 1;
    }

    for (const old of this.population) {
      if (!next.some(n => n.id === old.id) && old.state !== 'promoted') { old.state = 'extinct'; old.deathReason = old.deathReason ?? 'selection pressure: not retained into next population'; }
    }
    this.population = next;

    const evaluated = next.filter(s => s.validation);
    const best = evaluated.sort((a, b) => (b.validation?.metrics.fitness ?? 0) - (a.validation?.metrics.fitness ?? 0))[0] ?? elites[0]!;
    return {
      generation: this.generation,
      strainsTested: this.history.filter(s => s.generation === this.generation).length,
      survivors: next.length,
      extinct: this.history.filter(s => s.generation === this.generation && s.state === 'extinct').length,
      fallbackClones,
      bestStrainId: best.id,
      bestFitness: best.validation?.metrics.fitness ?? 0,
      bestRecall: best.validation?.metrics.recall ?? 0,
      bestFalsePositiveRate: best.validation?.metrics.falsePositiveRate ?? 0,
    };
  }

  currentPopulation(): DefenseStrain[] { return this.population; }
  lineage(): DefenseStrain[] { return this.history; }
  currentGeneration(): number { return this.generation; }
}
