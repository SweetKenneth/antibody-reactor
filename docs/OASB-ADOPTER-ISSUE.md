# Draft OASB adopter / independent-evaluation issue

Post to <https://github.com/opena2a-org/oasb/issues> once v0.2.0 is released and the checksums below are live.

---

**Title:** Adopter: Antibody Reactor — evolutionary defense breeding using OASB v2 as selection pressure (220/270 out-of-fold)

Hi OASB maintainers,

`CONTRIBUTING.md` asks adopters to open an issue describing how we run OASB and against which product, so here it is — along with a methodology question I would rather ask than guess at.

## What Antibody Reactor is

An open-source (MIT) evolutionary research instrument for agent-artifact defense. It does not ship a hand-written ruleset. It discovers candidate threat evidence from a training split, seeds a population of defense strains, breeds them by crossover and mutation, rehearses every child before admission, kills regressions, preserves the rejected strains in a fossil record, and promotes one surviving descendant into a portable policy artifact. Every birth, rehearsal, generation and promotion is recorded in a SHA-256 hash chain anchored to the corpus hash and the run seed.

- Repository: https://github.com/SweetKenneth/antibody-reactor
- Release: v0.2.0
- Project page: https://shpbl.com/antibody-reactor
- Licence: MIT. No runtime dependencies. Node 20.11+.

## How we use OASB — full disclosure

**OASB v2 is our evolutionary selection pressure, not a held-out test set.** Training-split content drives rule discovery; validation-split labels are the fitness oracle that decides which strains reproduce. I am stating this up front because it determines which numbers are and are not defensible, and I do not want a number of mine read as something it is not.

- OASB commit: `fddf2b1379c5597a3e83a3c6f7833b8e5613a04e`
- Corpus: `corpus/v2.json`, SHA-256 `3ca866a0e637fa198bae17cd3a8f31fb02ad20f50fedcac1caa290e6dceba14e`
- Mode: categorized attacks (4,245 samples used; the 225 uncategorized registry samples are excluded from recall)
- Corpus is **not** redistributed in our repository. Reproduction requires cloning OASB.

## The result we do stand behind

Five-fold evolutionary validation with the algorithm, hyperparameters, mutation policy, population size, selection criteria and scoring locked before any fold ran. Five independent populations; each of the 270 authored attack fixtures held out exactly once from the population that scored it.

**Out-of-fold categorized-attack recall: 220 / 270 = 81.48%**

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

Supply chain and privilege escalation are our two weakest families. They are published at full weight rather than dropped.

Secondary evidence: a single sealed holdout, opened once after one champion was selected, gave 29/34 = 85.29% recall. Small denominator; not comparable to a scanner measured over all 270 fixtures.

## What we are explicitly not claiming

- **No false-positive-rate claim.** We saw your 2026-08-09 withdrawal of precision, F1, FPR and flag-rate metrics because much of the benign class was labeled using the scanner under test. We record benign disagreement (49/3,975 out-of-fold, 1.23%) purely as counter-pressure against flag-everything behaviour, and we say so everywhere it appears.
- **No comparability** to OASB or HackMyAgent historical scores.
- **No claim of certification, endorsement or approval** by OASB or its maintainers.
- **No hard-coded benchmark knowledge.** No sample id, expected answer, fixture filename or result category is looked up. Sample ids are used only for stable partition assignment and are echoed back to the harness; a test asserts that changing every id cannot change a verdict.

## Reproducibility

```bash
git clone https://github.com/SweetKenneth/antibody-reactor && cd antibody-reactor
git clone https://github.com/opena2a-org/oasb /tmp/oasb
git -C /tmp/oasb checkout fddf2b1379c5597a3e83a3c6f7833b8e5613a04e
OASB_DIR=/tmp/oasb ./scripts/reproduce.sh
```

That builds, runs 18 engineering checks, reproduces the sealed-holdout run, diffs a second identical run byte for byte, verifies the evidence chain, and reruns the five folds. Identical seed and corpus produce byte-identical artifacts, so you can check our published ledger head (`d4ad72536338804cee4815c4e3e345b9103f31c285b4223a590e93782d0c7397`) yourself rather than take our word for it.

Committed evidence: champion genome, full genealogy, lineage graph, fossil record of rejected strains, 4,424 mutation rehearsals, the promoted vaccine, the 4,454-event hash chain, and the five fold reports.

## Two questions

1. **Would you like us listed as an adopter / independent evaluation?** Our adapter (`src/oasb-scanner.ts`) matches your `ScannerAdapter` shape (`name`, `version`, `id`, async `scan(content, sampleId, artifactType)`).
2. **Do you want a hosted scanner submission from us, and if so under what eligibility rules?** We did not submit one. `api.oa2a.org/api/v1/benchmark/submit` is not reachable (404), and more importantly a system that used your corpus as selection pressure should not be entered as though the corpus were unseen. If a future dataset version arrives after our current vaccine is frozen, that would be a genuinely unseen external evaluation and we would happily run it and report whatever it says.

One more note, on your issue #24 about incomplete submissions earning a Gold tier: we validate our own submissions more strictly than the server does — exact dataset version, complete results for every required sample, no unknown or duplicate ids — and we fail locally rather than benefit from that gap.

Thanks for building and maintaining OASB. The external pressure is the entire reason this system has anything honest to report.

— Kenneth E. Sweet Jr. (@SweetKenneth)
