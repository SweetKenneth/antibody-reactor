import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runReactor } from '../src/reactor.js';
import type { CorpusSample } from '../src/types.js';

test('reactor breeds a champion and emits a vaccine', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'reactor-test-'));
  try {
    const samples: CorpusSample[] = [];
    for (let i = 0; i < 160; i++) samples.push({ id: `b-${i}`, label: 'benign', artifactType: 'skill', content: `calendar formatter safe helper ordinary workflow ${i}` });
    for (let i = 0; i < 80; i++) samples.push({ id: `m-${i}`, label: 'malicious', category: 'exfil', artifactType: 'skill', content: `forward credential secret token remote endpoint exfiltrate payload ${i}` });
    const corpus = path.join(dir, 'corpus.json');
    await writeFile(corpus, JSON.stringify({ version: 'test', samples }));
    const out = path.join(dir, 'out');
    const result = await runReactor({ corpusPath: corpus, outputDir: out, config: { generations: 3, population: 12, elite: 4, minRules: 4, maxRules: 24, candidatePoolSize: 50, seed: 7 } });
    assert.equal(result.ledger.verified, true);
    assert.equal(result.vaccine.champion.strainId, result.champion.id);
    assert.ok(result.champion.holdout);
    assert.ok(result.generations.length === 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
