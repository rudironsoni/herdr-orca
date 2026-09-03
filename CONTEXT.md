# herdr-orca-sync

Herdr owns every synchronized PTY, process, and agent. Orca owns the graphical surface that displays it. Git owns repository and worktree identity.

## Language

**Project**:
A Git repository identified by its canonical common dir, not by display name.
_Avoid_: Repo row, workspace group

**Worktree**:
A Git checkout path, canonicalized. Same branch names in two projects are two worktrees.
_Avoid_: Feature, task, workspace name

**Surface**:
One synchronized terminal pairing. Process identity is the Herdr `terminal_id`.
_Avoid_: Tab, pane, leaf as the process key

**Herdr-only**:
A Herdr terminal with no mapped Orca leaf.
_Avoid_: Unsynced Herdr tab

**Orca-only**:
An Orca-owned PTY that has not been replaced yet. The plugin replaces it with a Herdr terminal and an attach command. It does not steal the old PTY bytes.
_Avoid_: Unmanaged shell, native terminal

**Mapping**:
The live pairing. Orca's tab command `herdr-orca attach --terminal ID` is the join. Not a database row.
_Avoid_: Link, binding, association, journal

**Plugin hook**:
A `herdr-orca hook` entry in an agent's user config. It is a no-op unless attach or launch-agent set `HERDR_ORCA_SYNC=1` plus Orca ids on this Herdr pane. It does not edit Orca-owned hook files.
_Avoid_: Orca hook, managed hook

**Reconciler**:
The module that turns Herdr, Orca, Git, and mapping snapshots into a plan of operations.
_Avoid_: Sync engine, sidecar brain
