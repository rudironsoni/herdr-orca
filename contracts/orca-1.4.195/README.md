# Orca 1.4.195

Captured on this machine. `/Applications/Orca.app` reports `CFBundleShortVersionString` 1.4.195.

`orca status --json` includes `runtime.appVersion` only while the app is running. When the runtime is down, doctor reads the app bundle.

`repo.list.unavailable.json` is the `runtime_unavailable` error from a down runtime. That is a warning, not a floor failure.
