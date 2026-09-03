# Agents

This is a Herdr plugin. Herdr owns synchronized PTYs. Orca displays them.

Read `CONTEXT.md` for names. Read `README.md` for run commands.

Floors: Herdr protocol 18 or newer. Orca 1.4.170 or newer.

Do not patch Orca. Do not import `horca`. Do not copy `herdr-orca-open`.
Do not edit Orca-owned hook files. Plugin hooks live in agent user configs and no-op unless attach set HERDR_ORCA_SYNC plus Orca ids.

Process identity is `herdr_terminal_id`, never `pane_id`.

`pnpm test` then `pnpm build` then `node dist/herdr-orca.mjs doctor`.
