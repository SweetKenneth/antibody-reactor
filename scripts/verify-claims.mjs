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
console.log('Current public claims are internally consistent; withdrawn mixed-experiment metrics are absent.');
