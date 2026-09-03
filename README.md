# Herdr Orca Sync

Show Herdr terminals inside stock Orca. Herdr owns the PTY. Orca owns the window.

Plugin id: `rudironsoni.herdr-orca-sync`.

## Floors

- Herdr protocol 18 or newer
- Orca 1.4.170 or newer
- Node 20 or newer
- macOS or Linux for the user service (launchd / systemd)

## Install

```bash
herdr plugin install rudironsoni/herdr-orca
herdr plugin enable rudironsoni.herdr-orca-sync
herdr-orca daemon ensure
herdr-orca doctor
herdr-orca hooks install
```

Herdr 0.8 does not run plugin startup on install. `daemon ensure` writes `~/.local/bin/herdr-orca` and a user service. After that, `herdr-orca` works in a login shell.

Uninstall the service before removing the plugin:

```bash
herdr plugin action invoke reset --plugin rudironsoni.herdr-orca-sync
herdr plugin uninstall rudironsoni.herdr-orca-sync
```

## Run the CLI

| Command | Where | What it does |
| --- | --- | --- |
| `herdr-orca` | Orca tab | Create a Herdr shell and attach |
| `herdr-orca --agent claude --` | Orca tab | Same, then start Claude |
| `herdr-orca --terminal ID` | Orca tab | Attach this tab to an existing Herdr terminal |
| `herdr-orca doctor` | anywhere | Check floors |
| `herdr-orca open-in-orca` | Herdr pane | Open this terminal in Orca |
| `herdr-orca sync` | anywhere | One reconcile tick |
| `herdr-orca repair` | anywhere | Ensure the service, then doctor |
| `herdr-orca hooks install` | anywhere | Add plugin-owned agent hooks |
| `herdr-orca daemon ensure` | anywhere | Shim + launchd/systemd |
| `herdr-orca daemon stop` | anywhere | Stop the daemon. Leave the service. |
| `herdr-orca daemon uninstall` | anywhere | Remove service and shim |

## Run from Herdr

Plugin Manager actions (or CLI):

```bash
herdr plugin action invoke doctor --plugin rudironsoni.herdr-orca-sync
herdr plugin action invoke open-in-orca --plugin rudironsoni.herdr-orca-sync
herdr plugin action invoke sync-now --plugin rudironsoni.herdr-orca-sync
```

**Open in Orca** on a pane creates an Orca tab whose command is `herdr-orca attach --terminal <id>`.

## Run from Orca

Set the tab command to `herdr-orca`. That is a Herdr shell. Closing Orca detaches. The Herdr process keeps running.

Start an agent in that shell, or use `herdr-orca --agent claude --`.

The daemon can replace an ordinary Orca Cmd-T shell with `herdr-orca` when `replace_orca_shells = true` (default).

## Config

`$(herdr plugin config-dir rudironsoni.herdr-orca-sync)/config.toml`

```toml
[sync]
adopt = false
replace_orca_shells = true
```

`adopt = true` lets the daemon create missing Orca attach tabs for Herdr terminals.

## Hooks

`herdr-orca hooks install` appends `herdr-orca hook --event …` to Claude, Codex, and Grok user configs. It does not edit Orca-owned hook files. The hook no-ops unless `HERDR_ENV=1`, `HERDR_ORCA_SYNC=1`, and `ORCA_TAB_ID` or `ORCA_PANE_KEY` are set.

## CI and release

- `ci.yml`: `pnpm test` and `pnpm build` on Ubuntu and macOS.
- `release.yml`: Release Please. Release PRs squash-merge after CI. The GitHub Release gets `herdr-orca-<version>-plugin.zip`.
- `packages.yml`: publishes `@rudironsoni/herdr-orca` to GitHub Packages.

```bash
pnpm add @rudironsoni/herdr-orca --registry=https://npm.pkg.github.com
```
