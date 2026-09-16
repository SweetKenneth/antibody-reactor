# Security policy

## Reporting

Report suspected vulnerabilities to **dev@KESJr.com** or by opening a private security advisory on <https://github.com/SweetKenneth/antibody-reactor/security/advisories>. Please do not open a public issue for an unpatched vulnerability.

## Scope and honest limits

Antibody Reactor is a research instrument for evolving and auditing detection policies. It is **not** a certified security control and carries no accuracy guarantee.

- A promoted vaccine is a weighted-evidence text policy. It can be evaded, and its measured recall comes from one benchmark corpus, not from live traffic.
- Reported benign disagreement is not a false-positive rate. See the claim boundaries in `PROVENANCE.json`.
- Corpus input is treated as untrusted: sample ids, labels and content are validated, size-bounded, and never interpreted as code. Sample ids never participate in classification.
- The CLI reads only the paths it is given, makes no network calls, and writes only to the output directory it is given.
- The evidence ledger is tamper-evident, not tamper-proof. It detects modification of the artifact it is verified against; it does not prevent an untrusted party from producing an entirely new consistent chain — which is why chains are anchored to the corpus hash and seed.

Deploy a vaccine in the staged shadow and canary phases recorded in the artifact before enforcing on production traffic.
