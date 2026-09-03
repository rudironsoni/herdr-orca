# Contracts

Versioned JSON and CLI shapes the reconciler must accept.

| Dir | Source |
| --- | --- |
| `herdr-p18/` | `herdrdev/herdr` commit `8843bbb0` schema, protocol 18 |
| `herdr-p19/` | tag `v0.8.0` schema, protocol 19 |
| `herdr-p20/` | live `herdr api schema --json` on 0.8.2, protocol 20 |
| `orca-1.4.170/` | horca git tag `v1.4.170` CLI spec. No running 1.4.170 app. |
| `orca-1.4.195/` | this machine. App bundle 1.4.195. Runtime may be down. |
| `orca-hooks/` | `orca agent hooks status --json` plus endpoint.env key names. No hook source. |

Do not treat this machine's live Orca snapshot as the floor. 1.4.170 has no `--include-visual-layouts`. Newer Orca omits `visualLayouts` unless that flag is passed.
