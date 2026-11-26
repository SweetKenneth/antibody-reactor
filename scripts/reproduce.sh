#!/usr/bin/env bash
# Reproduce every published claim from a clean checkout.
#
#   OASB_DIR=/path/to/oasb ./scripts/reproduce.sh
#
# OASB is not redistributed here. Clone it separately:
#   git clone https://github.com/opena2a-org/oasb
#   git -C oasb checkout 8e4ed173f9a814cf61ade0ff48fe4a9b6a50847f
set -euo pipefail

if [[ -z "${OASB_DIR:-}" ]]; then
  echo "Set OASB_DIR to a local OASB checkout, e.g. OASB_DIR=/path/to/oasb" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
CORPUS="$OASB_DIR/corpus/v2.json"
EXPECTED_CORPUS_SHA="3ca866a0e637fa198bae17cd3a8f31fb02ad20f50fedcac1caa290e6dceba14e"

echo "== corpus identity =="
ACTUAL_SHA="$(node -e "const{createHash}=require('node:crypto');const fs=require('node:fs');console.log(createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))" "$CORPUS")"
echo "corpus sha256: $ACTUAL_SHA"
if [[ "$ACTUAL_SHA" != "$EXPECTED_CORPUS_SHA" ]]; then
  echo "NOTE: this is not the corpus the published numbers were measured on." >&2
  echo "Expected $EXPECTED_CORPUS_SHA. Results below will legitimately differ." >&2
fi

echo "== build and engineering tests =="
npm install --no-package-lock
npm run build
npm test
npm run verify:release

echo "== sealed-holdout run =="
node dist/cli.js run --corpus "$CORPUS" --out artifacts/reproduced-final \
  --seed 20260916 --generations 24 --population 40 --elite 8

echo "== byte-for-byte determinism =="
node dist/cli.js run --corpus "$CORPUS" --out artifacts/reproduced-final-again \
  --seed 20260916 --generations 24 --population 40 --elite 8 >/dev/null
diff -r artifacts/reproduced-final artifacts/reproduced-final-again \
  && echo "identical across runs"

echo "== pinned ledger, vaccine, claims and checksum verification =="
node dist/cli.js verify --ledger artifacts/reproduced-final/evidence-ledger.json \
  --trusted TRUSTED-FINGERPRINTS.json --release 0.2.0 --require-pins

echo "== original final artifacts unchanged =="
diff -r artifacts/reproduced-final artifacts/oasb-final

echo "== five-fold out-of-fold evaluation (about one minute) =="
node dist/cli.js crossvalidate --corpus "$CORPUS" --out artifacts/reproduced-cv5 --folds 5

echo "== original five-fold artifacts unchanged =="
diff -r artifacts/reproduced-cv5 artifacts/oasb-cv5

echo "== corrected frozen-policy evidence =="
node scripts/audit-evidence.mjs
npm run verify:evidence

echo "Verified 220/270 five-fold recall and the separate frozen-policy confusion matrix."
