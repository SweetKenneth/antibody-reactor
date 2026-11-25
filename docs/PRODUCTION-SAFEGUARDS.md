# Production safeguards (v0.3.0 candidate)

Implemented in `src/deployment.ts`, tested in `test/v030.test.ts` (P3). It is a library control, **not integrated into any running system**. No production enforcement exists or is enabled by this branch.

## Authority rule

- Anything that **increases** enforcement — `activate` (planning → shadow) and `promote` (shadow → canary → general) — needs an `Approval` the injected `Authorizer` accepts. The default authorizer, `denyAll`, accepts nothing. An authorizer that throws counts as a refusal. Approvals need a named approver and a reason; both outcomes are recorded in the deployment ledger; the credential is never recorded.
- Anything that **reduces** enforcement — automatic rollback on an envelope breach, TTL expiry, operator `rollback`, `revoke`, `abort` — needs no approval. Failing toward less blocking never takes a decision about blocking away from the human.
- Promotion is never automatic. Evidence makes a promotion *eligible*; only an authorized human makes it happen.

## Stages

```text
planning --activate(approval)--> shadow --promote(approval)--> canary --promote(approval)--> general
    |                              |                             |                            |
  abort                       (breach recorded,             auto-rollback               auto-rollback
                               promotion blocked)            on breach                   on breach
                                                                   \                         /
                                                                    ---> rolled_back <-------
any active stage --TTL--> expired      any stage --revoke--> revoked
```

| Stage | Malicious verdict | Unknown verdict | Benign |
|---|---|---|---|
| shadow | log | log | allow |
| canary, request in bucket | block | hold for human | allow |
| canary, outside bucket | log | log | allow |
| general | block | hold for human | allow |
| rolled_back / expired / revoked | log | log | allow |

Canary bucket: first 32 bits of SHA-256(request key) mod 100 < `canaryPercent` (default 10). Deterministic per request key.

## Monitoring envelope

Default operator budget: max false-positive rate 1%, min recall 95%, max unknown rate 1%. These are policy limits, not estimates from OASB's scanner-derived benign class. Promotion eligibility requires at least 500 labelled benign and 30 labelled malicious observations **in the current stage** (stats reset at each promotion). Breach checks start at 50 labelled benign / 10 labelled malicious / 100 scans; promotion also checks actual current rates without those warm-up thresholds.

Ground-truth labels must come from humans or a trusted downstream system. The controller cannot create them.

## Inherited limits restored from the parents

Max 3 concurrent campaigns and abort (`planCampaign`); explicit activation, 24 h TTL and revocation (`createAntibodyGenerator`); outcome feedback against verdicts (`createMutationRehearsalEngine`).

## Formally specified, not implemented

- **Persistence integration.** `FileDeploymentStore` now implements atomic checkpoints and externally pinned restart. Operators still must provision a private directory, retain each checkpoint digest independently, and recover stale locks only after excluding another live writer. Full checkpoints are not a high-throughput event database; production load testing and archival remain required.
- **Authorizer.** No production authorizer ships. It must verify a real credential (signed approval, governor session) and must not be bypassable from the scanning path.
- **Label pipeline.** Sampling and human review of production traffic to produce the labelled observations.
- **Alerting.** Breaches and rollbacks are ledger events only; wiring them to paging is the operator's job.
- **Vaccine promotion between versions.** A new vaccine must go through its own planning → shadow path; there is no in-place swap.

## Re-audit hardening (unreleased v0.3.0 candidate)

- Production target: agent skills, tools, configurations, and supported artifacts reviewed before execution. The evolutionary laboratory remains the policy-development engine.
- Enforcement requires an independently pinned vaccine policy fingerprint, positive monitoring evidence, and explicit authorization. Unpinned campaigns can run only in shadow.
- Operator envelopes are validated and copied. The default is an operator budget: at most 1% false positives and unknowns, at least 95% recall. It is not derived from OASB's scanner-labelled benign class.
- Results and observations must carry the campaign's policy fingerprint. Malformed or mismatched results cannot count toward promotion and are held while enforcing.
- File checkpoints are atomic, bounded, single-writer, and require an externally retained digest on restart. Any persistence failure faults the controller.
- A restart never resumes canary or general enforcement; restored enforcing campaigns return to shadow with fresh evidence.

Still not implemented: production identity verification, trusted labelling and alert delivery, external pin storage, and a deployment environment exercise.
