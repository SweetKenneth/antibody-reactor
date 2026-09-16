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
