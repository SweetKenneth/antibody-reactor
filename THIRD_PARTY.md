# Third-party notices

Antibody Reactor has **no runtime dependencies**. `typescript` and `@types/node` are development dependencies only and are not distributed in release artifacts.

## Open Agent Security Benchmark (OASB)

- Project: <https://github.com/opena2a-org/oasb>
- Licence: Apache-2.0
- Used as: external evolutionary selection pressure and evaluation oracle
- Redistributed here: **no**

The corpus is not included in this repository, in whole or in part. Reproduction requires obtaining OASB separately. The pinned reference for the published run is commit `fddf2b1379c5597a3e83a3c6f7833b8e5613a04e`, file `corpus/v2.json`, SHA-256 `3ca866a0e637fa198bae17cd3a8f31fb02ad20f50fedcac1caa290e6dceba14e`.

Inclusion of OASB as a dependency is not a claim of endorsement, certification or approval by the OASB project or its maintainers.

## SHPBL / CMPSBL capability library

The composition was engineered from capability bodies in a private library owned by Kenneth E. Sweet Jr. (CMPSBL®). That library is **not distributed** here. `PROVENANCE.json` and `.shpbl/parents/manifest.json` identify the capability parents by name and seal so the composition is traceable; they contain no library source.

## This project

MIT, Copyright (c) 2026 Kenneth E. Sweet Jr. See `LICENSE`.
