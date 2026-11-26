# Required owner action — CI workflow permission

The stronger workflow is present in the retained local package and in `CI-WORKFLOW-v0.3.1.patch`. It is **not claimed as landed on GitHub** unless the correction branch actually contains it and its run passes.

## Exact change

From the v0.3.0 workflow, replace the evidence step with:

```yaml
      - name: Verify release evidence, claims, pins and checksums
        run: npm run verify:release
```

This one command performs the complete compiled test suite, pinned evidence-ledger verification, vaccine fingerprint verification, corrected-evidence checks, cross-experiment mixing regressions through the test suite, current-claim consistency checks, historical artifact verification, and complete candidate checksum validation.

## Apply on GitHub

1. Open the correction branch's `.github/workflows/ci.yml` in GitHub's editor.
2. Apply `CI-WORKFLOW-v0.3.1.patch`, or make the exact replacement above.
3. Commit with a message such as `ci: verify corrected evidence and release claims`.
4. Let both the Node 20 and Node 22 jobs finish, then inspect the actual checks on the pull request.

The repository token available to the agent previously lacked permission to change workflow files. If the same refusal occurs on this candidate, the owner must apply this patch. Local successful commands are not represented as a GitHub CI pass.
