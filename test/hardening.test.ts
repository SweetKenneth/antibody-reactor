import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EvidenceLedger, verifyLedgerEntries, ledgerAnchor, UNANCHORED } from '../src/ledger.js';
import { LogicalClock } from '../src/clock.js';
import { runReactor } from '../src/reactor.js';
import type { CorpusSample } from '../src/types.js';

const MAL_TERMS = [
  'exfiltrate credentials to remote endpoint immediately',
  'install persistence hook in the agent startup path',
  'curl attacker host and pipe response into shell',
  'escalate privileges by writing to the sudoers file',
];
const SAFE_TERMS = [
  'format the quarterly report table and check the totals',
  'summarise the meeting notes into three short bullets',
  'validate the yaml schema and report missing fields',
  'refactor the helper to remove duplicated parsing logic',
];
const CATEGORIES = ['prompt_injection', 'data_exfiltration', 'persistence', 'privilege_escalation'];

function syntheticCorpus(mal = 60, safe = 140): { version: string; samples: CorpusSample[] } {
  const samples: CorpusSample[] = [];
  for (let i = 0; i < mal; i++) {
    samples.push({
      id: `syn-mal-${i}`,
      label: 'malicious',
      category: CATEGORIES[i % CATEGORIES.length]!,
      artifactType: 'markdown',
      content: `${MAL_TERMS[i % MAL_TERMS.length]} step ${i} token-${i % 7}`,
    } as unknown as CorpusSample);
  }
  for (let i = 0; i < safe; i++) {
    samples.push({
      id: `syn-safe-${i}`,
      label: 'safe',
      artifactType: 'markdown',
      content: `${SAFE_TERMS[i % SAFE_TERMS.length]} note ${i} item-${i % 11}`,
    } as unknown as CorpusSample);
  }
  return { version: 'synthetic/v1', samples };
}

async function corpusFile(envelope: unknown, name = 'corpus.json'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ar-test-'));
  const file = path.join(dir, name);
  await writeFile(file, JSON.stringify(envelope));
  return file;
}

async function rejects(fn: () => Promise<unknown>, fragment: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    assert.match((error as Error).message, new RegExp(fragment, 'i'));
    return;
  }
  assert.fail(`expected rejection matching /${fragment}/i`);
}

const SMALL = { generations: 3, population: 12, elite: 4, candidatePoolSize: 80, minRules: 4 } as const;

test('logical clock is monotonic, reproducible and independent of wall time', () => {
  const a = new LogicalClock();
  const b = new LogicalClock();
  const first = [a.now(), a.now(), a.now()];
  const second = [b.now(), b.now(), b.now()];
  assert.deepEqual(first, second);
  assert.equal(first[0], '2026-01-01T00:00:00.000Z');
  assert.ok(first[1]! > first[0]!);
});

test('an anchored ledger binds its chain to one corpus and seed', () => {
  const anchor = ledgerAnchor('a'.repeat(64), 7);
  const ledger = new EvidenceLedger(anchor);
  ledger.append('one', { x: 1 });
  ledger.append('two', { x: 2 });
  const check = ledger.verify();
  assert.equal(check.valid, true);
  assert.equal(check.anchor, anchor);
  assert.notEqual(anchor, UNANCHORED);

  // A chain that is internally valid but produced under a different seed must
  // not verify against this run's anchor.
  const foreign = new EvidenceLedger(ledgerAnchor('a'.repeat(64), 8));
  foreign.append('one', { x: 1 });
  const cross = verifyLedgerEntries(foreign.all(), anchor);
  assert.equal(cross.valid, false);
  assert.equal(cross.anchorMatches, false);
});

test('ledger detects payload tampering, reordering and truncation', () => {
  const ledger = new EvidenceLedger(ledgerAnchor('b'.repeat(64), 1));
  for (let i = 0; i < 5; i++) ledger.append('event', { i });

  const tamperedPayload = ledger.all();
  (tamperedPayload[2]!.payload as { i: number }).i = 99;
  assert.equal(verifyLedgerEntries(tamperedPayload).valid, false);
  assert.equal(verifyLedgerEntries(tamperedPayload).brokenAt, 2);

  const reordered = ledger.all();
  [reordered[1], reordered[2]] = [reordered[2]!, reordered[1]!];
  assert.equal(verifyLedgerEntries(reordered).valid, false);

  const truncated = ledger.all().slice(1);
  assert.equal(verifyLedgerEntries(truncated).valid, false);
});

test('duplicate sample ids are refused instead of silently contaminating splits', async () => {
  const envelope = syntheticCorpus();
  envelope.samples.push({ ...envelope.samples[0]! });
  const file = await corpusFile(envelope);
  await rejects(
    () => runReactor({ corpusPath: file, outputDir: path.join(path.dirname(file), 'out'), config: SMALL }),
    'duplicate sample id',
  );
});

test('malformed and degenerate corpora fail loudly', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ar-bad-'));
  const broken = path.join(dir, 'broken.json');
  await writeFile(broken, '{ "samples": [ ');
  await rejects(() => runReactor({ corpusPath: broken, outputDir: path.join(dir, 'o1'), config: SMALL }), 'not valid JSON');

  const wrongShape = await corpusFile({ items: [] }, 'shape.json');
  await rejects(() => runReactor({ corpusPath: wrongShape, outputDir: path.join(dir, 'o2'), config: SMALL }), 'samples');

  const empty = await corpusFile({ samples: [] }, 'empty.json');
  await rejects(() => runReactor({ corpusPath: empty, outputDir: path.join(dir, 'o3'), config: SMALL }), 'too small');

  const noId = await corpusFile({ samples: [{ label: 'safe', content: 'x' }] }, 'noid.json');
  await rejects(() => runReactor({ corpusPath: noId, outputDir: path.join(dir, 'o4'), config: SMALL }), 'string id');

  const noLabel = await corpusFile({ samples: [{ id: 'a', content: 'x' }] }, 'nolabel.json');
  await rejects(() => runReactor({ corpusPath: noLabel, outputDir: path.join(dir, 'o5'), config: SMALL }), 'label');

  const oversized = syntheticCorpus();
  oversized.samples[0]!.content = 'x'.repeat(1_000_001);
  const big = await corpusFile(oversized, 'big.json');
  await rejects(() => runReactor({ corpusPath: big, outputDir: path.join(dir, 'o6'), config: SMALL }), 'byte content limit');

  const safeOnly = await corpusFile({ samples: syntheticCorpus(0, 200).samples }, 'safe.json');
  await rejects(
    () => runReactor({ corpusPath: safeOnly, outputDir: path.join(dir, 'o7'), config: SMALL }),
    'no malicious samples|discriminatory',
  );
});

test('invalid configuration is rejected', async () => {
  const file = await corpusFile(syntheticCorpus());
  const out = path.join(path.dirname(file), 'cfg');
  await rejects(() => runReactor({ corpusPath: file, outputDir: out, config: { ...SMALL, generations: 0 } }), 'positive integer');
  await rejects(() => runReactor({ corpusPath: file, outputDir: out, config: { ...SMALL, population: 12.5 } }), 'positive integer');
  await rejects(() => runReactor({ corpusPath: file, outputDir: out, config: { ...SMALL, seed: 1.5 } }), 'seed must be an integer');
  await rejects(() => runReactor({ corpusPath: file, outputDir: out, config: { ...SMALL, elite: 1 } }), 'elite');
  await rejects(() => runReactor({ corpusPath: file, outputDir: out, config: { ...SMALL, elite: 12 } }), 'elite');
});

test('two runs of the same seed produce byte-identical evidence', async () => {
  const file = await corpusFile(syntheticCorpus());
  const base = path.dirname(file);
  const a = path.join(base, 'run-a');
  const b = path.join(base, 'run-b');
  const first = await runReactor({ corpusPath: file, outputDir: a, config: SMALL });
  const second = await runReactor({ corpusPath: file, outputDir: b, config: SMALL });

  assert.equal(first.champion.id, second.champion.id);
  assert.equal(first.ledger.head, second.ledger.head);
  assert.equal(first.ledger.anchor, second.ledger.anchor);
  for (const name of [
    'champion.json', 'vaccine.json', 'evidence-ledger.json', 'lineage.json',
    'fossil-record.json', 'generations.json', 'rehearsals.json', 'run-summary.json',
  ]) {
    const [x, y] = await Promise.all([
      readFile(path.join(a, name), 'utf8'),
      readFile(path.join(b, name), 'utf8'),
    ]);
    assert.equal(x, y, `${name} is not byte-identical across identical runs`);
  }
});

test('a different seed produces a different run, so nothing is hard-coded', async () => {
  const file = await corpusFile(syntheticCorpus());
  const base = path.dirname(file);
  const a = await runReactor({ corpusPath: file, outputDir: path.join(base, 's1'), config: { ...SMALL, seed: 1 } });
  const b = await runReactor({ corpusPath: file, outputDir: path.join(base, 's2'), config: { ...SMALL, seed: 2 } });
  assert.notEqual(a.ledger.head, b.ledger.head);
  assert.notEqual(a.ledger.anchor, b.ledger.anchor);
});

test('lineage, generation accounting and holdout isolation hold after a real run', async () => {
  const file = await corpusFile(syntheticCorpus());
  const out = path.join(path.dirname(file), 'lineage');
  const result = await runReactor({ corpusPath: file, outputDir: out, config: SMALL });

  // No invented parents: a self-cross records one parent, never the same id twice.
  const lineage = JSON.parse(await readFile(path.join(out, 'lineage.json'), 'utf8')) as Array<{
    id: string; parentIds: string[]; generation: number;
  }>;
  for (const strain of lineage) {
    assert.equal(new Set(strain.parentIds).size, strain.parentIds.length, `duplicate parent edge on ${strain.id}`);
    assert.ok(!strain.parentIds.includes(strain.id), `self-parent edge on ${strain.id}`);
  }

  // Every generation reports how much of it was breeding versus cloning.
  assert.equal(result.generations.length, SMALL.generations);
  for (const g of result.generations) assert.equal(typeof g.fallbackClones, 'number');

  // The champion is scored on a holdout it was never selected on.
  assert.ok(result.champion.holdout);
  assert.ok(result.corpus.holdout > 0);
  assert.equal(result.corpus.train + result.corpus.validation + result.corpus.holdout, result.corpus.total);

  // The recorded corpus path is a basename, never a machine-specific absolute path.
  assert.equal(result.corpus.path, path.basename(file));
  assert.ok(!result.corpus.path.includes(path.sep));

  // The ledger stands up on its own bytes, and against this run's anchor.
  const entries = JSON.parse(await readFile(path.join(out, 'evidence-ledger.json'), 'utf8'));
  assert.equal(verifyLedgerEntries(entries, result.ledger.anchor).valid, true);
});

test('no corpus sample id ever reaches a published artifact', async () => {
  const envelope = syntheticCorpus();
  const file = await corpusFile(envelope);
  const out = path.join(path.dirname(file), 'leak');
  await runReactor({ corpusPath: file, outputDir: out, config: SMALL });
  const ids = envelope.samples.map(s => s.id);
  for (const name of ['vaccine.json', 'champion.json', 'lineage.json', 'fossil-record.json', 'evidence-ledger.json']) {
    const text = await readFile(path.join(out, name), 'utf8');
    for (const id of ids) assert.ok(!text.includes(id), `${name} leaks corpus sample id ${id}`);
  }
});
