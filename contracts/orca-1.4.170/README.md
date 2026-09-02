# Orca 1.4.170 contract

Floor version. Captured from horca git tag v1.4.170, not from a running 1.4.170 app.

- `orca terminal list` flags: `--worktree`, `--limit`, `--json`. No `--include-visual-layouts`.
- `visualLayouts` still appears in terminal JSON format code (`src/cli/terminal-format.ts`).
- `orca terminal create --command --title --json` exists.
- `orca agent hooks status --json` exists.

Newer Orca omits `visualLayouts` unless `--include-visual-layouts` is passed.
