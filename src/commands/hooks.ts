import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { asRecord, parseJson } from "../run.ts";
import { HOOK_EVENTS, hookCommand, isPluginHookCommand } from "../hooks.ts";

export type HookTargetId = "claude" | "codex" | "grok" | "opencode";

export type HookTargetReport = {
  id: HookTargetId;
  path: string | null;
  skipped: boolean;
  reason: string | null;
  ours: number;
  present: boolean;
};

export type HooksStatus = {
  ok: boolean;
  targets: HookTargetReport[];
};

export type FsHooks = {
  home: string;
  env: NodeJS.ProcessEnv;
  read: (path: string) => string | null;
  write: (path: string, text: string) => void;
  remove: (path: string) => void;
  mkdirp: (path: string) => void;
};

export function isOrcaOwnedConfig(path: string): boolean {
  const n = path.replaceAll("\\", "/").toLowerCase();
  if (n.includes("/application support/orca/")) return true;
  if (n.includes("/appdata/roaming/orca/")) return true;
  if (n.includes("/orca/codex-runtime-home/")) return true;
  if (n.endsWith("/orca-status.json") || n.endsWith("/orca-status.json.bak")) return true;
  if (n.endsWith("/hooks/orca.json")) return true;
  return false;
}

export function defaultFsHooks(home = homedir(), env: NodeJS.ProcessEnv = process.env): FsHooks {
  return {
    home,
    env,
    read: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return null;
      }
    },
    write: (path, text) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    },
    remove: (path) => {
      try {
        unlinkSync(path);
      } catch {
        /* already gone */
      }
    },
    mkdirp: (path) => mkdirSync(path, { recursive: true }),
  };
}

function claudePath(home: string): string {
  return join(home, ".claude/settings.json");
}

function grokPath(home: string): string {
  return join(home, ".grok/hooks/herdr-orca.json");
}

function codexPath(home: string, env: NodeJS.ProcessEnv): string | null {
  const root = env.CODEX_HOME && env.CODEX_HOME.length > 0 ? env.CODEX_HOME : join(home, ".codex");
  const path = join(root, "hooks.json");
  if (isOrcaOwnedConfig(root) || isOrcaOwnedConfig(path)) return null;
  return path;
}

function asObject(value: unknown): Record<string, unknown> {
  return asRecord(value) ?? {};
}

function filterHookList(items: unknown[]): unknown[] {
  const next: unknown[] = [];
  for (const item of items) {
    const rec = asRecord(item);
    if (!rec) {
      next.push(item);
      continue;
    }
    if (typeof rec.command === "string" && isPluginHookCommand(rec.command)) continue;
    if (Array.isArray(rec.hooks)) {
      const filtered = filterHookList(rec.hooks);
      rec.hooks = filtered;
      if (filtered.length === 0 && typeof rec.command !== "string") continue;
    }
    next.push(rec);
  }
  return next;
}

function eachCommand(node: unknown, visit: (command: string) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) eachCommand(item, visit);
    return;
  }
  const rec = asRecord(node);
  if (!rec) return;
  if (typeof rec.command === "string") visit(rec.command);
  for (const value of Object.values(rec)) eachCommand(value, visit);
}

function countOurs(doc: unknown): number {
  let n = 0;
  eachCommand(doc, (command) => {
    if (isPluginHookCommand(command)) n += 1;
  });
  return n;
}

function stripOurs(doc: unknown): unknown {
  const rec = asObject(doc);
  const hooks = asRecord(rec.hooks);
  if (!hooks) return rec;
  for (const key of Object.keys(hooks)) {
    const groups = hooks[key];
    if (!Array.isArray(groups)) continue;
    const filtered = filterHookList(groups);
    if (filtered.length === 0) delete hooks[key];
    else hooks[key] = filtered;
  }
  rec.hooks = hooks;
  return rec;
}

function hasCommand(doc: unknown, command: string): boolean {
  let found = false;
  eachCommand(doc, (existing) => {
    if (existing === command) found = true;
  });
  return found;
}

function claudeGroup(command: string): Record<string, unknown> {
  return { hooks: [{ type: "command", command, timeout: 5 }] };
}

function addClaudeEvent(hooks: Record<string, unknown>, event: string, command: string): void {
  const groups = hooks[event];
  if (!Array.isArray(groups)) {
    hooks[event] = [claudeGroup(command)];
    return;
  }
  if (hasCommand({ hooks: { [event]: groups } }, command)) return;
  groups.push(claudeGroup(command));
}

function installClaudeDoc(existing: string | null, events: readonly string[]): string {
  const doc = existing ? asObject(parseJson(existing)) : {};
  const hooks = asObject(doc.hooks);
  doc.hooks = hooks;
  for (const event of events) addClaudeEvent(hooks, event, hookCommand(event));
  return `${JSON.stringify(doc, null, 2)}\n`;
}

function grokDoc(events: readonly string[]): string {
  const hooks: Record<string, unknown> = {};
  for (const event of events) hooks[event] = [claudeGroup(hookCommand(event))];
  return `${JSON.stringify({ hooks }, null, 2)}\n`;
}

function mutateTarget(
  fs: FsHooks,
  id: HookTargetId,
  mode: "install" | "uninstall" | "status",
): HookTargetReport {
  if (id === "opencode") {
    return {
      id,
      path: join(fs.home, ".config/opencode/opencode.json"),
      skipped: true,
      reason: "OpenCode has no command-hook config.",
      ours: 0,
      present: false,
    };
  }
  const path =
    id === "claude" ? claudePath(fs.home) : id === "grok" ? grokPath(fs.home) : codexPath(fs.home, fs.env);
  if (!path) {
    return { id, path: null, skipped: true, reason: "Orca-owned Codex home. Left alone.", ours: 0, present: false };
  }
  if (isOrcaOwnedConfig(path)) {
    return { id, path, skipped: true, reason: "Orca-owned hook file. Left alone.", ours: 0, present: false };
  }
  const existing = fs.read(path);
  if (existing) {
    const parsed = parseJson(existing);
    if (parsed === null || (parsed !== null && !asRecord(parsed))) {
      return { id, path, skipped: true, reason: "existing config is not a JSON object. Left alone.", ours: 0, present: false };
    }
  }
  if (mode === "status") {
    const ours = existing ? countOurs(parseJson(existing)) : 0;
    return { id, path, skipped: false, reason: null, ours, present: ours > 0 };
  }
  if (mode === "uninstall") {
    if (!existing) {
      return { id, path, skipped: false, reason: null, ours: 0, present: false };
    }
    if (id === "grok") {
      fs.remove(path);
      return { id, path, skipped: false, reason: null, ours: 0, present: false };
    }
    const stripped = stripOurs(asObject(parseJson(existing)));
    fs.write(path, `${JSON.stringify(stripped, null, 2)}\n`);
    return { id, path, skipped: false, reason: null, ours: 0, present: false };
  }
  const next = id === "grok" ? grokDoc(HOOK_EVENTS) : installClaudeDoc(existing, HOOK_EVENTS);
  fs.mkdirp(dirname(path));
  fs.write(path, next);
  const ours = countOurs(parseJson(next));
  return { id, path, skipped: false, reason: null, ours, present: ours > 0 };
}

const TARGETS: HookTargetId[] = ["claude", "codex", "grok", "opencode"];

export function runHooksInstall(fs: FsHooks): HooksStatus {
  if (!configAllowsInstall(fs)) {
    return {
      ok: false,
      targets: TARGETS.map((id) => ({
        id,
        path: null,
        skipped: true,
        reason: "config [agents] hooks_install = false",
        ours: 0,
        present: false,
      })),
    };
  }
  const targets = TARGETS.map((id) => mutateTarget(fs, id, "install"));
  return { ok: targets.some((row) => row.present), targets };
}

export function runHooksUninstall(fs: FsHooks): HooksStatus {
  const targets = TARGETS.map((id) => mutateTarget(fs, id, "uninstall"));
  return { ok: true, targets };
}

export function collectHooksStatus(fs: FsHooks): HooksStatus {
  const targets = TARGETS.map((id) => mutateTarget(fs, id, "status"));
  return { ok: targets.filter((row) => !row.skipped).every((row) => row.present), targets };
}

export function formatHooksStatus(status: HooksStatus): string {
  const lines = status.targets.map((row) => {
    if (row.skipped) return `${row.id}: skipped ${row.reason ?? ""}`.trim();
    if (!row.path) return `${row.id}: missing path`;
    const state = row.present ? `present ours=${row.ours}` : "absent";
    return `${row.id}: ${state} ${row.path}`;
  });
  lines.push(status.ok ? "ok: true" : "ok: false");
  return `${lines.join("\n")}\n`;
}

export function agentsHooksInstallEnabled(configText: string | null): boolean {
  if (!configText) return true;
  const match = configText.match(/^\s*hooks_install\s*=\s*(true|false)\s*$/m);
  return match ? match[1] === "true" : true;
}

export function pluginConfigPath(home: string, env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(home, ".config");
  return join(base, "herdr/plugins/config/rudironsoni.herdr-orca-sync/config.toml");
}

export function configAllowsInstall(fs: FsHooks): boolean {
  return agentsHooksInstallEnabled(fs.read(pluginConfigPath(fs.home, fs.env)));
}
