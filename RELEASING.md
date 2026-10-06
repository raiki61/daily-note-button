# Releasing

1. Bump `version` in `package.json` and add an entry to `CHANGELOG.md`.
2. Commit, then push a tag that matches the version: `git tag v0.1.1 && git push origin v0.1.1`.
3. The `publish` workflow runs the tests and publishes to the Marketplace as `raiki-kiyomura`.

The workflow authenticates with the `VSCE_PAT` repository secret, an Azure DevOps personal access token (organization: All accessible organizations, scope: Marketplace › Manage). It expires no later than 2026-12-01, when Azure DevOps retires global PATs; after that, publishing fails until the workflow moves to Microsoft Entra ID (`vsce publish --azure-credential`, see the VS Code "Publishing Extensions" guide).
