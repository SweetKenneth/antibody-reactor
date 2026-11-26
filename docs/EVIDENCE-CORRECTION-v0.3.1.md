# v0.3.1 evidence correction — verified accounting

Date: 2026-11-26. Status: correction candidate, not published. Latest public release: v0.3.0. The scanner remains advisory/shadow-only and no certification or leaderboard ranking is requested.

## Why this correction exists

The earlier public reply combined **220 true positives and 50 false negatives from five-fold evolutionary validation** with **52 alleged false positives from one frozen champion**, then reported 80.88% precision and 81.18% F1. Those cells did not come from one scanner's predictions over one dataset. The precision and F1 claim is withdrawn.

A direct reproduction found a second error: the alleged **52/177** frozen-champion benign flags do not reproduce. Both the released v0.2.0 scanner and the released v0.3.0 scanner, using the pinned v0.2.0 vaccine and OASB's exact PR #411 selection predicate, flag **9/177**. The 52/177 figure cannot be derived from the original artifacts and is withdrawn rather than preserved as a valid observation.

No earlier GitHub comment, release artifact, evolutionary result or historical audit record has been edited or concealed by this candidate.

## Experiment A — five-fold evolutionary cross-validation

Source artifacts:

- `artifacts/oasb-cv5/cross-validation.json`
- `artifacts/oasb-cv5/fold-0.json` through `fold-4.json`

Reconstruction sums the five original fold records and compares each fold file byte-content parsed as JSON with its embedded fold summary. The five champion IDs are distinct; this is not one frozen vaccine.

| Measure | Verified value | Meaning |
|---|---:|---|
| Categorized attacks | 270 | Nine families, 30 each |
| Out-of-fold detected | 220 | Sum of five independently trained populations |
| Out-of-fold missed | 50 | 270 − 220 |
| Recall | **220/270 = 81.48%** | Evolutionary-procedure result |
| Corpus-labelled non-malicious/edge samples | 3,975 | 3,881 `benign` + 94 `edge_case` |
| Flagged in that labelled pool | 49 | Corpus-label disagreement, not a real-world FPR |

This remains valid as **five-fold out-of-fold categorized-attack recall**. It is not a frozen-scanner confusion matrix and must not be combined with another experiment's benign count.

## Experiment B — one frozen v0.2.0 champion over OASB PR #411's stated set

Inputs:

- Vaccine `vax-c45267d9173363`, file SHA-256 `8837f2bfe3f58f23f0a608d0380113c16cfacb35501e64e0d0773502540f6ded`.
- Policy fingerprint `1da0784ee730f213aaf105ef86dbdbc9d29cc4b527a190cc5ba5301e0437901c`.
- OASB `corpus/v2.json`, SHA-256 `3ca866a0e637fa198bae17cd3a8f31fb02ad20f50fedcac1caa290e6dceba14e`.
- OASB PR #411 merge revision `8e4ed173f9a814cf61ade0ff48fe4a9b6a50847f`.
- Exact OASB predicate: categorized malicious samples plus benign samples without `metadata.scanVerdict`; 270 + 177 = 447 samples. No fixture IDs participate in classification.

The same frozen policy produced every cell:

| TP | FP | FN | TN | Unknown |
|---:|---:|---:|---:|---:|
| 229 | 9 | 41 | 168 | 0 |

| Measure | Derivation | Result |
|---|---|---:|
| Precision | 229 / (229 + 9) | **96.22%** |
| Recall | 229 / (229 + 41) | **84.81%** |
| F1 | 2PR / (P + R) | **90.16%** |
| False-positive rate | 9 / (9 + 168) | **5.08%** |

These are **research-only, training-exposed frozen-policy measurements**. The 177 hand-written benign fixtures were already present in the pinned corpus used for evolutionary selection, just like the 270 attacks. OASB's phrase "no scanner labeled" means those fixtures lack scanner-derived registry labels; it does not make them unseen by Antibody Reactor. Neither this FPR nor this F1 is independent validation or a leaderboard submission.

Reproduce the committed result:

```bash
git clone https://github.com/opena2a-org/oasb
git -C oasb checkout 8e4ed173f9a814cf61ade0ff48fe4a9b6a50847f
npm install
OASB_DIR=/path/to/oasb npm run audit:evidence
npm run verify:evidence
```

The generator refuses a different corpus hash, a vaccine that does not match the trusted v0.2.0 pins, an unknown verdict, duplicate sample IDs, or a sample set other than 270 + 177. `src/evidence.ts` also refuses to calculate a metric from predictions with different evaluation IDs, dataset hashes or policy fingerprints.

## Experiment C — genuinely unseen external test sets

The frozen-policy results in `artifacts/independent-v0.3.0/results.json` remain separate and unchanged:

| Set | Malicious detected | Benign flagged | Boundary |
|---|---:|---:|---|
| deepset prompt injections | 0/60 | 0/56 | Third-party, unseen; distribution shift |
| jackhhao jailbreaks | 49/139 | 1/123 | Third-party, unseen; distribution shift |
| Authored agent artifacts | 6/24 | 1/24 | In-domain but not independent |

These disappointing generalisation results remain the reason the scanner is not production-ready as a sole gate. The corrected OASB arithmetic does not improve or replace them.

## Published status and preservation

- v0.2.0 and v0.3.0 tags and release artifacts are unchanged.
- The original `artifacts/oasb-final/**`, `artifacts/oasb-cv5/**`, `artifacts/independent-v0.3.0/results.json`, parent manifest and trusted vaccine/ledger pins are checksum-verified.
- `docs/AUDIT-v0.3.0.md` and `docs/REAUDIT-v0.3.0.md` retain their historical text with dated addenda.
- The v0.3.0 GitHub release body still contains the superseded public wording. Changing that public release record and posting the OASB follow-up require founder approval; neither is done by this candidate.

## Remaining production blockers

1. Real operator identity, trusted human labels and alert delivery in an authorized environment.
2. A genuinely untouched, representative agent-artifact evaluation with an independent evaluator.
3. Target-environment shadow/canary/rollback, expiry, recovery and realistic-load exercises.
4. Independent review of the frozen candidate and evidence before any v1.0.0 claim.
