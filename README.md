# herdr-orca-sync

Herdr plugin plus a user daemon that shows Herdr terminals inside stock Orca.

Herdr owns the PTY. Orca owns the window. Git owns the checkout.

This build is the doctor slice. It does not start the reconciler yet.

## Floors

- Herdr protocol 18 or newer
- Orca 1.4.170 or newer
- Node 20 or newer

## Install (local)

```bash
pnpm install
pnpm build
pnpm test
herdr plugin link .
node dist/herdr-orca.mjs doctor
node dist/herdr-orca.mjs doctor --json
```

`herdr plugin install` runs `pnpm install` then `pnpm build`. The build writes a small Node launcher at `dist/herdr-orca.mjs` that runs `src/main.ts`. launchd later starts that launcher. If Node is missing, the daemon does not start.

## How to test

1. `pnpm test` exits 0.
2. `pnpm build` writes `dist/herdr-orca.mjs`.
3. `node dist/herdr-orca.mjs doctor` prints Herdr protocol and Orca version.
4. `node dist/herdr-orca.mjs doctor --json` includes `"ok": true` when floors pass.

`herdr-orca attach --terminal ID` execs `herdr terminal attach ID --takeover` from an Orca PTY.

## CI and release

GitHub Actions:

- `.github/workflows/ci.yml` runs `pnpm test` and `pnpm build` on Ubuntu and macOS (Node 22). It uploads `dist/herdr-orca.mjs` as a workflow artifact.
- `.github/workflows/release.yml` uses `googleapis/release-please-action@v5`. Conventional Commits on `main` open a release PR that writes `CHANGELOG.md`, tags, and creates a GitHub Release. The release job attaches `herdr-orca-<version>-plugin.zip`.
- `.github/workflows/packages.yml` publishes `@rudironsoni/herdr-orca` to GitHub Packages (`https://npm.pkg.github.com`) when a GitHub Release is published.

```bash
pnpm add @rudironsoni/herdr-orca --registry=https://npm.pkg.github.com
```

CI does not start Herdr or Orca.

## SDK

PR1 will use `@herdr/sdk` from `github.com/rudironsoni/herdr-ts-sdk` branch `feat/support-protocols-19-and-20`. That git tree does not ship `dist`, so the plugin will pack it or use a `file:` path. Protocol 18 still needs an allowlist change on that branch.
