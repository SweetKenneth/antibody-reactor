#!/usr/bin/env node
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { runReactor, DEFAULT_CONFIG } from './reactor.js';
import { verifyLedgerEntries } from './ledger.js';
import { AntibodyReactorScanner } from './oasb-scanner.js';
import { runCrossValidation } from './crossvalidate.js';
import type { LedgerEntry, VaccineArtifact } from './types.js';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}
function num(name: string): number | undefined {
  const value = arg(name);
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be numeric`);
  return n;
}
function pct(v: number): string { return `${(v * 100).toFixed(2)}%`; }

async function runCommand(): Promise<void> {
  const corpusPath = arg('--corpus');
  if (!corpusPath) throw new Error('--corpus is required');
  const out = path.resolve(arg('--out') ?? 'artifacts/latest');
  const result = await runReactor({
    corpusPath: path.resolve(corpusPath),
    outputDir: out,
    config: {
      seed: num('--seed') ?? DEFAULT_CONFIG.seed,
      generations: num('--generations') ?? DEFAULT_CONFIG.generations,
      population: num('--population') ?? DEFAULT_CONFIG.population,
      elite: num('--elite') ?? DEFAULT_CONFIG.elite,
      corpusMode: process.argv.includes('--all-malicious') ? 'all' : DEFAULT_CONFIG.corpusMode,
    },
  });
  const m = result.champion.holdout!.metrics;
  console.log('');
  console.log('SHPBL ANTIBODY REACTOR');
  console.log('======================');
  console.log(`External corpus : ${result.corpus.total} samples (${result.corpus.version ?? 'unknown version'}, ${result.config.corpusMode})`);
  console.log(`Split           : ${result.corpus.train} train / ${result.corpus.validation} validation / ${result.corpus.holdout} sealed holdout`);
  console.log(`Generations     : ${result.config.generations}`);
  console.log(`Champion        : ${result.champion.id} (generation ${result.champion.generation})`);
  console.log(`Rules           : ${result.champion.rules.length} @ threshold ${result.champion.threshold}`);
  console.log(`Holdout recall  : ${pct(m.recall)}`);
  console.log(`Holdout FPR*    : ${pct(m.falsePositiveRate)} (*corpus-labeled benign disagreement; see REPORT.md)`);
  console.log(`Holdout F1*     : ${pct(m.f1)}`);
  console.log(`Holdout MCC*    : ${m.mcc.toFixed(4)}`);
  console.log(`Fitness         : ${m.fitness.toFixed(3)}`);
  console.log(`Ledger verified : ${result.ledger.verified} (${result.ledger.entries} entries)`);
  console.log(`Vaccine         : ${result.vaccine.id}`);
  console.log(`Artifacts       : ${out}`);
}

async function verifyCommand(): Promise<void> {
  const ledgerPath = arg('--ledger');
  if (!ledgerPath) throw new Error('--ledger is required');
  const entries = JSON.parse(await readFile(path.resolve(ledgerPath), 'utf8')) as LedgerEntry[];
  const check = verifyLedgerEntries(entries);
  console.log(JSON.stringify({ file: path.resolve(ledgerPath), entries: entries.length, ...check }, null, 2));
  if (!check.valid) process.exitCode = 1;
}

async function scanCommand(): Promise<void> {
  const vaccinePath = arg('--vaccine');
  const filePath = arg('--file');
  if (!vaccinePath || !filePath) throw new Error('--vaccine and --file are required');
  const vaccine = JSON.parse(await readFile(path.resolve(vaccinePath), 'utf8')) as VaccineArtifact;
  const content = await readFile(path.resolve(filePath), 'utf8');
  const scanner = new AntibodyReactorScanner(vaccine);
  console.log(JSON.stringify(scanner.scanDetailed(content, path.basename(filePath)), null, 2));
}


async function crossValidateCommand(): Promise<void> {
  const corpusPath = arg('--corpus');
  if (!corpusPath) throw new Error('--corpus is required');
  const out = path.resolve(arg('--out') ?? 'artifacts/oasb-cv5');
  const folds = num('--folds') ?? 5;
  const result = await runCrossValidation({
    corpusPath: path.resolve(corpusPath), outputDir: out, folds,
    config: {
      seed: num('--seed') ?? DEFAULT_CONFIG.seed,
      generations: num('--generations') ?? DEFAULT_CONFIG.generations,
      population: num('--population') ?? DEFAULT_CONFIG.population,
      elite: num('--elite') ?? DEFAULT_CONFIG.elite,
    },
  });
  console.log(`Out-of-fold attack recall: ${result.aggregate.detected}/${result.aggregate.malicious} = ${pct(result.aggregate.recall)}`);
  console.log(`Corpus-labeled safe disagreement*: ${result.aggregate.safeFlagged}/${result.aggregate.safeLabeled} = ${pct(result.aggregate.safeDisagreementRate)}`);
  console.log(`Artifacts: ${out}`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'run') return runCommand();
  if (command === 'crossvalidate') return crossValidateCommand();
  if (command === 'verify') return verifyCommand();
  if (command === 'scan') return scanCommand();
  console.error('Usage:\n  antibody-reactor run --corpus /path/to/oasb/corpus/v2.json [--out artifacts] [--seed N] [--generations N] [--population N]\n  antibody-reactor crossvalidate --corpus /path/to/oasb/corpus/v2.json [--folds 5]\n  antibody-reactor scan --vaccine vaccine.json --file artifact.md\n  antibody-reactor verify --ledger evidence-ledger.json');
  process.exitCode = 2;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
