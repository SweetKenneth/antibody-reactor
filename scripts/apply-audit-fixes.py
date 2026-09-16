"""One-shot audit remediation applied to the v0.1.1 source tree.

Kept in the repository so the diff between the shipped v0.1.1 package and the
public v0.2.0 release is reconstructible rather than asserted.
"""
import pathlib, json
def rd(p): return pathlib.Path(p).read_text()
def wr(p,s): pathlib.Path(p).write_text(s)
def sub(p,old,new):
    t=rd(p)
    if new.split("\n")[0] in t and old not in t:
        print("skip (already applied)",p); return
    assert old in t, f"MISS {p}: {old[:70]!r}"
    wr(p,t.replace(old,new,1)); print("patched",p)

wr("src/clock.ts", '''/**
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
''')
print("wrote src/clock.ts")

wr("src/ledger.ts", '''import { sha256 } from './hash.js';
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
''')
print("wrote src/ledger.ts")

sub("src/types.ts",
"""export interface GenerationSummary {
  generation: number;
  strainsTested: number;
  survivors: number;
  extinct: number;""",
"""export interface GenerationSummary {
  generation: number;
  strainsTested: number;
  survivors: number;
  extinct: number;
  /**
   * Children that could not be admitted, so an elite was cloned to refill the
   * population. A high number means the generation was mostly copying, not
   * evolving, and a run report that hides it overstates how much breeding
   * actually happened.
   */
  fallbackClones: number;""")

sub("src/breeder.ts",
"import { shortHash } from './hash.js';",
"import { shortHash } from './hash.js';\nimport { LogicalClock, type Clock } from './clock.js';")
sub("src/breeder.ts",
"""    private readonly candidatePool: readonly DefenseRule[],
  ) {}""",
"""    private readonly candidatePool: readonly DefenseRule[],
    private readonly clock: Clock = new LogicalClock(),
  ) {}""")
sub("src/breeder.ts", "        createdAt: new Date().toISOString(),\n      };\n      seeds.push(strain);",
                      "        createdAt: this.clock.now(),\n      };\n      seeds.push(strain);")
sub("src/breeder.ts", "        createdAt: new Date().toISOString(),\n      };\n      if (admit(",
                      "        createdAt: this.clock.now(),\n      };\n      if (admit(")
sub("src/breeder.ts",
"""    const next: DefenseStrain[] = elites.map((e, i) => ({
      ...e,
      name: e.name,
      state: 'surviving' as const,
      rules: e.rules.map(r => cloneRule(r, r.source)),
    }));""",
"""    // An elite that survives into this generation is competing in THIS
    // generation. Carrying its original `generation` forward made every report,
    // lineage edge and fossil entry for a long-lived elite claim it belonged to
    // a generation it had already outlived.
    const next: DefenseStrain[] = elites.map(e => ({
      ...e,
      generation: this.generation,
      state: 'surviving' as const,
      rules: e.rules.map(r => cloneRule(r, r.source)),
    }));
    let fallbackClones = 0;""")
sub("src/breeder.ts",
"        parentIds: [parentA.id, parentB.id],",
"        // Two draws can land on the same elite. That is a real self-cross, and\n        // recording it once is the truthful lineage edge; recording it twice\n        // invented a second parent and doubled the arrow in the lineage graph.\n        parentIds: parentA.id === parentB.id ? [parentA.id] : [parentA.id, parentB.id],")
sub("src/breeder.ts",
"""      clone.parentIds = [source.id];
      next.push(clone);
      this.history.push(clone);""",
"""      clone.parentIds = [source.id];
      next.push(clone);
      this.history.push(clone);
      fallbackClones += 1;""")
sub("src/breeder.ts",
"""      extinct: this.history.filter(s => s.generation === this.generation && s.state === 'extinct').length,""",
"""      extinct: this.history.filter(s => s.generation === this.generation && s.state === 'extinct').length,
      fallbackClones,""")

sub("src/reactor.ts",
"import { EvidenceLedger } from './ledger.js';",
"import { EvidenceLedger, ledgerAnchor } from './ledger.js';\nimport { LogicalClock } from './clock.js';")
sub("src/reactor.ts",
"""function parseEnvelope(raw: string): CorpusEnvelope {
  const parsed: unknown = JSON.parse(raw);""",
"""function parseEnvelope(raw: string): CorpusEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`Corpus file is not valid JSON: ${(cause as Error).message}`, { cause });
  }""")
sub("src/reactor.ts",
"""  return parsed as CorpusEnvelope;
}""",
"""  return parsed as CorpusEnvelope;
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
}""")
sub("src/reactor.ts",
"""  if (config.minRules < 1 || config.maxRules < config.minRules) throw new Error('invalid rule bounds');""",
"""  if (config.minRules < 1 || config.maxRules < config.minRules) throw new Error('invalid rule bounds');
  for (const [key, value] of [['generations', config.generations], ['population', config.population], ['candidatePoolSize', config.candidatePoolSize]] as const) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${key} must be a positive integer`);
  }
  if (!Number.isInteger(config.seed)) throw new Error('seed must be an integer');""")
sub("src/reactor.ts",
"""  const samples = config.corpusMode === 'oasb-categorized'""",
"""  validateSamples(envelope.samples);
  const samples = config.corpusMode === 'oasb-categorized'""")
sub("src/reactor.ts",
"""  const split = params.partitionOverride ?? splitCorpus(samples);
  const discovery""",
"""  const split = params.partitionOverride ?? splitCorpus(samples);
  // An empty validation or holdout split does not fail loudly, it silently
  // produces perfect-looking metrics over zero samples.
  for (const [name, part] of [['train', split.train], ['validation', split.validation], ['holdout', split.holdout]] as const) {
    if (part.length === 0) throw new Error(`Partition '${name}' is empty; refusing to evolve against a degenerate split`);
    if (!part.some(s => s.label === 'malicious')) throw new Error(`Partition '${name}' contains no malicious samples; recall would be undefined`);
  }
  const discovery""")
sub("src/reactor.ts",
"""  const ledger = new EvidenceLedger();
  ledger.append('reactor.started', { config, corpusSha256: sha256(raw), corpusVersion: envelope.version, sampleCount: samples.length });""",
"""  // The chain is anchored to the corpus bytes and the seed, so a valid ledger
  // cannot be lifted from one run and presented as evidence for another.
  const corpusSha256 = sha256(raw);
  const clock = new LogicalClock();
  const anchor = ledgerAnchor(corpusSha256, config.seed);
  const ledger = new EvidenceLedger(anchor, clock);
  ledger.append('reactor.started', { config, corpusSha256, corpusVersion: envelope.version, sampleCount: samples.length });""")
sub("src/reactor.ts",
"  const breeder = new DefenseBreeder(config, rng, discovery.pool);",
"  const breeder = new DefenseBreeder(config, rng, discovery.pool, clock);")
sub("src/reactor.ts", "        generation: g,\n      });", "        generation: g,\n        now: clock.now(),\n      });")
sub("src/reactor.ts",
"  const vaccine = synthesizeVaccine(champion, artifactTargets(samples));",
"  const vaccine = synthesizeVaccine(champion, artifactTargets(samples), clock.now());")
sub("src/reactor.ts",
"""    corpus: {
      path: params.corpusPath,
      sha256: sha256(raw),""",
"""    corpus: {
      // Basename only: an absolute path is machine-specific and made otherwise
      // identical runs differ in bytes.
      path: path.basename(params.corpusPath),
      sha256: corpusSha256,""")
sub("src/reactor.ts",
"    ledger: { entries: ledger.all().length, head: ledger.all().at(-1)?.hash ?? 'GENESIS', verified: true },",
"    ledger: { entries: ledger.all().length, head: ledger.head(), anchor, verified: true },")
sub("src/reactor.ts",
"  ledger: { entries: number; head: string; verified: boolean };",
"  ledger: { entries: number; head: string; anchor: string; verified: boolean };")

sub("src/vaccine.ts",
"export function synthesizeVaccine(champion: DefenseStrain, targets: string[]): VaccineArtifact {",
"export function synthesizeVaccine(champion: DefenseStrain, targets: string[], generatedAt = new Date().toISOString()): VaccineArtifact {")
sub("src/vaccine.ts", "    generatedAt: new Date().toISOString(),", "    generatedAt,")

sub("src/rehearsal.ts","  generation: number;\n}","  generation: number;\n  /** Injected so rehearsal evidence is reproducible; defaults to real time. */\n  now?: string;\n}")
sub("src/rehearsal.ts","    rehearsedAt: new Date().toISOString(),","    rehearsedAt: params.now ?? new Date().toISOString(),")

pkg=json.loads(rd("package.json"))
pkg["name"]="antibody-reactor"
pkg["version"]="0.2.0"
pkg["license"]="MIT"
pkg["author"]="Kenneth E. Sweet Jr."
pkg["homepage"]="https://shpbl.com/antibody-reactor"
pkg["repository"]={"type":"git","url":"git+https://github.com/SweetKenneth/antibody-reactor.git"}
pkg["bugs"]={"url":"https://github.com/SweetKenneth/antibody-reactor/issues"}
pkg["keywords"]=["agent-security","evolutionary-algorithm","oasb","security-policy","prompt-injection","reproducible-research","ai-agent-security"]
pkg["engines"]["node"]=">=20.11"
pkg["files"]=["dist","src","README.md","LICENSE","THIRD_PARTY.md","PROVENANCE.json"]
pkg.pop("private",None)
pkg["scripts"]["crossvalidate"]="node dist/cli.js crossvalidate"
wr("package.json",json.dumps(pkg,indent=2)+"\n"); print("package.json -> MIT 0.2.0")

wr("LICENSE","""MIT License

Copyright (c) 2026 Kenneth E. Sweet Jr.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
""")
print("LICENSE -> MIT")
wr(".gitignore","node_modules/\ndist/\ndist-test/\n*.log\n.DS_Store\ncorpus/\n")
