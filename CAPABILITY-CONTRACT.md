# Capability Contract — SEM-OASB-001 / ANTIBODY REACTOR

This contract is the build promise approved for materialization. A claim is complete only when it is observable in code and exercised by tests or the recorded OASB run.

## C1 — External selection pressure

The reactor SHALL accept an OASB-style labeled corpus from outside the project. It SHALL NOT embed OASB sample IDs, labels, or benchmark answers into its shipped vaccine rules. Training labels may be used to discover statistical evidence; validation labels may be used as the fitness oracle.

**Evidence:** `src/features.ts`, `src/split.ts`, `src/reactor.ts`, `test/features.test.ts`.

## C2 — Antibody synthesis

The reactor SHALL discover threat-evidence candidates from training content and emit evidence-bearing defense rules with stable IDs, weights, category association where available, and malicious/safe document counts.

**Evidence:** `discoverRules()` in `src/features.ts`.

## C3 — Actual reproduction

Defense strains SHALL have generation numbers and parent IDs. New strains SHALL be produced through crossover and mutation of inherited rules and decision thresholds, not merely renamed copies.

**Evidence:** `DefenseBreeder.crossover()`, `.mutate()`, `.breedNextGeneration()`.

## C4 — External fitness oracle

A strain's survival score SHALL be computed from its performance on the external validation partition. A policy that flags everything SHALL be strongly penalized through the benign counter-pressure.

**Evidence:** `src/evaluate.ts`, recorded generation artifacts.

## C5 — Mutation rehearsal

Every candidate child SHALL be evaluated before admission. Rehearsal SHALL identify recall regressions, benign-disagreement regressions, correlation regressions, complexity explosions, and fitness regressions. Compound regressions SHALL be blocked from reproduction.

**Evidence:** `src/rehearsal.ts`; `artifacts/oasb-final/rehearsals.json`.

## C6 — Extinction is evidence

Rejected/cut strains SHALL not disappear from the experimental record. The build SHALL preserve a fossil record containing identity, ancestry, generation, state, death reason where known, genome digest, threshold, and validation metrics.

**Evidence:** `artifacts/oasb-final/fossil-record.json`.

## C7 — Tamper-evident evidence ledger

Birth/selection/rehearsal/promotion/vaccine events SHALL be recorded in an ordered SHA-256 hash chain. The project SHALL provide an independent verification command for the serialized ledger.

**Evidence:** `src/ledger.ts`; `node dist/cli.js verify --ledger ...`; final run head hash in `run-summary.json`.

## C8 — Sealed holdout

The final holdout SHALL not be prepared/tokenized/evaluated during breeding. One champion SHALL be selected on validation before the holdout is opened.

**Evidence:** order of operations in `runReactor()`; `src/reactor.ts` prepares holdout only after champion selection.

## C9 — Vaccine synthesis

The promoted descendant SHALL materialize as a standalone machine-readable policy containing its threshold, rules, validation/holdout receipts, category recall, deployment plan, and parent-capability provenance.

**Evidence:** `src/vaccine.ts`; `artifacts/oasb-final/vaccine.json`.

## C10 — Explainable live scanning

A vaccine SHALL be runnable against a new text artifact without the training corpus. The scanner SHALL emit the score, threshold, matched evidence, candidate category, and verdict. The benchmark sample ID SHALL never alter classification.

**Evidence:** `src/oasb-scanner.ts`; CLI `scan` command.

## C11 — Reproducible deterministic pressure

Given the same corpus bytes, seed, configuration, and runtime semantics, partitioning and evolutionary entropy SHALL be deterministic. Timestamps are evidence metadata and do not participate in classification or random choice.

**Evidence:** SHA-addressed corpus, salted hash split, `DeterministicRng`, explicit run config.

## C12 — Honest reporting

The report SHALL distinguish categorized malicious recall from benign-derived metrics and SHALL preserve OASB's own warning that the registry benign class is not an independent real-world false-positive sample.

**Evidence:** `README.md`; generated `artifacts/oasb-final/REPORT.md`.

## Verification state

- TypeScript strict build: **PASS**
- Unit/integration tests: **6 / 6 PASS**
- Final evidence ledger verification: **PASS**
- OASB categorized external-oracle holdout: **29 / 34 attacks detected (85.29%)**
- Five-fold out-of-fold OASB attack recall: **220 / 270 (81.48%)**
- Champion: **generation 24**, 41-rule genome


---

## v0.3.0 additions (released 2026-11-25)

The verification state above is the historical v0.1/v0.2 record and is preserved as written. Current evidence: `TEST-RESULTS.md`.

### C13 — Fail-closed scanning
A vaccine SHALL be validated before any scan; an invalid vaccine SHALL be refused. Any input that cannot be scanned SHALL yield `unknown`, never `benign`. **Evidence:** `src/vaccine-validate.ts`, `src/oasb-scanner.ts`, tests V2–V5.

### C14 — Pinned evidence
Ledger and vaccine verification SHALL support pins obtained outside the artifact (head, anchor, entry count, file SHA-256, policy fingerprint) and SHALL report when no pin was supplied. **Evidence:** `src/ledger.ts`, `src/trust.ts`, `TRUSTED-FINGERPRINTS.json`, tests V3, V6.

### C15 — Human authority over enforcement
No step that increases enforcement SHALL occur without an approval accepted by an explicitly configured authorizer; the default SHALL deny. Steps that reduce enforcement MAY be automatic. **Evidence:** `src/deployment.ts`, tests P3.

### C16 — Honest confidence and independent measurement
Confidence SHALL be labelled as an uncalibrated heuristic. Generalisation claims SHALL rest only on sets never used for training or selection. **Evidence:** test V1, `docs/INDEPENDENT-VALIDATION.md`, test P4.

## v0.3.1 evidence-correction candidate

### C17 — Coherent measurement provenance
Every precision, recall, F1 and false-positive rate SHALL be derived from one prediction set with one evaluation identity, dataset hash and policy fingerprint. Cross-experiment, cross-dataset and cross-policy mixing SHALL be rejected. Unknown verdicts SHALL NOT be silently converted into correct classifications. **Evidence:** `src/evidence.ts`, tests E1–E6, `artifacts/evidence-audit-v0.3.1/results.json`.

### C18 — Public-claim consistency
Current documentation SHALL NOT present five-fold evolutionary recall as one frozen vaccine's recall or describe training/selection-exposed OASB fixtures as independent validation. Historical corrections SHALL preserve, rather than erase, the earlier record. **Evidence:** `scripts/verify-claims.mjs`, `docs/EVIDENCE-CORRECTION-v0.3.1.md`.
