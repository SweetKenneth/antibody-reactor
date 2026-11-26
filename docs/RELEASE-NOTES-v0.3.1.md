# Draft release notes — v0.3.1 evidence correction

**Not published. Founder review required.**

v0.3.1 corrects public evidence accounting and strengthens reproducibility checks. It does not change the evolutionary algorithm, vaccine, published research artifacts, deployment authority or production-readiness boundary.

## Corrections

- Withdraws the mixed-experiment 80.88% precision / 81.18% F1 calculation.
- Preserves five-fold evolutionary recall as 220/270 = 81.48% across five independently trained populations.
- Corrects the frozen v0.2.0 champion's OASB PR #411 result to 229 TP, 9 FP, 41 FN, 168 TN, 0 unknown.
- Reports that frozen policy's internally consistent research-only metrics: 96.22% precision, 84.81% recall, 90.16% F1 and 5.08% FPR.
- Explicitly marks all 447 OASB samples as training/selection-exposed, not independent validation.
- Preserves the separate unseen-set results: 0/60, 49/139 and 6/24 attacks detected.

## Verification

- Strict TypeScript build and complete engineering/regression tests.
- Pinned evidence-ledger and vaccine-fingerprint verification.
- Cross-experiment metric-mixing refusals and corrected-evidence regression tests.
- Current-claim consistency checks.
- Historical release-artifact checksum verification and complete v0.3.1 candidate checksum coverage.

## Status

Latest published release remains v0.3.0 until v0.3.1 is explicitly approved, tagged and released. Antibody Reactor remains advisory/shadow-only and is not production-ready as a sole enforcement gate.
