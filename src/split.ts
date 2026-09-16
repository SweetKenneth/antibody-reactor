import type { CorpusSample } from './types.js';
import { sha256 } from './hash.js';

export interface CorpusSplit { train: CorpusSample[]; validation: CorpusSample[]; holdout: CorpusSample[] }

function bucket(id: string, salt: string): number {
  const hex = sha256(`${salt}:${id}`).slice(0, 8);
  return parseInt(hex, 16) % 10000;
}

export function splitCorpus(samples: readonly CorpusSample[], salt = 'shpbl-antibody-reactor-v2'): CorpusSplit {
  const train: CorpusSample[] = [];
  const validation: CorpusSample[] = [];
  const holdout: CorpusSample[] = [];
  for (const sample of samples) {
    const b = bucket(sample.id, salt);
    if (b < 6500) train.push(sample);
    else if (b < 8500) validation.push(sample);
    else holdout.push(sample);
  }
  return { train, validation, holdout };
}


export function crossValidationSplit(
  samples: readonly CorpusSample[],
  fold: number,
  folds = 5,
  salt = 'shpbl-antibody-reactor-cv1',
): CorpusSplit {
  if (!Number.isInteger(fold) || fold < 0 || fold >= folds) throw new Error('invalid cross-validation fold');
  const train: CorpusSample[] = [];
  const validation: CorpusSample[] = [];
  const holdout: CorpusSample[] = [];
  for (const sample of samples) {
    const testFold = bucket(sample.id, `${salt}:test`) % folds;
    if (testFold === fold) {
      holdout.push(sample);
      continue;
    }
    // Roughly 25% of the remaining 80% becomes validation -> 20% total.
    const v = bucket(sample.id, `${salt}:validation:${fold}`) % 4;
    if (v === 0) validation.push(sample); else train.push(sample);
  }
  return { train, validation, holdout };
}
