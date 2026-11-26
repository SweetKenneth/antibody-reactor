# SHPBL ANTIBODY REACTOR

**v0.3.0 is released. v0.3.1 is an evidence-correction candidate, not published.** Advisory / shadow only. Not certified. Not independently reproduced by OASB. Not autonomous vaccine promotion. Not ready to block production traffic.

An experimental evolutionary agent-defense reactor: a governed breeding loop composes, mutates, selects, validates, and deploys **audit-ready security-policy candidates** (called "vaccines"), evaluated against the OASB corpus as evolutionary selection pressure, not against a fully unseen benchmark.

**Source and governance:** Six private SHPBL Governor Edition v1.7.12 capability bodies and contracts were examined and adapted into an independent TypeScript composition. Their source bodies and the private library are not distributed. Exact parent units are recorded in `.shpbl/parents/manifest.json`.

The reactor breeds vaccines. **SHPBL breeds the reactor.**

---

## Published evidence, with its actual limits

The published research claim is **220 / 270 = 81.48% five-fold out-of-fold categorized-attack recall**. Each attack was held out from the evolutionary population that evaluated it; the corpus was not unseen by development of the final frozen champion. The safe-labeled pool is **3,881 benign + 94 edge cases = 3,975**. Corpus label disagreements are **49 / 3,975 = 1.23%**; this is not a field false-positive rate.

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

Six parent capabilities from SHPBL Governor Edition v1.7.12 are documented in the preserved manifest. These are their **actual units and seals**, not substituted component identifiers.

| Source unit | Role | Seal |
| --- | --- | --- |
| `IMMUNITY::createAntibodyGenerator` | Threat memory and synthesized defense-rule semantics | `655cd4a8b9403925` |
| `IMMUNITY::createDefenseBreeder` | Strain parentage, mutation, crossover, survival and extinction | `0db02d516df916d7` |
| `ECHO::createMutationRehearsalEngine` | Candidate rehearsal, regression failures and verdicts | `793f191c3e86b64d` |
| `CORE::createEvidenceLedger` | Evidence ledger semantics, strengthened into a SHA-256 chain | `10a4adfdbecbbc13` |
| `IMMUNITY::synthesizeVaccine` | Promotion into a portable vaccine specification | `f96209bdd34a3380` |
| `IMMUNITY::planCampaign` | Staged deployment-campaign semantics | `e11b7b6f64363741` |

Provenance does not mean every safeguard survived the composition. The v0.3.0 source audit records which lifecycle controls had to be restored.

v0.3.0 adds bounded fail-closed scanning, vaccine validation, fingerprint verification and human-gated deployment controls. v0.3.1 corrects evidence accounting; it does not improve the frozen detector or make it production-ready.

## Install & reproduce

Node.js 20.11+ and a POSIX shell are required. These commands apply to the **draft v0.3.1 branch**; the latest public release remains v0.3.0.

```bash
git clone https://github.com/SweetKenneth/antibody-reactor.git
cd antibody-reactor
git checkout correction/v0.3.1
npm install --no-package-lock
npm run build
npm test
npm run verify:release

# Obtain OASB separately; its corpus is not redistributed here.
git clone https://github.com/opena2a-org/oasb.git ../oasb
git -C ../oasb checkout 8e4ed173f9a814cf61ade0ff48fe4a9b6a50847f
OASB_DIR="$(cd ../oasb && pwd)" ./scripts/reproduce.sh
```

The full reproduction script requires `OASB_DIR`, verifies the exact corpus SHA-256 and compares all historical artifacts. Run it from a clean checkout: the generated `artifacts/reproduced-*` output paths must not already exist.

Useful verification commands on the correction branch:

```bash
npm run verify:ledger
npm run verify:vaccine
npm run verify:evidence
npm run verify:claims
npm run eval:independent
OASB_DIR="$(cd ../oasb && pwd)" npm run audit:evidence
```

For new experiments, pass the corpus explicitly and use new output directories rather than overwriting historic evidence:

```bash
node dist/cli.js run --corpus "$OASB_DIR/corpus/v2.json" --out artifacts/my-experiment
node dist/cli.js crossvalidate --corpus "$OASB_DIR/corpus/v2.json" --out artifacts/my-cv5 --folds 5
```

## Scan artifacts (advisory/shadow only)

This example uses the compiled local checkout. The repository's pins are a consistency check; for independent trust, obtain them from an independently verified release channel.

```js readme-smoke
import { readFileSync } from 'node:fs';
import { AntibodyReactorScanner } from './dist/index.js';
const vaccine = JSON.parse(readFileSync('artifacts/oasb-final/vaccine.json', 'utf8'));
const pins = JSON.parse(readFileSync('TRUSTED-FINGERPRINTS.json', 'utf8'));
const release = pins.releases.find(r => r.version === '0.2.0');
if (!release) throw new Error('Missing v0.2.0 pin');
const scanner = new AntibodyReactorScanner(vaccine, {
  expectedPolicyFingerprint: release.vaccine.policyFingerprint,
  maxInputBytes: 1024 * 1024
});
const result = scanner.scanDetailed('name: weather-helper\\ndescription: Weather lookup', 'weather-helper');
console.log(result.verdict, result.policyFingerprint);
```

The CLI can additionally validate the vaccine's file hash using `--trusted TRUSTED-FINGERPRINTS.json --release 0.2.0`. An `unknown` verdict is not proof of safety, and the confidence value is not a calibrated probability.

## Human-authorized deployment lifecycle

The actual exported library uses `DeploymentController`, `FileDeploymentStore` and `denyAll`, with methods `plan`, `activate`, `promote`, `observe`, `decide`, `rollback`, `revoke`, and `abort`. This second example **only plans** a campaign:

```js readme-smoke
import { readFileSync } from 'node:fs';
import { DeploymentController, denyAll } from './dist/index.js';
const vaccine = JSON.parse(readFileSync('artifacts/oasb-final/vaccine.json', 'utf8'));
const pins = JSON.parse(readFileSync('TRUSTED-FINGERPRINTS.json', 'utf8'));
const release = pins.releases.find(r => r.version === '0.2.0');
if (!release) throw new Error('Missing v0.2.0 pin');
const controller = new DeploymentController(denyAll);
const campaign = controller.plan(vaccine, { expectedPolicyFingerprint: release.vaccine.policyFingerprint });
if (campaign.stage !== 'planning') throw new Error('Unexpected enforcement stage');
console.log(campaign.stage);
```

`FileDeploymentStore` is an optional single-writer checkpoint store, not a complete deployment system. Real activation and promotion require an authenticated operator, trusted monitoring labels and an integrated authorization system. No production enforcement is shipped.

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
src/                    independent TypeScript composition, scanner, deployment controller
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
