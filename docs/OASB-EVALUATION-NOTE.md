# OASB evaluation note

## What this result is

Antibody Reactor uses the Open Agent Security Benchmark (OASB) v2 categorized corpus as **selection pressure** for an evolutionary defense algorithm. OASB is therefore not merely a post-hoc test set in the flagship experiment; it is part of the training/evolution environment.

That makes a naive full-corpus leaderboard submission scientifically inappropriate: a final vaccine has inherited evidence discovered while OASB samples were available to the evolutionary process.

The project therefore reports a **five-fold out-of-fold evolutionary evaluation** instead:

- five independent defense populations;
- every one of the 270 categorized malicious OASB fixtures is held out from the population that scores it exactly once;
- the locked algorithm is not changed between folds;
- aggregate out-of-fold detection: **220 / 270 = 81.48% recall**;
- corpus-labeled safe disagreement is retained as selection counter-pressure but is not presented as a real-world false-positive rate, consistent with OASB's published caveat about scanner-derived benign labels.

## Why this is not an OASB leaderboard claim

The OASB public submission API expects one scanner/version to return a verdict for the benchmark dataset. Antibody Reactor's five-fold result is an evaluation of an **evolutionary procedure**, not a claim that one frozen vaccine independently achieved 81.48% on unseen OASB data.

Submitting the final vaccine against the same corpus it evolved on would overstate independence. This repository intentionally does not do that.

## What is independently reproducible

A reviewer can:

1. obtain OASB separately;
2. run `antibody-reactor crossvalidate` against `corpus/v2.json`;
3. confirm deterministic partitioning and that each sample is held out exactly once;
4. inspect the five champion summaries and aggregate category receipt;
5. verify the flagship run's SHA-256 evidence chain;
6. inspect parentage, mutations, blocked rehearsals, extinct strains, champion genome, and vaccine artifact.

## External material used for the recorded run

- OASB source archive SHA-256: `409eb9e3f440426e1cc6076f5f4ad0848221f15eb6a6d2fd96c8d4c9d0731b8a`
- OASB `corpus/v2.json` SHA-256: `3ca866a0e637fa198bae17cd3a8f31fb02ad20f50fedcac1caa290e6dceba14e`
- mode: categorized malicious fixtures only for recall (`270`, 30 across each of nine categories)

No OASB corpus content is redistributed here.

## 2026-11-26 correction

The later precision/F1 claim mixed this five-fold experiment with a separate frozen-policy benign count and is withdrawn. The earlier frozen-champion flag count also failed reproduction. The pinned frozen policy instead produces 229 TP, 9 FP, 41 FN and 168 TN over PR #411's 447 samples. All 447 were training/selection-exposed, so its internally consistent metrics remain research-only. See `EVIDENCE-CORRECTION-v0.3.1.md`.
