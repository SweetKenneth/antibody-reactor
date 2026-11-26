# Draft follow-up for OASB issue #39 — founder approval required

**Do not post without explicit founder approval.** Earlier comments remain untouched.

---

Thank you again for checking the corpus receipt and for the methodological guidance on #411. I need to correct my follow-up comment.

I reported 80.88% precision and 81.18% F1 by combining 220 TP / 50 FN from the five-fold evolutionary evaluation with a separately reported frozen-champion benign count. That was not a valid scanner F1: the 220/270 recall aggregates predictions from five independently trained populations, not one frozen policy over one stated dataset.

The valid five-fold observation remains **220/270 = 81.48% out-of-fold categorized-attack recall**. It describes the evolutionary procedure and stays separate from frozen-policy scoring.

While reconstructing every cell from the original artifacts, I also found that my **52/177** benign-flag count was wrong. Running the pinned v0.2.0 vaccine through both the released v0.2.0 and v0.3.0 scanners against #411's exact 270 + 177 selection gives **229 TP, 9 FP, 41 FN, 168 TN, 0 unknown**. Thus the frozen-policy measurements are **9/177 = 5.08% FPR**, **96.22% precision**, **84.81% recall**, and **90.16% F1**. These figures now come from one policy and one 447-sample prediction set.

Importantly, these are still **training-exposed research measurements, not independent validation**. The 177 hand-written benign fixtures were already in the corpus used as evolutionary selection pressure. "No scanner labeled" does not mean unseen by Antibody Reactor. The corrected arithmetic does not change that limitation.

Corrected documentation and the reproducible calculation are on the `correction/v0.3.1` branch:

- https://github.com/SweetKenneth/antibody-reactor/blob/correction/v0.3.1/docs/EVIDENCE-CORRECTION-v0.3.1.md
- https://github.com/SweetKenneth/antibody-reactor/blob/correction/v0.3.1/artifacts/evidence-audit-v0.3.1/results.json

Antibody Reactor remains **advisory/shadow-only**. I am not requesting certification, endorsement, or a leaderboard ranking. Thank you for maintaining a benchmark where the methodology matters more than an impressive number.

— Kenneth E. Sweet Jr. (@SweetKenneth)
