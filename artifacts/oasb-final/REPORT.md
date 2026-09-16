# SHPBL ANTIBODY REACTOR — Run Report

**What happened:** a population of defensive policies was bred under OASB-labeled selection pressure. The final holdout was not evaluated until one champion had already been selected from validation fitness.

## Receipt

- Corpus mode: `oasb-categorized`
- External corpus: 4245 samples, SHA-256 `3ca866a0e637fa198bae17cd3a8f31fb02ad20f50fedcac1caa290e6dceba14e`
- Partition: 2765 train / 838 validation / **642 sealed holdout**
- Generations: 24; population 40; elite 8
- Candidate antibodies discovered from training content: 360
- Fossil record: 4464 strains; champion ancestry: 71 strains
- Mutation rehearsals: 4424
- Evidence ledger: 4454 entries, verified=true, head `d4ad72536338804cee4815c4e3e345b9103f31c285b4223a590e93782d0c7397`
- Vaccine: `vax-c45267d9173363`

## Evolution

Generation 1 best validation fitness was **88.064**. Generation 24 reached **97.630**. The promoted descendant is `def-g24-c7fbd215ef`, generation 24, with 41 inherited/mutated rules at threshold 11.0459.

## Validation vs sealed holdout

| Measure | Validation | Holdout |
|---|---:|---:|
| Recall | 98.11% | **85.29%** |
| Precision* | 91.23% | 96.67% |
| F1* | 94.55% | 90.63% |
| MCC* | 0.9423 | 0.9033 |
| Corpus-labeled benign disagreement* | 0.64% | 0.16% |
| Reactor fitness | 97.630 | 91.860 |

* **Do not market these starred values as real-world accuracy.** OASB itself withdrew benign-derived scanner metrics for its published HMA comparison because most registry benign labels were selected by HMA's own export rule. Antibody Reactor retains the benign class as evolutionary counter-pressure, but the defensible external detection statistic is recall on categorized malicious fixtures.

## Holdout attack-family recall

| Attack family | Detected | Recall |
|---|---:|---:|
| credential_exfiltration | 2/2 | 100.00% |
| data_exfiltration | 6/6 | 100.00% |
| heartbeat_rce | 6/6 | 100.00% |
| persistence | 4/4 | 100.00% |
| privilege_escalation | 1/5 | 20.00% |
| prompt_injection | 3/3 | 100.00% |
| social_engineering | 2/2 | 100.00% |
| supply_chain | 4/5 | 80.00% |
| unicode_stego | 1/1 | 100.00% |

## Champion genome — strongest weighted evidence

| Evidence term / motif | Weight | Learned family | Origin |
|---|---:|---|---|
| `permissions` | 7.359 | privilege_escalation | bred |
| `note` | 7.306 | supply_chain | mutated |
| `file.write` | 7.000 | heartbeat_rce | bred |
| `workflow step` | 7.000 | credential_exfiltration | bred |
| `database_url` | 7.000 | data_exfiltration | bred |
| `telemetry` | 7.000 | credential_exfiltration | bred |
| `process.exec` | 7.000 | heartbeat_rce | bred |
| `endpoint` | 7.000 | credential_exfiltration | bred |
| `command node` | 7.000 | heartbeat_rce | bred |
| `instructions` | 7.000 | prompt_injection | bred |
| `__shell_surface__` | 7.000 | supply_chain | bred |
| `permanent` | 7.000 | persistence | bred |
| `curl bash` | 7.000 | supply_chain | bred |
| `__has_url__` | 7.000 | credential_exfiltration | bred |
| `node` | 6.843 | persistence | bred |
| `update` | 6.808 | heartbeat_rce | bred |
| `save` | 6.808 | persistence | bred |
| `disable` | 6.523 | privilege_escalation | bred |
| `dataset` | 6.463 | data_exfiltration | bred |
| `permanently` | 6.463 | persistence | bred |

## What makes this a reactor instead of a tuned regex list

The candidate evidence pool is discovered from the training split. Seed strains inherit different subsets and thresholds. Children are produced by crossover and mutation. Every child is evaluated by the external corpus oracle, then passed through mutation rehearsal; compound regressions are blocked and recorded as extinct. Selection pressure retains stronger descendants. Only after evolution stops is the holdout opened once. The promoted strain is converted into a vaccine artifact with an explicit deployment campaign.

The repository preserves the dead strains too. `fossil-record.json` is not cleanup debris; it is the experimental record of defenses that failed to survive.
