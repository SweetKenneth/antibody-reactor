import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evaluateFrozenOasb, reconstructFiveFold } from '../dist/evidence.js';
import { loadTrustedRelease } from '../dist/trust.js';
import { policyFingerprint } from '../dist/vaccine-validate.js';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const root = process.cwd();
const readJson = async rel => JSON.parse(await readFile(path.join(root, rel), 'utf8'));
const oasbDir = process.env.OASB_DIR;
if (!oasbDir) throw new Error('Set OASB_DIR to an OASB checkout at PR #411 merge commit 8e4ed173f9a814cf61ade0ff48fe4a9b6a50847f');

const provenance = await readJson('PROVENANCE.json');
const corpusPath = path.join(oasbDir, 'corpus/v2.json');
const corpusBytes = await readFile(corpusPath);
const corpusSha256 = sha256(corpusBytes);
if (corpusSha256 !== provenance.external_oracle.corpus_sha256) throw new Error(`corpus SHA-256 ${corpusSha256} does not match the published pin`);
const corpus = JSON.parse(corpusBytes.toString('utf8'));

const vaccinePath = 'artifacts/oasb-final/vaccine.json';
const vaccineBytes = await readFile(path.join(root, vaccinePath));
const vaccine = JSON.parse(vaccineBytes.toString('utf8'));
const pins = await loadTrustedRelease(path.join(root, 'TRUSTED-FINGERPRINTS.json'), '0.2.0');
if (sha256(vaccineBytes) !== pins.vaccine.fileSha256 || policyFingerprint(vaccine) !== pins.vaccine.policyFingerprint) {
  throw new Error('frozen vaccine does not match the trusted v0.2.0 pins');
}

const cv = await readJson('artifacts/oasb-cv5/cross-validation.json');
const foldFiles = await Promise.all(Array.from({ length: 5 }, (_, i) => readJson(`artifacts/oasb-cv5/fold-${i}.json`)));
const fiveFold = reconstructFiveFold(cv, foldFiles);
const frozen = evaluateFrozenOasb(vaccine, corpusSha256, corpus.samples);
if (frozen.malicious !== 270 || frozen.benign !== 177 || frozen.samples !== 447) {
  throw new Error(`expected OASB PR #411's 270 + 177 = 447 samples, got ${frozen.malicious} + ${frozen.benign}`);
}

const result = {
  schema: 'shpbl.antibody-reactor.evidence-audit/v1',
  correction: 'v0.3.1',
  sourceRevision: '8e4ed173f9a814cf61ade0ff48fe4a9b6a50847f',
  corpus: { path: 'corpus/v2.json', sha256: corpusSha256 },
  frozenVaccine: { id: vaccine.id, fileSha256: sha256(vaccineBytes), policyFingerprint: policyFingerprint(vaccine), release: 'v0.2.0' },
  fiveFold: {
    evaluationId: 'oasb-cv5-five-independent-populations',
    independentPolicies: true,
    ...fiveFold,
  },
  frozenOasbPr411: frozen,
  supersededClaims: [
    { claim: '52/177 benign fixtures flagged', status: 'not reproduced', corrected: `${frozen.fp}/177`, reason: 'Direct scans with both the v0.2.0 and v0.3.0 released scanners produce the corrected count.' },
    { claim: '80.88% precision and 81.18% F1', status: 'withdrawn', reason: 'The earlier calculation mixed five-fold recall from five policies with a separately reported frozen-policy benign count. The corrected frozen evaluation derives every cell from one policy and one 447-sample prediction set.' },
  ],
};
const out = path.join(root, 'artifacts/evidence-audit-v0.3.1/results.json');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Five-fold recall: ${fiveFold.detected}/${fiveFold.malicious} = ${(fiveFold.recall * 100).toFixed(2)}% (five policies)`);
console.log(`Frozen policy: TP ${frozen.tp}, FP ${frozen.fp}, FN ${frozen.fn}, TN ${frozen.tn}`);
console.log(`Frozen research-only metrics: precision ${(frozen.precision * 100).toFixed(2)}%, recall ${(frozen.recall * 100).toFixed(2)}%, F1 ${(frozen.f1 * 100).toFixed(2)}%, FPR ${(frozen.falsePositiveRate * 100).toFixed(2)}%`);
console.log(`Wrote ${path.relative(root, out)}`);
