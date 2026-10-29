# Development

Use Node 24.22.1+ within Node 24 and the package manager in `package.json`.

```sh
pnpm install --frozen-lockfile --no-optional
pnpm typecheck
pnpm test
pnpm build
pnpm verify:package
node examples/offline-demo.mjs
```

`verify:package` builds the real tarball, checks its allowlisted contents, installs
it in a temporary consumer without lifecycle scripts, exercises exports/example
and checks TypeScript declarations. All fixtures are synthetic. Release assets
are written to ignored `.artifacts/`. No provider requests or DMs run in CI.

Add focused tests for protocol boundaries, errors and lifecycle changes. Never
use real account IDs, messages, credentials or private URLs as fixtures.
Research tooling is development-only. Browser observations attach only through
existing Chrome `--autoConnect`; see `docs/research-setup.md`. Live messages require
fresh exact approval. Do not automate login/challenges or retry uncertain sends.

## Releases

Update `package.json` and `CHANGELOG.md`, run all checks and inspect the package.
Use an annotated `v<version>` tag after checks pass. Upload the `.tgz` and
SHA256SUMS to the matching private GitHub release. Keep beta releases marked
prerelease until the documented reliability gaps have been validated.
