import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pluginConfigDir } from "./paths.ts";

export type SyncConfig = {
  adopt: boolean;
  replaceOrcaShells: boolean;
};

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  adopt: true,
  replaceOrcaShells: true,
};

export function parseSyncConfig(text: string | null): SyncConfig {
  const out: SyncConfig = { ...DEFAULT_SYNC_CONFIG };
  if (!text) return out;
  const adopt = text.match(/^\s*adopt\s*=\s*(true|false)\s*$/m);
  if (adopt) out.adopt = adopt[1] === "true";
  const replace = text.match(/^\s*replace_orca_shells\s*=\s*(true|false)\s*$/m);
  if (replace) out.replaceOrcaShells = replace[1] === "true";
  return out;
}

export function loadSyncConfig(home?: string, read: (path: string) => string | null = defaultRead): SyncConfig {
  return parseSyncConfig(read(join(pluginConfigDir(home), "config.toml")));
}

function defaultRead(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
