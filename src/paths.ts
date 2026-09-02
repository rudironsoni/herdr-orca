import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const PLUGIN_ID = "rudironsoni.herdr-orca-sync";

export function pluginRootFromEntry(entryHref: string): string {
  const entryFile = fileURLToPath(entryHref);
  return dirname(dirname(entryFile));
}

export function pluginStateDir(home = homedir()): string {
  const xdg = process.env.XDG_STATE_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(home, ".local/state");
  return join(base, "herdr/plugins", PLUGIN_ID);
}

export function pluginConfigDir(home = homedir()): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(home, ".config");
  return join(base, "herdr/plugins/config", PLUGIN_ID);
}

export function distEntry(pluginRoot: string): string {
  return join(pluginRoot, "dist/herdr-orca.mjs");
}
