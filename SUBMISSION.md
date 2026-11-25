# External validation posture

## What is being claimed

**220 / 270 = 81.48% out-of-fold categorized-attack recall**, measured across five independent evolutionary populations, with every one of OASB's 270 authored attack fixtures held out exactly once from the population that scored it. Artifact: `artifacts/oasb-cv5/cross-validation.json`.

Secondary: **29 / 34 = 85.29%** recall on a sealed holdout opened once after a single champion was selected. The denominator is small and this number must not be compared to a scanner measured over all 270 fixtures.

## What is deliberately not being claimed

- **Not a false-positive rate.** OASB withdrew its precision, F1, false-positive-rate and flag-rate claims on 2026-08-09 because much of its benign class was labeled using the scanner under test. Benign disagreement here — 49 of 3,975 out-of-fold (1.23%), 1 of 608 on the sealed holdout (0.16%) — is retained as evolutionary counter-pressure against flag-everything behaviour and is reported as disagreement with corpus labels, nothing more. The benign side of the corpus used here is 3,881 `benign` + 94 `edge_case` = 3,975 samples. Against OASB PR #411's 177 hand-written benign fixtures (labelled without the scanner), the frozen champion flags 52 (29.38%); see docs/INDEPENDENT-VALIDATION.md.
- **Not comparable to OASB or HackMyAgent historical scores.** No comparability is asserted, because OASB's current methodology does not support it for a system that used the corpus as selection pressure.
- **Not an independent post-hoc benchmark score.** OASB was used as evolutionary selection pressure. The final champion's in-sample performance is not presented as a benchmark result anywhere in this repository or on the project page.
- **Not certified, endorsed or approved** by the OASB project or its maintainers. Depending on OASB and citing it is not an endorsement.

## Chosen submission route

The **adopter / independent-evaluation issue** path documented in OASB's `CONTRIBUTING.md`, which instructs adopters to "open an issue describing how you run OASB and against which product". Draft: `docs/OASB-ADOPTER-ISSUE.md`.

A hosted scanner submission is **not** used. Two reasons, both checked rather than assumed:

1. There is no reachable hosted submission API. `https://api.oa2a.org/api/v1/benchmark/submit` returns 404, as does the API root. OASB's current documentation describes submission as local and manual.
2. Even if one existed, this system used the corpus as selection pressure. Submitting a frozen champion against the same corpus as though it were unseen would misrepresent the methodology. Acceptance by an endpoint is not methodological validity.

If OASB maintainers want a hosted scanner submission, the adopter issue asks them directly. A future OASB dataset version released after this vaccine was frozen would provide a genuinely unseen external evaluation, and that is the cleanest next step.

## Stricter than the server

OASB issue #24 records that incomplete submissions can currently earn a high tier. This project therefore validates locally before it would ever submit: exact dataset version, exact published release version, one result for every required sample, no missing, duplicate or unknown sample ids, valid verdict and category enums, complete run metadata, and an immutable released commit. If any of those is imperfect the submission fails locally. A gap in the scoring server is not an opportunity.

## Pinned references

| Item | Value |
|---|---|
| OASB repository | <https://github.com/opena2a-org/oasb> |
| OASB commit used | `fddf2b1379c5597a3e83a3c6f7833b8e5613a04e` |
| OASB licence | Apache-2.0 |
| Corpus file | `corpus/v2.json` |
| Corpus SHA-256 | `3ca866a0e637fa198bae17cd3a8f31fb02ad20f50fedcac1caa290e6dceba14e` |
| Corpus composition | 4,470 samples; 9 attack categories x 30 = 270 authored attacks |
| Samples used | 4,245 (categorized-attack mode; 225 uncategorized registry samples excluded) |
| Antibody Reactor release | v0.2.0, MIT |
| Seed | 20260916 |
| Ledger head | `d4ad72536338804cee4815c4e3e345b9103f31c285b4223a590e93782d0c7397` |
| Ledger anchor | `anchor:5af96e8814d2b5acb8090bba147c6cfe4d2bf86a5c7495ab11f4614d6da5f9da` |
