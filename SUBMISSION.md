# Submission: SHPBL Antibody Reactor

## Target

- **Program:** OASB Adopters section (`opena2a-org/oasb`) — an informational usage listing, not a certification
- **Public discussion:** https://github.com/opena2a-org/oasb/issues/39
- **Repository:** https://github.com/SweetKenneth/antibody-reactor
- **Published release:** https://github.com/SweetKenneth/antibody-reactor/releases/tag/v0.3.0
- **Correction candidate:** `correction/v0.3.1`; not tagged or published

## Status

The maintainer agreed in principle to an adopter listing and verified the referenced OASB commit, corpus hash, and sample counts. They did **not** reproduce the evolutionary result, endorse SHPBL, certify the scanner, or confirm a production detection rate.

The previously posted 80.88% precision / 81.18% F1 statement was methodologically wrong because it combined different experiments. The earlier 52/177 count also did not reproduce. A corrective follow-up is drafted in `docs/OASB-ISSUE-39-CORRECTION-DRAFT.md` and is **not posted without founder approval**. Earlier comments remain untouched.

## Corrected evidence summary

- Five independently trained populations, each evaluated on its held-out fold: **220/270 held-out malicious detections (81.48%)**.
- Original safe-labeled pool: **3,881 benign + 94 edge cases = 3,975**; **49 corpus-label disagreements**. That ratio is not a field false-positive rate.
- One frozen v0.2.0 champion over OASB PR #411's exact training-exposed selection: **229 TP, 9 FP, 41 FN, 168 TN**. Derived precision **96.22%**, recall **84.81%**, F1 **90.16%**, benign flag rate **5.08%**. This is not independent validation.
- Genuinely unseen frozen-policy results remain weak: **0/60**, **49/139**, and **6/24** on the three committed sets. No production claim follows from the training-exposed F1.

Reconstruction and reproducible commands: `docs/EVIDENCE-CORRECTION-v0.3.1.md`, `docs/INDEPENDENT-VALIDATION.md`, `artifacts/evidence-audit-v0.3.1/results.json`.

## What an adopter listing does and does not mean

- **Does:** publicly document that the OASB corpus was used for a reproducible experimental scanner.
- **Does not:** certify Antibody Reactor, rank it, validate its detection claims, endorse SHPBL, or approve production deployment.

## What we are NOT requesting

- No certification, no leaderboard ranking, no endorsement.
- No request to treat training-exposed metrics as independent validation.
- No claim that the v0.3.1 candidate is released or that CI has passed on GitHub.
- No autonomous promotion or production-blocking recommendation.

## Documents for reviewers

- `docs/EVIDENCE-CORRECTION-v0.3.1.md` — complete measurement accounting and withdrawn claims
- `docs/INDEPENDENT-VALIDATION.md` — unseen tests and training-exposure boundaries
- `docs/OASB-ISSUE-39-CORRECTION-DRAFT.md` — proposed corrective public comment
- `docs/CI-WORKFLOW-OWNER-ACTION.md` — exact workflow change and current verification status
- `docs/AUDIT-v0.3.0.md` — historical engineering audit with dated addenda
- `docs/PRODUCTION-SAFEGUARDS.md` — remaining v1.0.0 gates
