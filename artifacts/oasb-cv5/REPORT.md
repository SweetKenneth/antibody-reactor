# Antibody Reactor — 5-fold OASB validation

Each OASB categorized malicious fixture is held out exactly once from the population that scores it.

**Out-of-fold attack recall: 220/270 = 81.48%**

Corpus-labeled safe disagreement: 49/3975 = 1.23% (not a real-world FPR claim; see caveat).

| Category | Detected | Recall |
|---|---:|---:|
| credential_exfiltration | 27/30 | 90.0% |
| data_exfiltration | 29/30 | 96.7% |
| heartbeat_rce | 27/30 | 90.0% |
| persistence | 28/30 | 93.3% |
| privilege_escalation | 19/30 | 63.3% |
| prompt_injection | 26/30 | 86.7% |
| social_engineering | 24/30 | 80.0% |
| supply_chain | 16/30 | 53.3% |
| unicode_stego | 24/30 | 80.0% |
