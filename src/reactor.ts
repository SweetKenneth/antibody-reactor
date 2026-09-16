import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CorpusEnvelope, CorpusSample, DefenseStrain, GenerationSummary, ReactorConfig,
  RehearsalResult, VaccineArtifact,
} from './types.js';
import { splitCorpus, type CorpusSplit } from './split.js';
import { discoverRules } from './features.js';
import { evaluatePrepared, prepareSamples } from './evaluate.js';
import { DeterministicRng } from './rng.js';
import { DefenseBreeder } from './breeder.js';
import { EvidenceLedger, ledgerAnchor } from './ledger.js';
import { LogicalClock } from './clock.js';
import { rehearseMutation } from './rehearsal.js';
import { synthesizeVaccine } from './vaccine.js';
import { renderLineageDot, renderRunReport } from './report.js';
import { sha256 } from './hash.js';

export interface ReactorRunResult {
  config: ReactorConfig;
  corpus: {
    path: string;
    sha256: string;
    version?: string;
    total: number;
    train: number;
    validation: number;
    holdout: number;
    labels: Record<string, number>;
  };
  discovery: { candidateRules: number; maliciousDocs: number; safeDocs: number };
  generations: GenerationSummary[];
  champion: DefenseStrain;
  vaccine: VaccineArtifact;
  rehearsals: RehearsalResult[];
  ledger: { entries: number; head: string; anchor: string; verified: boolean };
}

export const DEFAULT_CONFIG: ReactorConfig = {
  seed: 20260916,
  corpusMode: 'oasb-categorized',
  generations: 24,
  population: 40,
  elite: 8,
  minRules: 16,
  maxRules: 180,
  candidatePoolSize: 360,
};

function parseEnvelope(raw: string): CorpusEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`Corpus file is not valid JSON: ${(cause as Error).message}`, { cause });
  }
  if (Array.isArray(parsed)) return { samples: parsed as CorpusSample[] };
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as CorpusEnvelope).samples)) {
    throw new Error('Expected OASB-style JSON with a samples[] array');
  }
  return parsed as CorpusEnvelope;
}

/** A corpus is untrusted input, even when it comes from a benchmark. */
const MAX_SAMPLE_BYTES = 1_000_000;

function validateSamples(samples: readonly CorpusSample[]): void {
  const seen = new Set<string>();
  for (const [i, s] of samples.entries()) {
    if (!s || typeof s !== 'object') throw new Error(`Sample at index ${i} is not an object`);
    if (typeof s.id !== 'string' || s.id.length === 0) throw new Error(`Sample at index ${i} has no string id`);
    // A duplicate id silently corrupts every partition: the same sample can land
    // in training and in the sealed holdout at once, which is contamination.
    if (seen.has(s.id)) throw new Error(`Duplicate sample id in corpus: ${s.id}`);
    seen.add(s.id);
    if (typeof s.label !== 'string' || s.label.length === 0) throw new Error(`Sample ${s.id} has no label`);
    if (s.content !== undefined && typeof s.content !== 'string') throw new Error(`Sample ${s.id} has non-string content`);
    if (typeof s.content === 'string' && Buffer.byteLength(s.content, 'utf8') > MAX_SAMPLE_BYTES) {
      throw new Error(`Sample ${s.id} exceeds the ${MAX_SAMPLE_BYTES}-byte content limit`);
    }
  }
}

function countLabels(samples: readonly CorpusSample[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of samples) out[s.label] = (out[s.label] ?? 0) + 1;
  return out;
}

function artifactTargets(samples: readonly CorpusSample[]): string[] {
  return [...new Set(samples.map(s => s.artifactType).filter((x): x is string => Boolean(x)))].sort();
}

function lineageClosure(champion: DefenseStrain, all: readonly DefenseStrain[]): DefenseStrain[] {
  const byId = new Map(all.map(s => [s.id, s]));
  const seen = new Set<string>();
  const queue = [champion.id];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node) queue.push(...node.parentIds);
  }
  return all.filter(s => seen.has(s.id)).sort((a, b) => a.generation - b.generation || a.id.localeCompare(b.id));
}

export async function runReactor(params: {
  corpusPath: string;
  outputDir: string;
  config?: Partial<ReactorConfig>;
  partitionOverride?: CorpusSplit;
  partitionLabel?: string;
}): Promise<ReactorRunResult> {
  const config = { ...DEFAULT_CONFIG, ...(params.config ?? {}) };
  if (config.elite < 2 || config.elite >= config.population) throw new Error('elite must be >= 2 and < population');
  if (config.minRules < 1 || config.maxRules < config.minRules) throw new Error('invalid rule bounds');
  for (const [key, value] of [['generations', config.generations], ['population', config.population], ['candidatePoolSize', config.candidatePoolSize]] as const) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${key} must be a positive integer`);
  }
  if (!Number.isInteger(config.seed)) throw new Error('seed must be an integer');

  const raw = await readFile(params.corpusPath, 'utf8');
  const envelope = parseEnvelope(raw);
  const sourceSamples = envelope.samples;
  validateSamples(envelope.samples);
  const samples = config.corpusMode === 'oasb-categorized'
    ? sourceSamples.filter(s => s.label !== 'malicious' || Boolean(s.category))
    : sourceSamples;
  if (samples.length < 30) throw new Error('Corpus is too small for train/validation/holdout evolution');

  const split = params.partitionOverride ?? splitCorpus(samples);
  // An empty validation or holdout split does not fail loudly, it silently
  // produces perfect-looking metrics over zero samples.
  for (const [name, part] of [['train', split.train], ['validation', split.validation], ['holdout', split.holdout]] as const) {
    if (part.length === 0) throw new Error(`Partition '${name}' is empty; refusing to evolve against a degenerate split`);
    if (!part.some(s => s.label === 'malicious')) throw new Error(`Partition '${name}' contains no malicious samples; recall would be undefined`);
  }
  const discovery = discoverRules(split.train, config.candidatePoolSize);
  if (discovery.pool.length < config.minRules) throw new Error(`Only ${discovery.pool.length} discriminatory rules discovered`);

  // The chain is anchored to the corpus bytes and the seed, so a valid ledger
  // cannot be lifted from one run and presented as evidence for another.
  const corpusSha256 = sha256(raw);
  const clock = new LogicalClock();
  const anchor = ledgerAnchor(corpusSha256, config.seed);
  const ledger = new EvidenceLedger(anchor, clock);
  ledger.append('reactor.started', { config, corpusSha256, corpusVersion: envelope.version, sampleCount: samples.length });
  ledger.append('corpus.partitioned', {
    train: split.train.length,
    validation: split.validation.length,
    holdout: split.holdout.length,
    policy: params.partitionLabel ?? '65/20/15 stable salted hash by sample id',
  });
  ledger.append('antibodies.discovered', {
    count: discovery.pool.length,
    source: 'training split only',
    top: discovery.pool.slice(0, 12).map(r => ({ id: r.id, term: r.term, weight: r.weight, evidence: r.evidence })),
  });

  // Validation is prepared exactly once. Holdout is not even tokenized until a champion exists.
  const validationPrepared = prepareSamples(split.validation);

  const rng = new DeterministicRng(config.seed);
  const breeder = new DefenseBreeder(config, rng, discovery.pool, clock);
  const rehearsals: RehearsalResult[] = [];
  const generations: GenerationSummary[] = [];
  breeder.seedPopulation();
  breeder.evaluate(strain => evaluatePrepared(strain, validationPrepared));
  ledger.append('generation.seeded', breeder.currentPopulation().map(s => ({ id: s.id, ruleCount: s.rules.length, threshold: s.threshold, fitness: s.validation?.metrics.fitness })));

  for (let g = 1; g <= config.generations; g++) {
    const summary = breeder.breedNextGeneration((baseline, child, mutation) => {
      child.validation = evaluatePrepared(child, validationPrepared);
      child.survivalScore = child.validation.metrics.fitness;
      const rehearsal = rehearseMutation({
        mutation,
        baseline: baseline.validation!.metrics,
        candidate: child.validation.metrics,
        baselineRuleCount: baseline.rules.length,
        candidateRuleCount: child.rules.length,
        generation: g,
        now: clock.now(),
      });
      rehearsals.push(rehearsal);
      ledger.append('mutation.rehearsed', {
        rehearsal,
        childId: child.id,
        parentIds: child.parentIds,
        candidateFitness: child.validation.metrics.fitness,
        candidateRecall: child.validation.metrics.recall,
        candidateFalsePositiveRate: child.validation.metrics.falsePositiveRate,
      });

      // Evolution is allowed to explore risky mutations, but blocked mutations die before reproduction.
      // Safe/risky candidates still need to beat a floor relative to their parent to enter the population.
      if (rehearsal.verdict === 'blocked') { child.deathReason = `blocked rehearsal: ${rehearsal.failureModes.join(',')}`; return false; }
      const admitted = child.validation.metrics.fitness >= baseline.validation!.metrics.fitness - 1.5;
      if (!admitted) child.deathReason = 'fitness floor: candidate fell more than 1.5 points below baseline parent';
      return admitted;
    });

    // Elites already carry validation. Newly admitted children were scored during rehearsal.
    breeder.evaluate(strain => strain.validation ?? evaluatePrepared(strain, validationPrepared));
    const ranked = [...breeder.currentPopulation()].sort((a, b) => b.validation!.metrics.fitness - a.validation!.metrics.fitness);
    const best = ranked[0]!;
    summary.bestStrainId = best.id;
    summary.bestFitness = best.validation!.metrics.fitness;
    summary.bestRecall = best.validation!.metrics.recall;
    summary.bestFalsePositiveRate = best.validation!.metrics.falsePositiveRate;
    generations.push(summary);
    ledger.append('generation.completed', {
      ...summary,
      bestRuleCount: best.rules.length,
      bestThreshold: best.threshold,
      bestMcc: best.validation!.metrics.mcc,
    });
  }

  const ranked = [...breeder.currentPopulation()].sort((a, b) => {
    const af = a.validation!.metrics.fitness;
    const bf = b.validation!.metrics.fitness;
    if (bf !== af) return bf - af;
    const ar = a.validation!.metrics.recall;
    const br = b.validation!.metrics.recall;
    if (br !== ar) return br - ar;
    return a.rules.length - b.rules.length;
  });
  const champion = ranked[0]!;
  champion.state = 'promoted';

  // The holdout is deliberately not touched until a single champion exists.
  const holdoutPrepared = prepareSamples(split.holdout);
  champion.holdout = evaluatePrepared(champion, holdoutPrepared);
  ledger.append('champion.promoted', {
    id: champion.id,
    generation: champion.generation,
    parentIds: champion.parentIds,
    validation: champion.validation!.metrics,
    holdout: champion.holdout.metrics,
    ruleCount: champion.rules.length,
    threshold: champion.threshold,
  });

  const vaccine = synthesizeVaccine(champion, artifactTargets(samples), clock.now());
  ledger.append('vaccine.synthesized', { id: vaccine.id, champion: vaccine.champion, deployment: vaccine.deployment });

  const lineage = lineageClosure(champion, breeder.lineage());
  const ledgerCheck = ledger.verify();
  if (!ledgerCheck.valid) throw new Error(`Evidence ledger failed verification at ${ledgerCheck.brokenAt}`);

  await mkdir(params.outputDir, { recursive: true });
  await writeFile(path.join(params.outputDir, 'vaccine.json'), JSON.stringify(vaccine, null, 2));
  await writeFile(path.join(params.outputDir, 'champion.json'), JSON.stringify(champion, null, 2));
  await writeFile(path.join(params.outputDir, 'lineage.json'), JSON.stringify(lineage, null, 2));
  const fossilRecord = breeder.lineage().map(s => ({
    id: s.id, name: s.name, generation: s.generation, parentIds: s.parentIds, state: s.state,
    deathReason: s.deathReason, ruleCount: s.rules.length, threshold: s.threshold,
    survivalScore: s.survivalScore, validation: s.validation?.metrics,
    genomeDigest: sha256(JSON.stringify(s.rules.map(r => [r.id, r.weight]))).slice(0, 16),
  }));
  await writeFile(path.join(params.outputDir, 'fossil-record.json'), JSON.stringify(fossilRecord, null, 2));
  await writeFile(path.join(params.outputDir, 'generations.json'), JSON.stringify(generations, null, 2));
  await writeFile(path.join(params.outputDir, 'rehearsals.json'), JSON.stringify(rehearsals, null, 2));
  await writeFile(path.join(params.outputDir, 'evidence-ledger.json'), JSON.stringify(ledger.all(), null, 2));

  const result: ReactorRunResult = {
    config,
    corpus: {
      // Basename only: an absolute path is machine-specific and made otherwise
      // identical runs differ in bytes.
      path: path.basename(params.corpusPath),
      sha256: corpusSha256,
      version: envelope.version,
      total: samples.length,
      train: split.train.length,
      validation: split.validation.length,
      holdout: split.holdout.length,
      labels: countLabels(samples),
    },
    discovery: { candidateRules: discovery.pool.length, maliciousDocs: discovery.maliciousDocs, safeDocs: discovery.safeDocs },
    generations,
    champion,
    vaccine,
    rehearsals,
    ledger: { entries: ledger.all().length, head: ledger.head(), anchor, verified: true },
  };
  await writeFile(path.join(params.outputDir, 'run-summary.json'), JSON.stringify(result, null, 2));
  await writeFile(path.join(params.outputDir, 'REPORT.md'), renderRunReport(result, lineage, fossilRecord.length));
  await writeFile(path.join(params.outputDir, 'lineage.dot'), renderLineageDot(champion, lineage));
  return result;
}
