# Test results

**Current status: v0.3.1 evidence-correction candidate; 99 tests pass, zero failures, zero skipped.** This is a local engineering result, not a GitHub Actions run and not a claim of production readiness. v0.3.0 remains the published release; v0.3.1 is not tagged.

## Candidate verification

```bash
npm ci
npm run build
npm test
npm run verify:release
```

- Strict TypeScript compilation: pass.
- 99 engineering/regression tests: pass, including six evidence-provenance tests and two release/dotfile checksum tests.
- Pinned evidence ledger and vaccine fingerprint verification: pass.
- Five-fold reconstruction and coherent frozen confusion-matrix verification: pass.
- Current-claim consistency check: pass; withdrawn mixed metrics are rejected.
- Historical artifact verification: 18 v0.2.0 evidence files and 19 v0.3.0 candidate evidence files unchanged.
- Candidate checksum manifest: complete file-set coverage, including dotfiles.
- Full evolutionary replay: 10/10 final-run files and 7/7 five-fold files byte-identical.

GitHub Actions passed on **Node 20 and Node 22** for candidate commit `e64f22588259969dc813c6f9b0f98dc7ef0b5e86`, after CI exposed and we fixed unsealed lockfile generation. The workflow is in `.github/workflows/ci.yml`; inspect the latest PR checks before merging any later commit.

## Historical transcripts (preserved)

The sections below are the original v0.3.0 engineering and stress records. They are retained as historical evidence, not rewritten to imply that old tests included the new evidence gates.

## Run 1 — post-hardening

```
$ npm test
# tests 64
# suites 0
# pass 64
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 12678.446208
```

Contains: all v0.2.0 regression tests (T1–T8, R1–R13) plus adversarial deployment regressions (A1–A5), durable-store tests (D1–D9), and checkpoint promotion test (D10).

## Run 2 — re-audit additions (checkpoint persistence, event envelope, size caps, approval guards)

```
$ npm test
# tests 85
# suites 0
# pass 85
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11857.563167
```

Contains all Run 1 tests plus 16 re-audit regressions (B1–B16):

- B1/B2 — crash-free `DeploymentController` construction and `observe()`
- B3/B4 — durable write failures (`state()`/`approve()`) poison the controller; `approve()` rethrows the cause
- B5/B6 — all synchronous terminal transitions fault durably before authorizing; `.state` alone cannot authorize
- B7/B8 — `authorized()` and `snapshot()` await pending writes; no stale read authorizes a transition
- B9 — oversized event caps (`requestId` ≤ 128, `note` ≤ 4000) and per-event sample cap (20)
- B10 — corrupt/truncated checkpoint recovers through immutable base events
- B11 — base-event digest mismatches and legacy checkpoints are refused
- B12/B13 — `promoteCanary()` validates the actor before mutation; `approve()` rejects a blank reason
- B14 — bounded inputs: non-finite thresholds, non-string sample IDs, invalid confidence, bad path, empty state
- B15 — `open()` rolls a truncated checkpoint back to a consistent hash chain
- B16 — `observe()` samples are counted, not stored unboundedly

## Run 3 — full published reproduction after re-audit

```
$ npm test
# pass 85
# fail 0
# skipped 0

$ ./scripts/reproduce.sh
# step 3 sealed-ledger verify: VALID, 40 events
# step 4 full run: reproduced, 10/10 byte-identical
# step 5 cross-validation: reproduced, 7/7 byte-identical
# champion id AR-VAC-OASB-006 unchanged
# sealed holdout matches 29/34 (1 holdout policy differs; variance documented in AUDIT-v0.3.0)
```

The research artifacts are unchanged: no new breeding, mutation, threshold tuning, or re-labeling was introduced by the engineering hardening.

## Stress smoke — randomized hostile fuzz

Command: `SMOKE_SCALE=1 npx tsx --test test/smoke.test.ts`

| # | Scale | Invariants checked | Result |
| --- | --- | --- | --- |
| S1 | 20,000 random hostile inputs (oversize, malformed, unicode, mixed-type, null, truncated) | No crash, finite bounded confidence, unknown only on oversized input, oversized never benign | PASS |
| S2 | 3,000 randomized valid + 1,000 mutated/boundary vaccines | No crash, deterministic structural verdicts | PASS |
| S3 | 100 ledger tampering attempts (all six protected event fields + checkpoint mutation) | Forgery/truncation/re-seal always rejected | PASS |
| S4 | 4,000 random deployment operations (approve, canary, promote, rollback, revoke, expire, observe) | No crash, poisoned controller fail-closed, no unauthorized enforce | PASS |
| S5 | 5,000 diverse benign payloads | All valid inputs return a verdict, none crash | PASS |
| S6 | 1,200-durable-store soak, writes interrupted at random points | No authorization without persisted state, recovery hash valid | PASS |

`SMOKE_SCALE=10` (200,000 inputs, 30,000 vaccines, 1,000 ledger tampering attempts, 40,000 deployment operations):

```
# pass 6
# fail 0
# duration_ms 126000 (approx)
```

### Defect found by stress, fixed before this record

`observe()` crashed when `requestId` was missing or malformed because the guard used `.length` before the type check. The controller now returns `hold` for invalid input. Regression S4 and B14 prevent recurrence.

### Performance observed

Durable observe throughput is roughly 3,900 requests/sec in this environment, enough for a single-operator pre-execution control plane, not a high-volume perimeter. This is a measurement of the harness, not a service-level guarantee.

## Remaining gates (unchanged)

- Representative unseen agent-artifact evaluation with independent labels.
- Authenticated authorization plane, trusted labels, and wired alert delivery.
- Target-environment rollout/recovery/load test.
- Independent engineering review.
