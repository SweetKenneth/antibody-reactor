import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const currentDocs = [
  'README.md', 'SUBMISSION.md', 'TEST-RESULTS.md', 'CHANGELOG.md', 'SECURITY.md',
  'docs/INDEPENDENT-VALIDATION.md', 'docs/AUDIT-v0.3.0.md', 'docs/REAUDIT-v0.3.0.md',
  'docs/PRODUCTION-SAFEGUARDS.md', 'docs/OASB-EVALUATION-NOTE.md', 'docs/SUBMISSION-RECORD.md',
  'THIRD_PARTY.md', 'CITATION.cff',
];
const withdrawn = [/80\.88\s*%/, /81\.18\s*%/, /52\s*\/\s*177/, /220\s+TP,\s*52\s+FP/i, /Only the false-positive rate is out-of-sample/i];
for (const rel of currentDocs) {
  const text = await readFile(rel, 'utf8');
  for (const pattern of withdrawn) {
    for (const line of text.split('\n').filter(line => pattern.test(line))) {
      assert.match(line, /withdrawn|superseded|did not reproduce|not reproduced|earlier|previous/i, `${rel}: unqualified withdrawn or mixed claim remains: ${line}`);
    }
  }
}
const validation = await readFile('docs/INDEPENDENT-VALIDATION.md', 'utf8');
for (const required of ['229 | 9 | 41 | 168', '96.22%', '84.81%', '90.16%', '5.08%', 'training-exposed']) {
  assert.ok(validation.includes(required), `docs/INDEPENDENT-VALIDATION.md: corrected measurement missing: ${required}`);
}
const readme = await readFile('README.md', 'utf8');
assert.match(readme, /v0\.3\.0[^\n]*released/i);
assert.match(readme, /v0\.3\.1[^\n]*candidate/i);
const provenance = JSON.parse(await readFile('PROVENANCE.json', 'utf8'));
const audit = JSON.parse(await readFile('artifacts/evidence-audit-v0.3.1/results.json', 'utf8'));
assert.equal(provenance.current_release.version, '0.3.0');
assert.equal(provenance.correction_v0_3_1.status, 'candidate, not published');
assert.deepEqual(provenance.correction_v0_3_1.frozen_oasb_pr411.confusion, {
  tp: audit.frozenOasbPr411.tp, fp: audit.frozenOasbPr411.fp, fn: audit.frozenOasbPr411.fn, tn: audit.frozenOasbPr411.tn,
});

const historical = JSON.parse(await readFile('artifacts/independent-v0.3.0/results.json', 'utf8'));
for (const [file, label, falseFlags, benignCount] of [
  ['deepset-prompt-injections-test.json', 'deepset prompt-injection test', 0, 56],
  ['jackhhao-jailbreak-test.json', 'jackhhao jailbreak test', 1, 123],
  ['authored-agent-artifacts.json', 'SHPBL-authored agent artifacts', 1, 24],
]) {
  const s = historical.sets.find(item => item.name === file);
  assert.ok(s, `missing historical test set: ${file}`);
  assert.equal(s.flaggedBenign, falseFlags, `${file}: unexpected benign-flag count in original evidence`);
  assert.equal(s.benign, benignCount, `${file}: unexpected benign denominator in original evidence`);
  const row = validation.split('\n').find(line => line.startsWith(`| ${label} |`));
  assert.ok(row, `independent-validation row missing: ${label}`);
  assert.ok(row.includes(`${s.detected} / ${s.malicious}`), `${label}: malicious detections differ from evidence`);
  assert.ok(row.includes(`${s.flaggedBenign} / ${s.benign}`), `${label}: benign flags differ from evidence`);
}
const parents = JSON.parse(await readFile('.shpbl/parents/manifest.json', 'utf8'));
assert.equal(parents.parents.length, 6);
for (const parent of parents.parents) {
  assert.ok(readme.includes(parent.unit), `README missing source capability: ${parent.unit}`);
  assert.ok(readme.includes(parent.seal), `README missing source seal: ${parent.seal}`);
}
assert.doesNotMatch(readme, /CML-ANTIBODY-|DurableDeploymentStore|promoteCanary|policySha256|npm ci\b/);
assert.match(readme, /evolutionary selection pressure/i);
assert.match(readme, /npm install --no-package-lock/);
assert.match(readme, /expectedPolicyFingerprint: release\.vaccine\.policyFingerprint/);
const repro = await readFile('scripts/reproduce.sh', 'utf8');
const auditScript = await readFile('scripts/audit-evidence.mjs', 'utf8');
assert.match(auditScript, /process\.env\.OASB_DIR/);
assert.match(repro, /OASB_DIR/);
assert.match(repro, /exit 2/);
assert.match(validation, /OASB_DIR/);
assert.doesNotMatch(validation, /OASB_CORPUS|OASB_REPO/);
console.log('Unseen-test counts, SHPBL provenance and README instructions agree with source evidence.');

console.log('Current public claims are internally consistent; withdrawn mixed-experiment metrics are absent.');
