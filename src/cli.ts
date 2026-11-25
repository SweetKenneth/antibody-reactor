#!/usr/bin/env node
import path from 'node:path';
import { readBoundedText } from './bounded-read.js';
import { runReactor, DEFAULT_CONFIG } from './reactor.js';
import { verifyLedgerEntries } from './ledger.js';
import { sha256 } from './hash.js';
import { validateVaccine, policyFingerprint } from './vaccine-validate.js';
import { loadTrustedRelease, type TrustedRelease } from './trust.js';
import { loadSamples, evaluateFrozen } from './independent.js';
import { mkdir, writeFile } from 'node:fs/promises';
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
  const m = result.champion.holdout?.metrics;
  if (!m) throw new Error('holdout metrics missing');
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

async function trustedPins(): Promise<TrustedRelease | undefined> {
  const file = arg('--trusted');
  if (!file) return undefined;
  const release = arg('--release');
  if (!release) throw new Error('--trusted requires --release <version>');
  return loadTrustedRelease(path.resolve(file), release);
}

async function verifyCommand(): Promise<void> {
  const ledgerPath = arg('--ledger');
  if (!ledgerPath) throw new Error('--ledger is required');
  const raw = await readBoundedText(path.resolve(ledgerPath), 64 * 1024 * 1024);
  const fileSha256 = sha256(raw);
  const pins = await trustedPins();
  const expectAnchor = arg('--expect-anchor') ?? pins?.ledger.anchor;
  const expectHead = arg('--expect-head') ?? pins?.ledger.head;
  const expectEntries = num('--expect-entries') ?? pins?.ledger.entries;
  let entries: unknown;
  try { entries = JSON.parse(raw); } catch { entries = undefined; }
  const check = verifyLedgerEntries(entries, expectAnchor, { ...(expectHead === undefined ? {} : { expectedHead: expectHead }), ...(expectEntries === undefined ? {} : { expectedEntries: expectEntries }) });
  const fileMatches = pins ? fileSha256 === pins.ledger.fileSha256 : undefined;
  if (fileMatches === false) { check.valid = false; check.reason ??= 'ledger file SHA-256 does not match trusted pin'; }
  const pinned = expectAnchor !== undefined && expectHead !== undefined;
  console.log(JSON.stringify({
    file: path.resolve(ledgerPath), fileSha256, entries: Array.isArray(entries) ? entries.length : null, ...check, fileMatches,
    trust: pinned ? 'pinned' : 'self-consistency only: the chain is internally valid but nothing ties it to a trusted head; a rewritten and re-chained ledger would also pass',
  }, null, 2));
  if (!check.valid) process.exitCode = 1;
  else if (!pinned && process.argv.includes('--require-pins')) process.exitCode = 1;
}

async function loadVaccine(vaccinePath: string): Promise<{ vaccine: VaccineArtifact; fileSha256: string; pinned: boolean }> {
  const raw = await readBoundedText(path.resolve(vaccinePath), 2 * 1024 * 1024);
  const fileSha256 = sha256(raw);
  const pins = await trustedPins();
  const expected = arg('--vaccine-sha256') ?? pins?.vaccine.fileSha256;
  if (expected !== undefined && expected !== fileSha256) throw new Error(`vaccine file SHA-256 ${fileSha256} does not match trusted pin ${expected}`);
  const vaccine = JSON.parse(raw) as VaccineArtifact;
  const v = validateVaccine(vaccine);
  if (!v.ok) throw new Error(`vaccine rejected: ${v.errors.join('; ')}`);
  if (pins && policyFingerprint(vaccine) !== pins.vaccine.policyFingerprint) throw new Error('vaccine policy fingerprint does not match trusted pin');
  return { vaccine, fileSha256, pinned: expected !== undefined };
}

async function scanCommand(): Promise<void> {
  const vaccinePath = arg('--vaccine');
  const filePath = arg('--file');
  if (!vaccinePath || !filePath) throw new Error('--vaccine and --file are required');
  let vaccine: VaccineArtifact;
  let pinned = false;
  try { ({ vaccine, pinned } = await loadVaccine(vaccinePath)); }
  catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 4; return; }
  const maxBytes = num('--max-bytes');
  let content: string;
  try { content = await readBoundedText(path.resolve(filePath), maxBytes ?? 1024 * 1024); }
  catch (e) { console.log(JSON.stringify({ verdict: 'unknown', error: e instanceof Error ? e.message : 'input read failed', mode: 'advisory' })); process.exitCode = 3; return; }
  const scanner = new AntibodyReactorScanner(vaccine, maxBytes === undefined ? {} : { maxInputBytes: maxBytes });
  const result = scanner.scanDetailed(content, path.basename(filePath));
  console.log(JSON.stringify({ ...result, policyFingerprint: scanner.policyFingerprint, mode: 'advisory: this command never enforces', integrity: pinned ? 'pinned' : 'unpinned: structure validated, but a plausible hand-edited policy would also pass; pin with --vaccine-sha256 or --trusted' }, null, 2));
  if (result.verdict === 'unknown') process.exitCode = 3;
}

async function validateVaccineCommand(): Promise<void> {
  const vaccinePath = arg('--vaccine');
  if (!vaccinePath) throw new Error('--vaccine is required');
  try {
    const { vaccine, fileSha256, pinned } = await loadVaccine(vaccinePath);
    console.log(JSON.stringify({ ok: true, integrity: pinned ? 'pinned' : 'unpinned: structure only', id: vaccine.id, fileSha256, policyFingerprint: policyFingerprint(vaccine), rules: vaccine.policy.rules.length }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }, null, 2));
    process.exitCode = 4;
  }
}

async function independentCommand(): Promise<void> {
  const vaccinePath = arg('--vaccine');
  const out = arg('--out');
  const files = process.argv.flatMap((a, i) => {
    if (a !== '--samples') return [];
    const file = process.argv[i + 1];
    if (!file || file.startsWith('--')) throw new Error('--samples requires a path');
    return [file];
  });
  if (!vaccinePath || !files.length) throw new Error('--vaccine and at least one --samples are required');
  const { vaccine, fileSha256, pinned } = await loadVaccine(vaccinePath);
  const sets = [];
  for (const f of files) {
    const { sha, samples } = await loadSamples(path.resolve(f));
    sets.push(evaluateFrozen(vaccine, path.basename(f), sha, samples));
  }
  const report = { schema: 'shpbl.antibody-reactor.independent-eval/v1', integrity: pinned ? 'pinned' : 'unpinned: structure only', vaccine: { id: vaccine.id, fileSha256, policyFingerprint: policyFingerprint(vaccine) }, training: 'none: frozen vaccine, no threshold or rule changes', sets };
  if (out) { await mkdir(path.dirname(path.resolve(out)), { recursive: true }); await writeFile(path.resolve(out), JSON.stringify(report, null, 2)); }
  for (const s of sets) console.log(`${s.name}: recall ${s.detected}/${s.malicious} = ${pct(s.recall)}, benign flagged ${s.flaggedBenign}/${s.benign} = ${pct(s.falsePositiveRate)}, unknown ${s.unknown}`);
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
  if (command === 'validate-vaccine') return validateVaccineCommand();
  if (command === 'independent') return independentCommand();
  console.error('Usage:\n  antibody-reactor run --corpus /path/to/oasb/corpus/v2.json [--out artifacts] [--seed N] [--generations N] [--population N]\n  antibody-reactor crossvalidate --corpus /path/to/oasb/corpus/v2.json [--folds 5]\n  antibody-reactor scan --vaccine vaccine.json --file artifact.md [--vaccine-sha256 HEX | --trusted TRUSTED-FINGERPRINTS.json --release V] [--max-bytes N]\n  antibody-reactor validate-vaccine --vaccine vaccine.json [--trusted F --release V]\n  antibody-reactor verify --ledger evidence-ledger.json [--trusted F --release V | --expect-anchor A --expect-head H --expect-entries N] [--require-pins]\n  antibody-reactor independent --vaccine vaccine.json --samples set.json [--samples ...] [--out report.json]');
  process.exitCode = 2;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
