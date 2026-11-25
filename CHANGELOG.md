# Changelog

All notable changes to this project are recorded here.

## 0.3.0 — candidate (unreleased, branch `hardening/v0.3.0`)

Production-hardening candidate. **Not a production-readiness declaration.** No published v0.2.0 metric, artifact or checksum changed: the full run and five-fold cross-validation were re-executed after every change and are byte-identical to the committed artifacts. Full audit: `docs/AUDIT-v0.3.0.md`.

### Fixed
- Scanner confidence reported 0.99 "benign" for empty input. Confidence is now a bounded, explicitly uncalibrated margin heuristic (benign ≤ 0.75, malicious ≤ 0.95). Verdicts unchanged.
- Vaccines were used without validation; corrupt thresholds, empty rule sets or negated weights silently produced "benign" for obvious attacks. Vaccines are now validated and refused at construction.
- Vaccines had no integrity binding. Policy fingerprint and file SHA-256 pinning added.
- No input limits; non-string input crashed. 1 MiB default limit; every failure returns `unknown`, never `benign`.
- Ledger verification accepted a fully re-chained forgery and an empty ledger, and crashed on malformed entries. Head, anchor, entry-count and file-hash pins added (`TRUSTED-FINGERPRINTS.json`); CI verifies pinned.
- Scanner reported version 0.1.1.

### Added
- `src/deployment.ts`: shadow → canary → general deployment with human-authorized activation and promotion (default deny), automatic rollback on envelope breach, 24 h TTL, revoke, abort, max 3 concurrent campaigns — lifecycle controls carried by the parent capabilities and lost in the v0.2.0 composition.
- CLI: `validate-vaccine`, `independent`, pinned `verify` (`--trusted`, `--expect-*`, `--require-pins`), pinned `scan` (`--vaccine-sha256`, `--max-bytes`).
- Independent validation of the frozen v0.2.0 vaccine on unseen sets (`docs/INDEPENDENT-VALIDATION.md`): 0/60, 49/139 and 6/24 attacks detected. The vaccine does not generalise beyond OASB-shaped artifacts.
- 46 regression and safeguard tests (`test/v030.test.ts`); 64 total.

## 0.2.0 — public release

Independent adversarial re-audit of the 0.1.1 package followed by remediation, relicensing and publication. **No published metric changed.** The rebuilt run promotes the same champion (`def-g24-c7fbd215ef`, 41 rules, threshold 11.0459), records the same sealed-holdout recall (29/34 = 85.29%) and the same five-fold out-of-fold attack recall (220/270 = 81.48%) with byte-identical per-category counts. The fixes below were chosen specifically so they could not re-roll the evolutionary trajectory, and that was verified by comparison against the 0.1.1 artifacts rather than assumed.

### Fixed

- **Evidence was not reproducible.** Wall-clock timestamps were hashed into every ledger entry, so two runs of the same seed produced different chains and no third party could confirm a published head hash. All artifact-bound timestamps now come from a logical clock (`src/clock.ts`). Two runs of the same seed now produce byte-identical `champion.json`, `vaccine.json`, `evidence-ledger.json`, `lineage.json`, `fossil-record.json`, `generations.json`, `rehearsals.json` and `run-summary.json`.
- **The evidence chain was not bound to its run.** The chain began at the literal `GENESIS`, so an internally valid ledger from any other run or corpus could be substituted without detection. Chains are now anchored to `sha256(corpusSha256:seed)` and `verify` reports the anchor.
- **Ledger verification accepted reordering.** Entry indices were not checked against position, so a resequenced chain could pass. Index continuity is now verified.
- **Surviving elites reported the wrong generation.** An elite carried forward kept its original `generation`, so every report, lineage edge and fossil entry for a long-lived elite claimed a generation it had already outlived.
- **The lineage graph contained invented parents.** When two parent draws landed on the same elite, the strain recorded that parent twice, doubling the edge and implying a cross that never happened. A self-cross now records one parent.
- **Generation summaries hid cloning.** When children could not be admitted the population was refilled by cloning elites, and nothing reported it — a generation that was mostly copying looked like a generation that was mostly breeding. `GenerationSummary.fallbackClones` now records it.
- **Corpus input was trusted.** A duplicate sample id silently placed the same sample in both the training split and the sealed holdout, which is contamination. Duplicate ids, missing ids, missing labels, non-string content and samples over 1 MB are now rejected before any partition is formed.
- **Degenerate partitions produced flattering metrics.** An empty or all-benign validation or holdout split yielded undefined recall reported as a number. Each partition is now required to be non-empty and to contain malicious samples.
- **Malformed corpora failed obscurely.** A truncated JSON file surfaced a raw parser error. Parse failures now name the file and cause.
- **Configuration was under-validated.** Non-integer or non-positive generation, population, candidate-pool and seed values are now rejected before the corpus is read.
- **Run summaries recorded an absolute machine path.** `corpus.path` is now a basename, which is both less machine-specific and one fewer reason for identical runs to differ in bytes.

### Changed

- Licence changed to **MIT** by the rights holder for public adoption, replacing `LicenseRef-CMPSBL-Perpetual-1.0`, whose clause 2.2 prohibited public redistribution. The MIT grant covers this repository only; the private SHPBL/CMPSBL capability library and the OASB corpus remain undistributed.
- Package renamed `antibody-reactor` and `private: true` removed.
- Minimum Node raised to 20.11; CI exercises Node 20 and Node 22.
- Compiled `dist/` and `dist-test/` directories (about 19 MB) removed from the package and gitignored.

### Added

- 10 new engineering checks covering logical-clock determinism, anchor binding, cross-run ledger substitution, payload tampering, reordering, truncation, duplicate ids, malformed and degenerate corpora, configuration validation, byte-for-byte run reproducibility, seed sensitivity, lineage integrity, holdout isolation and sample-id leakage into artifacts. Suite total: 18.
- `scripts/reproduce.sh` now runs the sealed-holdout run, the five-fold evaluation, a determinism diff and ledger verification.
- `scripts/apply-audit-fixes.py`, retained so the 0.1.1 to 0.2.0 source diff is reconstructible rather than asserted.


## 0.1.1 — 2026-09-16

Release/submission hardening pass.

- added explicit OASB evaluation disclosure separating evolutionary cross-validation from frozen-scanner leaderboard claims;
- added proposed OASB adopter / independent-evaluation issue text;
- added GitHub Actions CI for Node 20/22;
- added security policy and citation metadata;
- added direct compiled-test and evidence-ledger release verification scripts;
- regenerated complete package checksums;
- bumped scanner/package version to 0.1.1;
- preserved the 5-fold 220/270 out-of-fold attack receipt and flagship 4,454-event evidence ledger unchanged.

## 0.1.0 — 2026-09-16

Initial Antibody Reactor composition and recorded OASB evolutionary runs.
