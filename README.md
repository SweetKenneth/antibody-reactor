# SHPBL ANTIBODY REACTOR

**v0.3.0 is released. v0.3.1 is an evidence-correction candidate, not published.** Advisory / shadow only. Not certified. Not independently reproduced by OASB. Not autonomous vaccine promotion. Not ready to block production traffic.

An experimental evolutionary agent-defense reactor: a governed breeding loop composes, mutates, selects, validates, and deploys **audit-ready security-policy candidates** (called "vaccines"), evaluated against an external, held-out adversarial corpus.

**Clean-room, spec-first public release.** The six capabilities were harvested from the private SHPBL Governor Edition v1.7.12 into a written specification (`CAPABILITY-CONTRACT.md`); this repository implements that specification from scratch in TypeScript under MIT. No harvested source bodies ship.

The reactor breeds vaccines. **SHPBL breeds the reactor.**

---

## Published evidence, with its actual limits

The published research claim is **220 / 270 = 81.48% held-out malicious recall**. Every malicious artifact in the selected corpus was held out from breeding. The safe-labeled pool is **3,881 benign + 94 edge cases = 3,975**. Corpus label disagreements are **49 / 3,975 = 1.23%**; this is not a field false-positive rate.

These are measurements from **five independently trained populations**, one frozen champion per held-out fold. They must not be combined with benign predictions from a different single frozen champion.

OASB PR #411's training-exposed 447-sample set was also re-run with the single v0.2.0 champion. The corrected, reproducible result is **229 TP, 9 FP, 41 FN, 168 TN** — precision 96.22%, recall 84.81%, F1 90.16%, benign flag rate 5.08%. The earlier public 80.88% precision / 81.18% F1 and 52/177 statements are withdrawn; see `docs/EVIDENCE-CORRECTION-v0.3.1.md`. That 447-sample set is training-exposed research evidence, **not independent validation**.

Genuinely unseen evaluation of one frozen champion is disappointing: 0/60 deepset, 49/139 jackhhao, 6/24 SHPBL-authored agent artifacts. Not production-ready.

## Evidence classes

| Class | What it is | What it is not |
| --- | --- | --- |
| Published research | Reproducible seed-pinned evolutionary recall against OASB's frozen corpus | OASB endorsement, certification, or a confirmed real-world detection rate |
| Training-exposed frozen evaluation | A deterministic scan of the pinned v0.2.0 vaccine over OASB PR #411's selected set | Independent validation, because these samples shaped selection |
| Engineering validation | Unit, integration, adversarial, security, and deterministic-replay tests (99 on the v0.3.1 candidate) | A model-quality or red-team certification |
| Production enforcement | **Not shipped.** `DeploymentController` is fail-closed and advisory by design | Automatic promotion, autonomous blocking, or a replacement for policy review |

## What this is

The public runtime composes six original SHPBL capabilities:

| Capability | Origin artifact (Governor Edition v1.7.12) | Role here |
| --- | --- | --- |
| DISCOVER | CML-ANTIBODY-0001 PATHOLOGY-ANTIGEN-SURFACE-MAPPER | Fit an external corpus into the antigen schema |
| MEASURE | CML-ANTIBODY-0003 IMMUNE-RESPONSE-ASSAY | Metrics, category breakdowns, dual-signal objectives |
| VALIDATE | CML-ANTIBODY-0004 PATHOGEN-SCREENING-ORACLE + CML-ANTIBODY-0005 IMMUNOASSAY-FOIL-PANEL | Label oracle (malicious) + safe-foil panel |
| EVOLVE | CML-ANTIBODY-0006 ANTIBODY-CLONAL-BREEDER | Staged mutation, crossover, elite selection, immutable generations |
| REFINE | CML-ANTIBODY-0007 IMMUNOASSAY-FITNESS-GATE | Elitism, no-mutation escape, champion shipping |
| DEPLOY | CML-ANTIBODY-0008 IMMUNE-EDITION-LEDGER-SEALER | SHA-256-linked, hash-sealed, replay-verifiable evidence ledger |

Parents are content-addressed and provenance-stamped (`.shpbl/parents/manifest.json`, `PROVENANCE.json`). Harvested bodies are **not** included; `.shpbl/parents/` intentionally holds only provenance.

`v0.3.0` adds fail-closed vaccine validation, trusted-fingerprint verification, bounded durable deployment state, and explicit human-authorization stages. `v0.3.1` adds evidence-provenance tests and claim/artifact verification. None of these changes improves the detector or establishes production readiness.

## Install & reproduce

Requires Node ≥ 20.11 and a POSIX shell (Windows: WSL or Git Bash).

```bash
git clone https://github.com/SweetKenneth/antibody-reactor.git
cd antibody-reactor
npm ci
npm test
npm run build
node scripts/verify-checksums.mjs CHECKSUMS-v0.3.1-candidate.sha256 --complete
./scripts/reproduce.sh
```

`npm ci` needs network access only on the first install. `reproduce.sh` rebuilds, runs the full regression suite, verifies the sealed ledger against `TRUSTED-FINGERPRINTS.json`, re-runs the full evolutionary run and five-fold cross-validation, and **compares the sealed published artifacts byte-for-byte**. It exits non-zero on any mismatch. A corrected training-exposed frozen-vaccine audit requires the pinned OASB corpus outside the package and is optional in the reproduction script.

Standalone commands:

```bash
npm run react                    # full evolutionary run into a new artifacts/oasb-final/
npm run crossvalidate            # 5-fold CV (reproduces the published recall)
npm run verify:ledger            # pinned sealed-ledger verification
npm run verify:vaccine           # pinned vaccine validation
npm run eval:independent         # frozen vaccine against the committed unseen test sets
npm run verify:evidence          # reconstructed corrected research accounting
npm run verify:claims            # current documentation consistency
npm run verify:release           # tests + pins + evidence + claims + artifacts + checksums
npm run audit:evidence           # reconstruct metrics from original artifacts (OASB corpus optional)
```

`verify:release` is the v0.3.1 candidate's complete local verification gate. GitHub Actions has not yet been observed running this candidate; see `docs/CI-WORKFLOW-OWNER-ACTION.md`.

## Scan artifacts (advisory / shadow only)

```ts
import { AntibodyReactorScanner } from 'antibody-reactor';
import { readFileSync } from 'node:fs';

const vaccine = JSON.parse(readFileSync('artifacts/oasb-final/vaccine.json', 'utf8'));
const trusted = JSON.parse(readFileSync('TRUSTED-FINGERPRINTS.json', 'utf8'))
  .releases.find(r => r.version === vaccine.release);
const scanner = new AntibodyReactorScanner(vaccine, {
  expectedPolicyFingerprint: trusted?.policySha256,
  maxInputBytes: 1024 * 1024,
});

const result = scanner.scanDetailed(untrustedArtifactText, 'artifact-123');
// result.verdict: 'malicious' | 'benign' | 'unknown'
// Treat 'unknown' as un-scanned, never as safe. Do not use this alone to block.
```

The vaccine is structurally validated and its canonical policy fingerprint is pinned before scanning. Oversized or non-string inputs return `unknown` rather than a false safe verdict. `confidence` is explicitly a **bounded margin heuristic, not a calibrated probability**; a benign result is capped below the malicious band because zero matched rules is only "no known evidence".

## Human-authorized deployment controller

```ts
import { DeploymentController, DurableDeploymentStore } from 'antibody-reactor';

const store = await DurableDeploymentStore.open('./state/deployment.json');
const deployment = new DeploymentController({ store, trustedPin: trusted?.policySha256, humanApproval: true });
deployment.observe({ requestId: 'req-1', vaccineId: vaccine.id, policyFingerprint: scanner.policyFingerprint });
deployment.approve({ vaccineId: vaccine.id, actor: 'operator-1', reason: 'Shadow review accepted' });
deployment.promoteCanary({ vaccineId: vaccine.id, requestId: 'req-1', actor: 'operator-1', reason: 'Approved 5% canary', canaryPercent: 5 });
```

`approve()` and `promoteCanary()` require an explicit non-empty actor and reason; they still do not turn on enforcement. Observe before canary, inject `humanApproval: true` deliberately, and retain rollback authority with a real operator.

The controller itself only gates a caller-supplied authorization callback. It **does not** establish operator identity, RBAC, SSO, durable alerts, or a trusted deployment environment. Connect those controls before any real rollout.

The full contract, limits, and rollback/expiry semantics are in `docs/PRODUCTION-SAFEGUARDS.md`.

## SHPBL governance boundary

- Original SHPBL library is unchanged; no parent body ships here.
- Composition order is provenance, not a claim that every original protection survived; the v0.3.0 audit in `docs/AUDIT-v0.3.0.md` records what had to be rebuilt.
- No autonomous vaccine promotion, no production enforcement, no self-modifying runtime.
- Every evolutionary run is recorded in an append-only SHA-256-linked ledger with immutable evidence artifacts.
- Human authorization remains mandatory for canary and any future promotion.

## What v0.3.1 does not fix

- Recall on genuinely unseen distributions is weak; the evolutionary algorithm and vaccine are deliberately unchanged.
- OASB PR #411's set is training-exposed; its corrected F1 is not independent evidence.
- No real authenticated control plane, trusted feedback source, target-environment rollout test, or independent engineering review.
- No claim of OASB certification, endorsement, or leaderboard ranking.

See `docs/INDEPENDENT-VALIDATION.md`, `docs/EVIDENCE-CORRECTION-v0.3.1.md`, and `docs/REAUDIT-v0.3.0.md` for the full accounting.

## Repository layout

```
src/                    clean-room runtime, scanner, deployment controller
scripts/reproduce.sh    seeded reproduction + byte comparison
scripts/verify-*.mjs    evidence, claims, artifact and checksum gates
test/                   engineering and regression suite
test-sets/              frozen post-v0.2.0 datasets, hashes and provenance
artifacts/              published research artifacts and evidence ledgers
docs/                   audit, safeguards, validation and submission records
.shpbl/parents/         provenance only (no harvested bodies)
TRUSTED-FINGERPRINTS.json  independently supplied SHA-256 policy/ledger pins
```

## Documentation

- `CAPABILITY-CONTRACT.md` — the written spec of all six parents, with the v0.3.0/v0.3.1 contracts appended
- `PROVENANCE.json` — composition, lineage, licensing, published evidence and correction record
- `docs/AUDIT-v0.3.0.md` — historical source/governance audit, with dated release and evidence addenda
- `docs/REAUDIT-v0.3.0.md` — independent review of the original hardening, with dated addenda
- `docs/EVIDENCE-CORRECTION-v0.3.1.md` — reconstructed measurements and correction record
- `docs/INDEPENDENT-VALIDATION.md` — genuinely unseen frozen-policy tests, kept separate from training-exposed results
- `docs/PRODUCTION-SAFEGUARDS.md` — shadow/canary/rollback/monitoring contract and v1.0.0 blockers
- `docs/OASB-ISSUE-39-CORRECTION-DRAFT.md` — proposed public correction, **not posted**
- `TEST-RESULTS.md` — exact test totals, commands, and historical transcripts
- `CHANGELOG.md` — v0.2.0 → v0.3.0 → v0.3.1 candidate record

## License

MIT — © 2026 Kenneth E. Sweet Jr. See `LICENSE`. OASB corpus remains upstream Apache-2.0; attribution and corpus provenance in `THIRD_PARTY.md`. SHPBL parent capabilities are licensed to this composition; no Governor Edition source is redistributed.

**Use in production at your own risk. This is a research-grade advisory scanner with reproducible evidence, not a certified security control.**
