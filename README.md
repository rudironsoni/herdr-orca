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
5. `node dist/herdr-orca.mjs hooks status --json` reports plugin-owned hook entries. `hooks install` is opt-in on your machine.

`herdr-orca attach --terminal ID` copies `HERDR_ORCA_SYNC=1` and `ORCA_*` into the Herdr pane, then execs `herdr terminal attach ID --takeover`.

`herdr-orca launch-agent [--agent KIND]` creates a Herdr tab from the current Orca PTY, injects `HERDR_ORCA_SYNC` and `ORCA_*`, then attaches.

`herdr-orca daemon --foreground` polls both sides. It matches Orca tabs whose command is `herdr-orca attach --terminal ID`. Pass `--adopt` to create missing Orca attach tabs. Without `--adopt` it does not flood Orca.

`herdr-orca hooks install` appends `herdr-orca hook --event …` to Claude, Codex, and Grok user configs. It never edits Orca-owned hook files. The hook prints nothing and exits 0 unless `HERDR_ENV=1`, `HERDR_ORCA_SYNC=1`, and `ORCA_TAB_ID` or `ORCA_PANE_KEY` are set.

Set `[agents] hooks_install = false` in the plugin config to refuse install.

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
