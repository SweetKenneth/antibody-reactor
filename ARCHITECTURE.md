# Architecture — Antibody Reactor

Antibody Reactor is deliberately split into six load-bearing organs rather than one benchmark script.

## 1. Antigen presentation — `features.ts`

Turns training artifacts into content-derived evidence. Candidate rules are admitted only when they have positive malicious-vs-safe discrimination. The system includes a small set of generic structural sensors (URL, shell surface, credential surface, instruction override, exfiltration motif, Unicode/zero-width/base64-like structure) but does not contain OASB sample IDs.

## 2. Immune population — `breeder.ts`

Maintains defense strains. Each strain is a genome: weighted evidence rules + a decision threshold. Reproduction crosses parent genomes, mutates rule membership/weights/threshold, and records ancestry.

## 3. Selection pressure — `evaluate.ts`

Validation artifacts are prepared once and treated as immutable environmental pressure. Fitness combines MCC, malicious recall, specificity and a nonlinear benign-disagreement penalty. "Flag everything" is not a viable evolutionary strategy.

## 4. Rehearsal chamber — `rehearsal.ts`

Every child is compared with a baseline parent before admission. Dangerous compound regressions are blocked. Risky children may survive only when their total fitness remains inside the allowed exploration floor.

## 5. Fossil/evidence system — `ledger.ts` + run artifacts

The hash chain records the experiment. The fossil record stores extinct and surviving strains. Champion ancestry is separately extracted and rendered as Graphviz DOT.

## 6. Vaccine surface — `vaccine.ts` + `oasb-scanner.ts`

The champion is detached from the training machinery and serialized into a portable vaccine. The runtime scanner needs only that vaccine and the target artifact. A staged deployment campaign is included but never auto-executed.

## Why the holdout is physically late

`runReactor()` creates validation features before breeding. It does **not** call `prepareSamples(split.holdout)` until after sorting the final population and marking one champion `promoted`. This keeps the holdout outside the evolutionary loop by construction.
