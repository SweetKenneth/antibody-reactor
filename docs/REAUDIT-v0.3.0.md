# Antibody Reactor — local v0.3.0 re-audit

Date: 2026-11-25. Status: unreleased candidate, not v1.0.0 or production-ready.
Scope: persistent local source under `incoming/antibody-reactor`. The GitHub branch and PR were not updated; nothing was deployed, merged, or tagged.

## Target architecture

The existing evolutionary laboratory remains the defense-development engine. It discovers, breeds, tests, and evaluates policies. Approved policies become versioned vaccine artifacts. The production target is agent skills, tools, configurations, and supported artifacts reviewed before execution. Start in advisory/shadow mode; enforcement requires human approval and verified evidence.

## Verified fixes

- Refuse vaccine terms that the extractor cannot emit, rather than accepting unreachable policies that silently classify everything benign.
- Validate champion metadata and finite evaluation metrics; bound vaccine rule validation work.
- Copy and validate monitoring envelopes; prevent caller mutation and non-finite values from disabling safeguards.
- Check actual current performance before promotion, even before monitoring warm-up counts.
- Expire planning and unread campaigns before counting the three-campaign capacity. Reject TTL beyond the inherited 24-hour ceiling.
- Own ledger payloads and return copies, so caller mutation cannot invalidate append-only evidence.
- Refuse reentrant or state-changing approvals that could override revocation or skip canary.
- Require the approved policy fingerprint on observations and enforcement decisions. Invalid verdicts never become permission to proceed while enforcing.
- Keep unpinned vaccines shadow-only; require an independently supplied policy pin before promotion.
- Bound CLI ingestion before allocation and decoding; reject non-regular paths, malformed UTF-8, and oversized artifacts as unknown. FIFO rejection is exercised through the real compiled CLI.
- Validate independent-evaluation IDs, class coverage, and input limits. Distinguish hashing from trusted pin comparison in CLI reports.
- Reject malformed or ambiguous trusted-release records.
- Update the local CI workflow to use pinned evidence verification.

## Durable-state safeguard

`FileDeploymentStore` provides bounded, atomic, single-writer checkpoints with file and directory synchronization. Restart requires an externally retained checkpoint digest. Conflicting writes or checkpoint failure fault the store/controller instead of continuing with unpersisted authority. Restored canary/general campaigns return to shadow with fresh evidence: restart never automatically resumes blocking.

This is a local file adapter, not a tested distributed deployment system. Its directory must be operator-owned. External pin retention, crash/stale-lock recovery procedures, archival, and realistic load testing remain integration requirements. A direct raw checkpoint restore is an in-process API; integrations must authenticate checkpoint bytes through the store before using it.

## Executed evidence

- Node 22.23.5: `npm test` performs strict TypeScript compilation plus all Node tests. **85/85 pass**, zero skipped.
- 64 carried candidate tests plus 21 new regression/CLI tests.
- Exact OASB corpus SHA-256: `3ca866a0e637fa198bae17cd3a8f31fb02ad20f50fedcac1caa290e6dceba14e`.
- Full 24-generation experiment: all **10/10** published final-run files reproduce byte-for-byte.
- Five-fold evolutionary evaluation: all **7/7** published cross-validation files reproduce byte-for-byte.
- Champion remains `def-g24-c7fbd215ef`; sealed holdout remains 29/34; out-of-fold categorized recall remains 220/270.
- All pre-existing artifact files, the parent manifest, and the original `CHECKSUMS.sha256` remain unchanged.
- The frozen independent-result regression still recomputes the original 0/60, 49/139, and 6/24 detection results. These are not new unseen validation in this pass.

The current candidate checksum manifest is resealed separately; it does not replace the v0.2.0 checksum manifest or results.

## Remaining production gates

1. **Real authorization and trusted feedback:** choose the deployment environment, implement actual operator identity/credential verification, trusted human labelling, and delivery of alerts. The configurable authorizer remains default-deny; a test callback is not production identity.
2. **Independent agent-artifact validation:** freeze a candidate and acceptance criteria, then evaluate a genuinely untouched, representative agent-artifact set with an independent evaluator. Existing final test sets are already seen and must not become tuning targets. Current poor generalization blocks sole-gate protection.
3. **Target-environment exercise:** provision external checkpoint-pin storage and demonstrate shadow observation, explicit canary approval, rollback, expiry, crash recovery, and realistic workload limits. No such deployment was authorized or exercised here.
4. **Release gate:** independently review the frozen candidate and the above evidence before assigning v1.0.0. Do not equate a version bump or green unit tests with production readiness.

No private Governor Edition capability bodies were copied into the public source, and no Governor Edition library was modified in this pass. Earlier parent-contract findings remain historical evidence, not a newly repeated private-library audit.