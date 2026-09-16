# Test results — v0.2.0

Recorded from a clean checkout: `npm install && npm run build && npm test`.

- Build: `tsc -p tsconfig.json` under `strict` with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `noImplicitOverride`. Zero errors, zero suppressions (`@ts-ignore`/`@ts-expect-error` count: 0).
- Runtime: no dependencies. `typescript` and `@types/node` are dev-only.
- Verified locally on Node 22.22.0 (Linux x64). CI additionally exercises Node 20 on every push: `.github/workflows/ci.yml`.

```text
ok 1 - evaluation rewards detection without benign regression
ok 2 - rule discovery learns content evidence and never sample IDs
ok 3 - logical clock is monotonic, reproducible and independent of wall time
ok 4 - an anchored ledger binds its chain to one corpus and seed
ok 5 - ledger detects payload tampering, reordering and truncation
ok 6 - duplicate sample ids are refused instead of silently contaminating splits
ok 7 - malformed and degenerate corpora fail loudly
ok 8 - invalid configuration is rejected
ok 9 - two runs of the same seed produce byte-identical evidence
ok 10 - a different seed produces a different run, so nothing is hard-coded
ok 11 - lineage, generation accounting and holdout isolation hold after a real run
ok 12 - no corpus sample id ever reaches a published artifact
ok 13 - evidence ledger forms and verifies a hash chain
ok 14 - reactor breeds a champion and emits a vaccine
ok 15 - rehearsal blocks compound security regressions
ok 16 - sample id cannot change scanner classification
ok 17 - split is deterministic and mutually exclusive
ok 18 - cross validation holds every sample out exactly once
# tests 18
# pass 18
# fail 0
# duration_ms 452.231558
```

## What each group establishes

**Reproducibility.** Tests 3, 9 and 10. Two runs of the same seed produce byte-identical `champion.json`, `vaccine.json`, `evidence-ledger.json`, `lineage.json`, `fossil-record.json`, `generations.json`, `rehearsals.json` and `run-summary.json`; a different seed produces a different run, so nothing is hard-coded.

**Evidence integrity.** Tests 4, 5 and 13. The chain is anchored to `sha256(corpusSha256:seed)`; an internally valid chain from a different seed fails verification against this run's anchor; payload tampering, entry reordering and truncation are all detected with the breaking index reported.

**Contamination and leakage.** Tests 2, 6, 11, 12, 16 and 18. Duplicate sample ids are refused before partitioning; the holdout is not tokenized until one champion exists; cross-validation holds every sample out exactly once; no corpus sample id reaches any published artifact; a sample id cannot change a scanner verdict.

**Untrusted input.** Tests 7 and 8. Truncated JSON, wrong envelope shape, empty corpus, missing id, missing label, samples over 1 MB, all-benign corpora, and non-integer or non-positive configuration are each rejected with a specific message.

**Lineage truthfulness.** Test 11. No strain records a duplicate parent edge or itself as a parent, every generation reports how many members were bred versus cloned, and the partition sizes sum to the corpus total.

## Full-corpus verification against the published run

Re-run against OASB commit `fddf2b1379c5597a3e83a3c6f7833b8e5613a04e`, corpus SHA-256 `3ca866a0e637fa198bae17cd3a8f31fb02ad20f50fedcac1caa290e6dceba14e`:

| Measure | v0.1.1 | v0.2.0 |
|---|---|---|
| Champion | `def-g24-c7fbd215ef` | `def-g24-c7fbd215ef` |
| Genome | 41 rules @ 11.0459 | 41 rules @ 11.0459 |
| Sealed-holdout attack recall | 29/34 = 85.29% | 29/34 = 85.29% |
| Five-fold out-of-fold attack recall | 220/270 = 81.48% | 220/270 = 81.48% |
| Per-category out-of-fold counts | — | byte-identical |
| Out-of-fold benign disagreement | 49/3,975 | 49/3,975 |
| Ledger entries | 4,454 | 4,454 |
| Ledger reproducible across runs | no | yes |

The remediation did not move the science. That was the intent, and it was checked rather than assumed.
