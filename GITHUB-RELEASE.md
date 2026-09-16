# Release notes — v0.2.0

**The security policies reproduce. OASB decides which offspring survive.**

Antibody Reactor is an evolutionary agent-security system. Candidate defenses are mutated and bred under external attack pressure; weak strains die, survivors reproduce, and every mutation, rejection, ancestor and promoted vaccine stays inspectable.

This is the first public release. MIT, no runtime dependencies, Node 20.11+.

## Result

**220 / 270 = 81.48% out-of-fold categorized-attack recall** on the OASB v2 corpus, across five independent evolutionary populations, with each authored attack fixture held out exactly once from the population that scored it.

| Category | Out-of-fold detected |
|---|---:|
| data_exfiltration | 29 / 30 |
| persistence | 28 / 30 |
| credential_exfiltration | 27 / 30 |
| heartbeat_rce | 27 / 30 |
| prompt_injection | 26 / 30 |
| social_engineering | 24 / 30 |
| unicode_stego | 24 / 30 |
| privilege_escalation | 19 / 30 |
| supply_chain | 16 / 30 |

Secondary: 29/34 = 85.29% recall on a sealed holdout opened once after champion selection. Small denominator; not comparable to a scanner measured over all 270 fixtures.

## Disclosure and limitations

- **OASB v2 was used as evolutionary selection pressure**, not as a held-out test set. The final champion's in-sample performance is not presented as a benchmark score.
- **No false-positive-rate claim.** OASB withdrew its precision, F1, FPR and flag-rate metrics on 2026-08-09 because much of the benign class was labeled using the scanner under test. Benign disagreement (49/3,975 out-of-fold) is reported as disagreement with corpus labels and used as counter-pressure, nothing more.
- **No comparability** to OASB or HackMyAgent historical scores is claimed, and **no certification, endorsement or approval** by the OASB project is implied.
- A promoted vaccine is a weighted-evidence text policy measured on one corpus. It can be evaded.

## Reproducibility

Corpus: OASB commit `fddf2b1379c5597a3e83a3c6f7833b8e5613a04e`, `corpus/v2.json`, SHA-256 `3ca866a0e637fa198bae17cd3a8f31fb02ad20f50fedcac1caa290e6dceba14e`. Seed `20260916`. Node 20 and 22.

Identical seed and corpus produce byte-identical artifacts. Published ledger head `d4ad72536338804cee4815c4e3e345b9103f31c285b4223a590e93782d0c7397`, anchor `anchor:5af96e8814d2b5acb8090bba147c6cfe4d2bf86a5c7495ab11f4614d6da5f9da`, 4,454 events.

```bash
OASB_DIR=/path/to/oasb ./scripts/reproduce.sh
```

## Since v0.1.1 (unreleased internal build)

An independent adversarial audit found non-reproducible timestamps hashed into the evidence chain, a chain not bound to the run that produced it, ledger verification that accepted reordering, elites reporting the wrong generation, invented duplicate parent edges, unreported elite cloning, and no guards against duplicate or oversized corpus samples. All fixed. The fixes were chosen so they could not perturb the evolutionary trajectory, and that was verified: same champion, same 29/34, same 220/270, byte-identical per-category counts. Full detail in `CHANGELOG.md`.

## Verify this download

```bash
shasum -a 256 antibody-reactor-v0.2.0.zip
```

Documentation: `README.md`, `ARCHITECTURE.md`, `CAPABILITY-CONTRACT.md`, `TEST-RESULTS.md`, `SUBMISSION.md`, `SECURITY.md`, `PROVENANCE.json`, `THIRD_PARTY.md`.
