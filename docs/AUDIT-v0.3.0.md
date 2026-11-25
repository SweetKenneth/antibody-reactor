# Antibody Reactor v0.3.0 candidate — audit

Status: **candidate, not a production-ready declaration.** Branch `hardening/v0.3.0`. Nothing merged, tagged, published or deployed.

## Ground rules followed

- The published v0.2.0 tag, its artifacts (`artifacts/oasb-final`, `artifacts/oasb-cv5`), its `CHECKSUMS.sha256` and its recorded results are untouched. `CHECKSUMS.sha256` remains the v0.2.0 manifest; files changed on this branch will not match it, by design.
- The SHPBL Governor Edition v1.7.12 archive was opened read-only. Its SHA-256 (`4e08a648…097067`) matches `PROVENANCE.json`. Nothing in it was modified and no capability body was copied into this repository.
- No benchmark number was re-rolled, tuned or replaced. After every change the full run and the five-fold cross-validation were re-executed against OASB `corpus/v2.json` (SHA-256 `3ca866a0…ba14e`, commit `fddf2b13`) and compared byte-for-byte with the committed artifacts: **all 10 final-run files and all 7 cross-validation files identical.**

## Phase 1 — six parent contracts versus the composition

The parent bodies were located by seal in `tools/fuse-repo.mjs` of the v1.7.12 archive and read in full. Listing a parent in the manifest proves nothing; this table is what was actually checked.

| Parent (seal) | Protection in the original | In v0.2.0? | v0.3.0 |
|---|---|---|---|
| `IMMUNITY::createAntibodyGenerator` (655cd4a8…) | Antibody starts `synthesizing` and needs explicit `activate()` | Lost — vaccine had no activation step | Restored: `DeploymentController.activate()` requires authorized approval |
| | 24 h TTL and `expireStale()` | Lost — vaccines never expire | Restored: campaign TTL, 24 h default, expiry stops enforcement |
| | `revoke()` | Lost | Restored: `revoke()` |
| | Effectiveness / false-positive feedback (EMA) | Lost | Restored as observed-envelope monitoring (counts, not EMA) |
| | Threat fingerprint dedup, severity escalation | Not applicable — composition learns rules statistically | Not restored; noted |
| `IMMUNITY::createDefenseBreeder` (0db02d51…) | Population cap (`maxStrains`) | Kept (population/elite) | Unchanged |
| | Promotion only at survival ≥ 90 **and** ≥ 5 attacks survived | Changed — champion is the top validation strain, unconditionally marked `promoted` | Unchanged inside the run (changing it would re-roll the published trajectory). Clarified: run-level "promoted" means *selected*, and deployment promotion is now a separate, gated step |
| | Non-deterministic `Date.now()`/random ids | Improved — deterministic RNG and logical clock | Unchanged |
| `ECHO::createMutationRehearsalEngine` (793f191c…) | Verdicts safe / risky / blocked | Kept, stricter (≥3 failures or FP+recall compound = blocked) | Unchanged |
| | `rollbackSafe` | Computed but never used to gate anything | Still informational inside the run; deployment rollback is now real (see Phase 3) |
| | `recordOutcome` / verdict accuracy | Lost | Restored in spirit: observed outcomes per stage drive automatic rollback |
| `CORE::createEvidenceLedger` (10a4adfd…) | Bounded append-only log (cap 512), no hashing | Strengthened to a SHA-256 chain, anchored | Further: CLI pins head / anchor / count / file hash; empty and malformed ledgers rejected |
| `IMMUNITY::synthesizeVaccine` (f96209bd…) | Clamps expected efficacy to [0, 1] | Not applicable — vaccine carries measured metrics | Added: vaccine validation before any scan |
| `IMMUNITY::planCampaign` (e11b7b6f…) | Starts in `planning`, max 3 concurrent campaigns, targets only unvaccinated nodes, efficacy target, breakthrough count, `abortCampaign` | Mostly lost — static phase list with `status: 'planning'` and no controller | Restored: planning state, max 3 concurrent, abort, efficacy envelope, rollback. Node targeting not restored (no node model) |

Conclusion: the composition kept the evolutionary and evidence semantics and lost almost all of the *lifecycle* protections (activation, expiry, revocation, campaign limits, abort, outcome feedback). Those are restored in `src/deployment.ts`, outside the reactor run, so the published evidence is unaffected.

## Phase 2 — vulnerabilities found and fixed

Each was reproduced against the v0.2.0 build before fixing (`/tmp/probe.mjs` output recorded below) and each has regression tests in `test/v030.test.ts`.

| # | Finding (v0.2.0 behaviour) | Fix | Tests |
|---|---|---|---|
| V1 | **Misleading confidence.** Empty input returned `benign` with confidence **0.99**. Confidence = 0.5 + margin/(2·threshold) saturated for any text with no matches. | Bounded margin heuristic, labelled `confidenceBasis: margin-heuristic-uncalibrated`. Benign capped at 0.75 (absence of matches is weak evidence), malicious at 0.95; exactly 0.5 at the threshold. `margin` reported. Verdicts unchanged. | V1 ×2 |
| V2 | **No vaccine validation.** Threshold `1e12`, threshold `"x"`, empty rules, or negated weights all silently returned `benign` for an obvious attack (false safe). Missing policy crashed. | `validateVaccine()`: schema, kind, 1–512 rules, unique ids/terms, NFKC-lowercase terms ≤128 chars, finite weights in [0.01, 10], positive threshold not exceeding total weight, champion/policy consistency. Scanner refuses invalid vaccines at construction and scans its own deep copy. | V2 ×17, V3 copy test |
| V3 | **No integrity binding.** A plausible hand-edited policy (e.g. threshold +0.5) passes any structural check. | Policy fingerprint (SHA-256 of canonical policy) and file SHA-256 pinning: `expectedPolicyFingerprint`, CLI `--vaccine-sha256` / `--trusted`. Unpinned CLI scans say so in their output. | V3 ×2 |
| V4 | **No input limits.** 10 MB inputs accepted; non-string input threw. | 1 MiB default UTF-8 limit (configurable); non-string or oversize → `unknown`, confidence 0. | V4 ×2 |
| V5 | **Failures could surface as crashes or benign.** | Every failure path returns `unknown`; OASB `scan()` adapter never throws on bad input; CLI exits 3 on unknown, 4 on rejected vaccine. | V5 ×2 |
| V6 | **Ledger verify trusted itself.** A ledger rewritten and fully re-chained verified `valid: true`; the CLI never checked anchor or head. Empty ledger verified `true`; `[null]` crashed. | Pins: anchor, head, entry count, file SHA-256 (`TRUSTED-FINGERPRINTS.json`, cross-checked against `PROVENANCE.json` and the `v0.2.0` tag). Structural entry checks. Empty invalid unless `allowEmpty`. CLI reports `trust: pinned` or warns "self-consistency only"; `--require-pins` makes unpinned verification fail. CI now verifies pinned. | V6 ×5 |
| V7 | **Version drift.** Scanner reported `0.1.1` in a `0.2.0` package. | Single `SCANNER_VERSION`, asserted equal to `package.json`. `CITATION.cff` stays 0.2.0 because 0.3.0 is not released. | V7 |

Honest limit on V3/V6: the pins file lives in the same repository as the artifacts. Against an attacker who can rewrite the repository it is a consistency check, not an independent one. Independent assurance requires getting the pins from a channel that attacker cannot also write (the `v0.2.0` tag, the GitHub release, shpbl.com) and passing them explicitly.

## Phase 3 and Phase 4

See `docs/PRODUCTION-SAFEGUARDS.md` and `docs/INDEPENDENT-VALIDATION.md`.
