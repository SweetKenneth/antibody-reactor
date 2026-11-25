# SHPBL ANTIBODY REACTOR

> **v0.3.0 candidate (branch `hardening/v0.3.0`, unreleased).** Fail-closed scanning, vaccine validation, pinned evidence verification and a human-gated shadow/canary/rollback controller. Independent testing of the frozen v0.2.0 vaccine found it **does not generalise** beyond OASB-shaped agent artifacts (0/60 chat prompt injections, 49/139 jailbreaks, 6/24 hand-written agent attacks). Use it as an advisory signal in shadow mode only. See `docs/AUDIT-v0.3.0.md`, `docs/INDEPENDENT-VALIDATION.md`, `docs/PRODUCTION-SAFEGUARDS.md`. Everything below describes the published v0.2.0 release.

> **The security policies reproduce. OASB decides which offspring survive.**

Antibody Reactor is an evolutionary defense laboratory composed from SHPBL/CMPSBL capabilities and driven by an external security corpus. It does not start with a hand-written scanner ruleset. It discovers candidate threat evidence from a training environment, creates populations of defensive strains, breeds them through crossover and mutation, rehearses every child, kills regressions, preserves the dead in a fossil record, and promotes one surviving descendant into a deployable **vaccine** artifact.

The first target arena is the Open Agent Security Benchmark (OASB) v2 corpus.

- Repository: <https://github.com/SweetKenneth/antibody-reactor>
- Project page and download: <https://shpbl.com/antibody-reactor>
- Licence: MIT
- Requires: Node 20.11 or newer, no runtime dependencies

## What makes it weird

A defense has parents.

A defense can mutate.

A mutation can be rehearsed and killed before it reproduces.

A promoted defense has a family tree explaining exactly which ancestors it came from.

Every birth, rehearsal, generation and promotion is written into a SHA-256 hash-chained evidence ledger.

The dead policies are not deleted. `fossil-record.json` preserves them as the experimental history of defenses that failed selection.

The champion is converted into `vaccine.json`: a portable weighted-evidence policy plus a staged deployment campaign.

## Stronger validation: five independent populations

After the single sealed-holdout run, the same locked reactor algorithm was run as **5-fold evolutionary validation**. Each of OASB's 270 categorized malicious fixtures was held out exactly once from the population that scored it.

**Out-of-fold categorized-attack recall: 220 / 270 = 81.48%.**

The five populations independently promoted different champions. Aggregate category results were:

| Family | Out-of-fold detected |
|---|---:|
| credential_exfiltration | 27 / 30 |
| data_exfiltration | 29 / 30 |
| heartbeat_rce | 27 / 30 |
| persistence | 28 / 30 |
| privilege_escalation | 19 / 30 |
| prompt_injection | 26 / 30 |
| social_engineering | 24 / 30 |
| supply_chain | 16 / 30 |
| unicode_stego | 24 / 30 |

Across the same five held-out folds, 49 of 3,975 non-malicious/edge corpus artifacts were flagged (1.23%). That number is retained as evolutionary counter-pressure, **not marketed as real-world FPR**, because of OASB's documented registry-label caveat.

See `artifacts/oasb-cv5/cross-validation.json` and `artifacts/oasb-cv5/REPORT.md`.


## OASB submission posture

Antibody Reactor uses OASB as evolutionary selection pressure, so the checked-in final vaccine is **not** submitted as if OASB were an unseen post-hoc test set. The defensible receipt is the five-fold out-of-fold evolutionary evaluation above.

For the current external-validation path, see [`SUBMISSION.md`](SUBMISSION.md) and [`docs/OASB-ADOPTER-ISSUE.md`](docs/OASB-ADOPTER-ISSUE.md). The proposed first submission is an OASB adopter / independent-evaluation issue, not a misleading leaderboard entry.

## Current external-oracle run

The checked-in `artifacts/oasb-final/` run used OASB v2 in the benchmark's categorized-attack mode: 270 authored malicious attack fixtures plus the corpus benign and edge-case material. The 225 uncategorized registry samples whose malicious labels came from scanner-derived registry metadata were excluded from evolutionary recall, matching OASB's current `--categorized-only` benchmark methodology.

- External samples used: **4,245**
- Partition: **2,765 train / 838 validation / 642 sealed holdout**
- Generations: **24**
- Population: **40**
- Champion: `def-g24-c7fbd215ef`
- Champion genome: **41 rules**, threshold `11.0459`
- Validation recall: **98.11%** (52/53 categorized attacks)
- Sealed-holdout recall: **85.29%** (29/34 categorized attacks)
- Holdout corpus-labeled benign disagreement: **0.16%** (1/608 safe-labeled/edge artifacts counted by the confusion matrix)
- Holdout F1*: **90.63%**
- Holdout MCC*: **0.9033**
- Evidence events: **4,454**, hash chain verified
- Mutation rehearsals: **4,424** — 769 safe, 1,439 risky, 2,216 blocked

\* OASB itself cautions against treating benign-derived metrics from this corpus as independent real-world scanner accuracy because most registry benign labels were created through a prior scanner-selection process. Antibody Reactor keeps those labels as useful counter-pressure against "flag everything" behavior, but the defensible external detection receipt here is categorized malicious recall on the sealed holdout. The 34-attack holdout is also small; do not compare 85.29% directly to a scanner number measured on all 270 fixtures.

### Holdout attack-family receipt

| Family | Detected / holdout |
|---|---:|
| credential_exfiltration | 2 / 2 |
| data_exfiltration | 6 / 6 |
| heartbeat_rce | 6 / 6 |
| persistence | 4 / 4 |
| privilege_escalation | 1 / 5 |
| prompt_injection | 3 / 3 |
| social_engineering | 2 / 2 |
| supply_chain | 4 / 5 |
| unicode_stego | 1 / 1 |

The weakness is visible instead of hidden: this descendant still struggles with privilege escalation in the sealed sample. That failure is exactly the kind of pressure a future generation can attack.

## Architecture

```text
OASB corpus
   │
   ├── stable train / validation / sealed-holdout partition
   │
   ├── TRAIN ──> antibody evidence discovery
   │                  │
   │                  v
   │            seed defense strains
   │                  │
   │          crossover + mutation
   │                  │
   └── VALIDATION ──> external fitness oracle
                      │
               mutation rehearsal
                 │           │
              survive       die ──> fossil record
                 │
              reproduce
                 │
            generation N
                 │
            ONE champion
                 │
   SEALED HOLDOUT opens once
                 │
                 v
              vaccine.json
                 │
          deployment campaign
```

## Reproduce the experiment

No OASB corpus is redistributed in this project. Download/clone OASB separately and point the reactor at its corpus.

```bash
npm install
npm run build
node dist/cli.js run \
  --corpus /path/to/oasb/corpus/v2.json \
  --out artifacts/my-run \
  --generations 24 \
  --population 40 \
  --elite 8
```

By default, `run` uses OASB categorized-attack mode. Add `--all-malicious` only if you intentionally want to include the 225 uncategorized registry samples.

## Use the promoted vaccine

```bash
node dist/cli.js scan \
  --vaccine artifacts/oasb-final/vaccine.json \
  --file /path/to/agent-artifact.md
```

The scan response includes verdict, score, threshold, candidate category, and every matched inherited/mutated evidence rule.

## Verify the fossil record's evidence chain

```bash
node dist/cli.js verify \
  --ledger artifacts/oasb-final/evidence-ledger.json
```

A valid run returns `"valid": true` and the ledger head hash.

## OASB adapter

`AntibodyReactorScanner` in `src/oasb-scanner.ts` is structurally compatible with OASB's skills-security `ScannerAdapter` contract (`name`, `version`, `id`, and async `scan(content, sampleId, artifactType)`). The `sampleId` is echoed back to the harness and **never participates in classification**.

## Scientific guardrails

1. Candidate rules are discovered from **training content only**.
2. Sample IDs are used only for stable partition assignment and result echoing; they never become classification evidence.
3. Validation labels drive evolutionary selection.
4. The holdout is not tokenized or evaluated until one champion has already been selected.
5. Blocked mutations are retained in the fossil record rather than silently discarded.
6. Every final rule contains its original training evidence counts and its inheritance source (`seeded`, `bred`, or `mutated`).
7. The external corpus is addressed by SHA-256 in run artifacts.
8. This is an adaptive-defense experiment, not a claim of real-world detection prevalence or certified security.

## SHPBL composition provenance

The composition was engineered from these owned SHPBL/CMPSBL capability bodies:

| Parent | Seal | Load-bearing contribution |
|---|---|---|
| `IMMUNITY::createAntibodyGenerator` | `655cd4a8b9403925` | Threat memory and synthesized countermeasure model |
| `IMMUNITY::createDefenseBreeder` | `0db02d516df916d7` | Strains, parentage, crossover, mutation, survival/extinction |
| `ECHO::createMutationRehearsalEngine` | `793f191c3e86b64d` | Pre-promotion rehearsal and safe/risky/blocked verdicts |
| `CORE::createEvidenceLedger` | `10a4adfdbecbbc13` | Auditable evidence record; strengthened here into a hash chain |
| `IMMUNITY::synthesizeVaccine` | `f96209bdd34a3380` | Promotion of a learned defense into a portable hardening artifact |
| `IMMUNITY::planCampaign` | `e11b7b6f64363741` | Staged deployment-plan semantics |

See `PROVENANCE.json`, `.shpbl/parents/manifest.json`, and `CAPABILITY-CONTRACT.md`.

## Licensing and attribution

**MIT.** The rights holder, Kenneth E. Sweet Jr., released this project under the MIT licence for public adoption. See [`LICENSE`](LICENSE).

The MIT grant covers this repository only. It does not extend to the private SHPBL/CMPSBL capability library the composition was engineered from — that library is not distributed here, in whole or in part — and it does not extend to the OASB corpus, which is Apache-2.0 material belonging to the OASB project and is likewise not redistributed here.

Parts are composed from capability material created by **Kenneth E. Sweet Jr. (CMPSBL®)**, who is the same person releasing this project under MIT. See [`THIRD_PARTY.md`](THIRD_PARTY.md) and [`PROVENANCE.json`](PROVENANCE.json).

## Reproducibility

Identical inputs produce identical evidence, byte for byte. Every timestamp that enters a published artifact or hashed ledger material comes from a logical clock (`src/clock.ts`), not from wall time, and the evidence chain is anchored to a value derived from the corpus SHA-256 and the run seed — so a valid ledger from one run cannot be presented as evidence for another.

```bash
node dist/cli.js run --corpus /path/to/oasb/corpus/v2.json --out artifacts/a --seed 20260916
node dist/cli.js run --corpus /path/to/oasb/corpus/v2.json --out artifacts/b --seed 20260916
diff -r artifacts/a artifacts/b   # no differences
```

`OASB_DIR=/path/to/oasb ./scripts/reproduce.sh` runs the sealed-holdout run, the five-fold evaluation, the byte-for-byte determinism check and ledger verification in sequence.

The published run above was produced from OASB commit `fddf2b1379c5597a3e83a3c6f7833b8e5613a04e`, corpus `v2.json`, SHA-256 `3ca866a0e637fa198bae17cd3a8f31fb02ad20f50fedcac1caa290e6dceba14e`, seed `20260916`, on Node 20 and Node 22.

## What changed in 0.2.0

0.2.0 is an independent adversarial audit of 0.1.1 followed by remediation. The published results did not change — the same champion, the same 29/34 sealed holdout, the same 220/270 out-of-fold recall — because the fixes were deliberately chosen not to perturb the evolutionary trajectory. What changed is that the evidence is now reproducible and the reporting is now truthful. See [`CHANGELOG.md`](CHANGELOG.md).
