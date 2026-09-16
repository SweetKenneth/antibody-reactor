import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CorpusEnvelope, CorpusSample, ReactorConfig } from './types.js';
import { crossValidationSplit } from './split.js';
import { runReactor, DEFAULT_CONFIG } from './reactor.js';

export interface CrossValidationFoldResult {
  fold: number;
  train: number;
  validation: number;
  holdout: number;
  malicious: number;
  detected: number;
  safeLabeled: number;
  safeFlagged: number;
  recall: number;
  safeDisagreementRate: number;
  championId: string;
  championGeneration: number;
  ruleCount: number;
  threshold: number;
  categoryMetrics: Array<{ category: string; malicious: number; detected: number; recall: number }>;
}

export interface CrossValidationResult {
  schema: 'shpbl.antibody-reactor.crossvalidation/v1';
  folds: number;
  corpusMode: 'oasb-categorized';
  corpusSamples: number;
  config: ReactorConfig;
  foldResults: CrossValidationFoldResult[];
  aggregate: {
    malicious: number;
    detected: number;
    recall: number;
    safeLabeled: number;
    safeFlagged: number;
    safeDisagreementRate: number;
    categories: Array<{ category: string; malicious: number; detected: number; recall: number }>;
  };
  caveat: string;
}

function parse(raw: string): CorpusEnvelope {
  const parsed = JSON.parse(raw) as CorpusEnvelope;
  if (!Array.isArray(parsed.samples)) throw new Error('Expected corpus samples[]');
  return parsed;
}

export async function runCrossValidation(params: {
  corpusPath: string;
  outputDir: string;
  folds?: number;
  config?: Partial<ReactorConfig>;
}): Promise<CrossValidationResult> {
  const folds = params.folds ?? 5;
  const raw = await readFile(params.corpusPath, 'utf8');
  const envelope = parse(raw);
  const samples: CorpusSample[] = envelope.samples.filter(s => s.label !== 'malicious' || Boolean(s.category));
  const config: ReactorConfig = { ...DEFAULT_CONFIG, ...(params.config ?? {}), corpusMode: 'oasb-categorized' };
  const foldResults: CrossValidationFoldResult[] = [];
  await mkdir(params.outputDir, { recursive: true });

  for (let fold = 0; fold < folds; fold++) {
    const partition = crossValidationSplit(samples, fold, folds);
    const tempDir = path.join(params.outputDir, `.fold-${fold}-work`);
    const run = await runReactor({
      corpusPath: params.corpusPath,
      outputDir: tempDir,
      config,
      partitionOverride: partition,
      partitionLabel: `${folds}-fold CV: fold ${fold} held out; remaining samples deterministically split 75/25 train/validation`,
    });
    const h = run.champion.holdout!.metrics;
    const malicious = h.tp + h.fn;
    const safeLabeled = h.tn + h.fp;
    const compact: CrossValidationFoldResult = {
      fold,
      train: partition.train.length,
      validation: partition.validation.length,
      holdout: partition.holdout.length,
      malicious,
      detected: h.tp,
      safeLabeled,
      safeFlagged: h.fp,
      recall: h.recall,
      safeDisagreementRate: h.falsePositiveRate,
      championId: run.champion.id,
      championGeneration: run.champion.generation,
      ruleCount: run.champion.rules.length,
      threshold: run.champion.threshold,
      categoryMetrics: run.champion.holdout!.categoryMetrics,
    };
    foldResults.push(compact);
    await writeFile(path.join(params.outputDir, `fold-${fold}.json`), JSON.stringify(compact, null, 2));
    await rm(tempDir, { recursive: true, force: true });
  }

  const malicious = foldResults.reduce((n, f) => n + f.malicious, 0);
  const detected = foldResults.reduce((n, f) => n + f.detected, 0);
  const safeLabeled = foldResults.reduce((n, f) => n + f.safeLabeled, 0);
  const safeFlagged = foldResults.reduce((n, f) => n + f.safeFlagged, 0);
  const cats = new Map<string, { malicious: number; detected: number }>();
  for (const fold of foldResults) {
    for (const c of fold.categoryMetrics) {
      const current = cats.get(c.category) ?? { malicious: 0, detected: 0 };
      current.malicious += c.malicious;
      current.detected += c.detected;
      cats.set(c.category, current);
    }
  }
  const categories = [...cats.entries()].map(([category, c]) => ({
    category,
    ...c,
    recall: c.malicious ? c.detected / c.malicious : 0,
  })).sort((a, b) => a.category.localeCompare(b.category));

  const result: CrossValidationResult = {
    schema: 'shpbl.antibody-reactor.crossvalidation/v1',
    folds,
    corpusMode: 'oasb-categorized',
    corpusSamples: samples.length,
    config,
    foldResults,
    aggregate: {
      malicious, detected, recall: malicious ? detected / malicious : 0,
      safeLabeled, safeFlagged, safeDisagreementRate: safeLabeled ? safeFlagged / safeLabeled : 0,
      categories,
    },
    caveat: 'Every categorized malicious fixture is out-of-fold once. Safe/benign disagreement is retained as selection counter-pressure but should not be marketed as real-world FPR because OASB documents scanner-selection bias in much of its registry benign class.',
  };
  await writeFile(path.join(params.outputDir, 'cross-validation.json'), JSON.stringify(result, null, 2));
  const rows = categories.map(c => `| ${c.category} | ${c.detected}/${c.malicious} | ${(c.recall * 100).toFixed(1)}% |`).join('\n');
  await writeFile(path.join(params.outputDir, 'REPORT.md'), `# Antibody Reactor — ${folds}-fold OASB validation\n\n` +
    `Each OASB categorized malicious fixture is held out exactly once from the population that scores it.\n\n` +
    `**Out-of-fold attack recall: ${detected}/${malicious} = ${(result.aggregate.recall * 100).toFixed(2)}%**\n\n` +
    `Corpus-labeled safe disagreement: ${safeFlagged}/${safeLabeled} = ${(result.aggregate.safeDisagreementRate * 100).toFixed(2)}% (not a real-world FPR claim; see caveat).\n\n` +
    `| Category | Detected | Recall |\n|---|---:|---:|\n${rows}\n`);
  return result;
}
