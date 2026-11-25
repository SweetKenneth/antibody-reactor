# Test results — v0.3.0 candidate

Recorded on branch `hardening/v0.3.0`, Node 22, `npm install && npm test`: **64 / 64 pass** (18 carried from v0.2.0, 46 new in `test/v030.test.ts`).

Additional evidence:
- `npm run verify:ledger` (pinned to the v0.2.0 head, anchor, entry count and file SHA-256): valid.
- Re-running `run --seed 20260916 --generations 24 --population 40 --elite 8` and `crossvalidate --folds 5` against OASB `corpus/v2.json` (SHA-256 `3ca866a0…`) after all changes: 10/10 and 7/7 artifacts byte-identical to the committed v0.2.0 artifacts. Champion, 29/34 holdout recall and 220/270 out-of-fold recall unchanged.
- Independent evaluation: see `docs/INDEPENDENT-VALIDATION.md`.

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
ok 19 - V1 empty input is not reported as 99% safe
ok 20 - V1 confidence stays inside its documented band and is 0.5 at the threshold
ok 21 - V2 the published v0.2.0 vaccine validates
ok 22 - V2 rejects vaccine: unreachable threshold
ok 23 - V2 rejects vaccine: string threshold
ok 24 - V2 rejects vaccine: zero threshold
ok 25 - V2 rejects vaccine: NaN weight
ok 26 - V2 rejects vaccine: negative weights
ok 27 - V2 rejects vaccine: no rules
ok 28 - V2 rejects vaccine: duplicate rule id
ok 29 - V2 rejects vaccine: duplicate term
ok 30 - V2 rejects vaccine: uppercase term (can never match)
ok 31 - V2 rejects vaccine: oversized term
ok 32 - V2 rejects vaccine: bad source
ok 33 - V2 rejects vaccine: wrong schema
ok 34 - V2 rejects vaccine: policy missing
ok 35 - V2 rejects vaccine: champion/policy threshold disagree
ok 36 - V2 rejects vaccine: too many rules
ok 37 - V2 non-object vaccines are rejected
ok 38 - V3 a plausible hand-edited policy passes structure but fails the fingerprint pin
ok 39 - V3 trusted pins match the published files byte for byte
ok 40 - V3 scanner works on its own copy: mutating the input vaccine after construction changes nothing
ok 41 - V4 non-string and oversized input yields unknown, never benign
ok 42 - V4 default limit is 1 MiB
ok 43 - V5 OASB adapter scan() returns unknown instead of throwing on bad input
ok 44 - V5 invalid maxInputBytes is refused
ok 45 - V6 a rewritten and re-chained ledger is caught by the head pin
ok 46 - V6 the published ledger verifies against all trusted pins
ok 47 - V6 truncated ledger fails the entry-count and head pins
ok 48 - V6 empty, non-array and malformed ledgers are invalid, not crashes
ok 49 - V6 malformed trusted-fingerprints files are refused
ok 50 - V7 package and scanner versions agree
ok 51 - P3 default authorizer refuses activation: nothing deploys without explicit authority
ok 52 - P3 an authorizer that throws counts as refusal
ok 53 - P3 approval without approver or reason is refused
ok 54 - P3 shadow never blocks, even a malicious or unknown verdict
ok 55 - P3 promotion needs evidence first, then an authorized approval; never automatic
ok 56 - P3 envelope breach in canary rolls back automatically and stops blocking
ok 57 - P3 recall collapse in general rolls back
ok 58 - P3 a breached shadow cannot be promoted
ok 59 - P3 campaigns expire (24h default TTL from the antibody generator) and stop enforcing
ok 60 - P3 at most three concurrent campaigns (planCampaign limit)
ok 61 - P3 rollback and revoke need no approval; rolled-back cannot be promoted
ok 62 - P3 canary blocks only its deterministic traffic bucket
ok 63 - P3 the deployment ledger verifies and never stores credentials
ok 64 - P4 committed independent-evaluation results recompute exactly from the committed test sets
# tests 64
# pass 64
# fail 0
```

---

The v0.2.0 record below is preserved unchanged.

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
