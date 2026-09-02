import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Surface } from "./reconcile.ts";

export function openState(dbPath: string): DatabaseSync {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
    INSERT INTO schema_version (version)
      SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM schema_version);
    CREATE TABLE IF NOT EXISTS mapping (
      herdr_terminal_id TEXT,
      orca_tab_id TEXT,
      orca_pane_key TEXT,
      title TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mutation (
      id TEXT PRIMARY KEY,
      field TEXT NOT NULL,
      target TEXT NOT NULL,
      expected_value TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      acknowledged_at INTEGER
    );
  `);
  return db;
}

export function loadMappings(db: DatabaseSync): Surface[] {
  const rows = db.prepare("SELECT herdr_terminal_id, orca_tab_id, orca_pane_key, title FROM mapping").all() as Array<{
    herdr_terminal_id: string | null;
    orca_tab_id: string | null;
    orca_pane_key: string | null;
    title: string | null;
  }>;
  return rows.map((row) => ({
    herdrTerminalId: row.herdr_terminal_id,
    orcaTabId: row.orca_tab_id,
    orcaPaneKey: row.orca_pane_key,
    title: row.title,
  }));
}

export function upsertMapping(db: DatabaseSync, surface: Surface): void {
  db.prepare("DELETE FROM mapping WHERE herdr_terminal_id = ? OR (orca_tab_id = ? AND orca_pane_key = ?)").run(
    surface.herdrTerminalId,
    surface.orcaTabId,
    surface.orcaPaneKey,
  );
  db.prepare(
    "INSERT INTO mapping (herdr_terminal_id, orca_tab_id, orca_pane_key, title, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(surface.herdrTerminalId, surface.orcaTabId, surface.orcaPaneKey, surface.title, Date.now());
}
