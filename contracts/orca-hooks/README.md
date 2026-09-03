# Orca agent-hooks contract

Captured from public CLI and docs. Not from Orca hook source.

| Artifact | Source |
| --- | --- |
| `status.sample.json` | `orca agent hooks status --json` on Orca 1.4.195. Home paths redacted. |
| `endpoint.env.keys.txt` | Keys in `{userData}/agent-hooks/endpoint.env` (POSIX). Token values are not stored. |

`orca agent hooks status --json` reports whether Orca-managed hooks are enabled. It does not include the POST URL.

Orca writes the live hook endpoint to `{userData}/agent-hooks/endpoint.env` (POSIX) or `endpoint.cmd` (Windows) and re-sources it on each hook run. Docs: https://www.onorca.dev/docs/agents/hooks-memory

Observed keys:

- `ORCA_AGENT_HOOK_PORT`
- `ORCA_AGENT_HOOK_TOKEN` (read at POST time, never stored)
- `ORCA_AGENT_HOOK_ENV`
- `ORCA_AGENT_HOOK_VERSION`
- `ORCA_AGENT_HOOK_TRANSPORT` (`raw-json-v1`)

This plugin POSTs `paneKey`, `tabId`, `source`, `hookEventName`, and `payload.state` (`working` / `waiting` / `done` / `idle` / `blocked`) when the Herdr plus Orca gate passes.

Do not copy Orca hook scripts into this repo. Do not edit `orca-status.json` or other Orca-owned hook files.
