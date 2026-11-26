# Independent and research evaluation — evidence correction

## Principle

A metric belongs to one prediction set, one policy, and one dataset. Five-fold recall from five separately trained populations cannot be combined with benign predictions from one frozen champion to produce a meaningful F1. This document keeps those observations separate.

## 1. Five-fold evolutionary research result (preserve)

The original five-fold experiment used five independently trained populations and five distinct champion policies. Its original fold files reconstruct exactly:

| Observation | Count | Rate |
| --- | --- | --- |
| Held-out malicious detections | 220 / 270 | 81.48% recall |
| Corpus-label disagreements on the safe pool | 49 / 3,975 | 1.23% |

The safe pool is 3,881 benign plus 94 edge cases. The 1.23% value is not a field false-positive rate. This remains valid evolutionary research evidence; it is not a single frozen scanner's precision/F1 evaluation.

## 2. Frozen v0.2.0 champion on OASB PR #411 (training-exposed)

OASB PR #411 selects 270 categorized malicious samples and 177 hand-written benign samples. Running one pinned v0.2.0 vaccine over that exact set gives:

| TP | FP | FN | TN | Precision | Recall | F1 | Benign flag rate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 229 | 9 | 41 | 168 | 96.22% | 84.81% | 90.16% | 5.08% |

These values all derive from this single confusion matrix. The earlier 52/177 count did not reproduce under the pinned scanner and PR #411 selector and is withdrawn.

**Exposure boundary:** these 447 samples were part of the corpus that shaped evolution and selection. This is a training-exposed research measurement, not independent validation. It must not be advertised as an unseen-result F1.

## 3. Genuinely unseen frozen-policy evaluation (unchanged)

The committed post-v0.2.0 datasets were excluded from breeding and selection. One frozen champion produced:

| Dataset | Detected | Benign false alarms |
| --- | --- | --- |
| deepset prompt-injection test | 0 / 60 | 0 / 0 |
| jackhhao jailbreak test | 49 / 139 | 0 / 0 |
| SHPBL-authored agent artifacts | 6 / 24 | 0 / 6 |

No new training, vaccine change, or test-set tuning was performed for v0.3.1. The SHPBL-authored set is not independent evidence; it is labeled accordingly.

## 4. Withdrawn mixed calculation

The earlier public precision 80.88% and F1 81.18% used five-fold recall 220/270 with a different frozen champion's benign count. Those numerators and denominators did not describe one scanner over one prediction set. Both figures and the unreproduced 52/177 statement are withdrawn, not silently replaced.

`src/evidence.ts` and `test/evidence.test.ts` now reject mixed evaluation IDs, dataset hashes, and policy fingerprints. `npm run verify:evidence` reconstructs the accounting; `npm run verify:claims` checks current public documents.

## 5. Reproduction

The OASB corpus is intentionally not redistributed. Supply the exact pinned OASB JSON, then run:

```bash
npm run build
OASB_CORPUS=/path/to/oasb-corpus.json node scripts/audit-evidence.mjs
npm run verify:evidence
npm run verify:claims
```

The audit resolves the corpus using `OASB_CORPUS`, `OASB_REPO` (a checkout containing `corpus/v2.json`), or a candidate path supplied by the maintainer. It refuses an unverified corpus digest. Without the corpus it reconstructs the five-fold result and records why the frozen re-scan cannot run; it never fabricates the frozen result.

## 6. What remains necessary

A representative, untouched agent-artifact test set with independent labels and no training exposure is still required. Real authorization, trusted feedback, target-environment rollout/recovery tests, and external engineering review remain open. Antibody Reactor stays advisory/shadow-only.
