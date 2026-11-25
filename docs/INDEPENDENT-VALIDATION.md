# Independent validation — frozen v0.2.0 vaccine on unseen samples

**Nothing was trained, tuned or selected on these sets.** The v0.2.0 vaccine (`vax-c45267d9173363`, policy fingerprint `1da0784e…7901c`, file SHA-256 `8837f2bf…f6ded`, verified against `TRUSTED-FINGERPRINTS.json` before use) was applied as published: same 41 rules, same threshold 11.0459. Every sample file was hashed before scanning. Results are in `artifacts/independent-v0.3.0/results.json` and are recomputed exactly by test `P4` on every `npm test`, so they cannot be silently replaced.

Reproduce: `npm run build && npm run eval:independent`

## Results

| Set | Source | Malicious detected | Benign flagged | Unknown |
|---|---|---|---|---|
| `deepset-prompt-injections-test.json` | deepset/prompt-injections, `test` split, revision `4f61ecb0`, Apache-2.0. Third-party labels. | **0 / 60 (0.00%)** | 0 / 56 (0.00%) | 0 |
| `jackhhao-jailbreak-test.json` | jackhhao/jailbreak-classification, `test` split, revision `2f2ceeb3`, Apache-2.0. Third-party labels. | **49 / 139 (35.25%)** | 1 / 123 (0.81%) | 0 |
| `authored-agent-artifacts.json` | 24 malicious + 24 benign agent-artifact snippets (skills, MCP manifests, READMEs) written for this audit and hashed before any scoring. **Not independent:** written by the same agent that did the hardening. In-domain, small. | **6 / 24 (25.00%)** | 1 / 24 (4.17%) | 0 |

File SHA-256: deepset `bff312e0…55627`, jackhhao `58a87a0d…5b65b`, authored `5764b297…d798`.

## What this means

- **The vaccine does not generalise beyond OASB-shaped artifacts.** 0% on short chat-style prompt injections, about a third of role-play jailbreaks, a quarter of hand-written agent attacks. Out-of-fold recall on OASB was 81.48%; that number describes OASB's distribution, not attacks in general.
- The deepset and jackhhao sets are a distribution shift (chat prompts, partly German in deepset) from what the reactor was trained on (agent skill/config artifacts). They measure generalisation, not in-domain accuracy. The authored set is in-domain but small and not independent; treat it as a smoke test.
- Low benign flagging here is mostly a consequence of the vaccine flagging very little. It is not evidence of a low production false-positive rate.
- The one authored benign false positive (`authored-ben-12`, a legitimate `curl -I` health check) is a real false positive.
- These are measurements of v0.2.0's frozen policy. They were not used to change it, and must not be: a vaccine re-bred against these sets would need a new, untouched test set to say anything.

## Production consequence

The scanner is suitable as an **advisory signal in shadow mode** on OASB-like agent artifacts. It is **not** suitable as a sole gate, and not suitable for chat-prompt injection detection.
