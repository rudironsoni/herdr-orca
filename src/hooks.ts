import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { insideHerdr, PLUGIN_SYNC_ENV } from "./commands/attach.ts";
import { asRecord, parseJson, readString } from "./run.ts";

export const HOOK_EVENTS = [
  "SessionStart",
  "PreToolUse",
  "Notification",
  "PermissionRequest",
  "Stop",
  "SessionEnd",
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

export type GateSkipReason = "not_herdr" | "plugin_not_attached" | "not_orca";

export type GateResult =
  | { kind: "skip"; reason: GateSkipReason }
  | { kind: "run"; tabId: string | null; paneKey: string | null };

export type HookEndpoint = {
  url: string;
  token: string | null;
};

export type PostFn = (url: string, token: string | null, body: unknown) => Promise<boolean>;

export function hookCommand(event: string): string {
  return `herdr-orca hook --event ${event}`;
}

export function isPluginHookCommand(command: string): boolean {
  return /(?:^|[\s;|&])herdr-orca(?:\.mjs)? hook\b/.test(command);
}

export function evaluateGate(env: NodeJS.ProcessEnv): GateResult {
  if (!insideHerdr(env)) return { kind: "skip", reason: "not_herdr" };
  if (env[PLUGIN_SYNC_ENV] !== "1") return { kind: "skip", reason: "plugin_not_attached" };
  const tabId = env.ORCA_TAB_ID ?? null;
  const paneKey = env.ORCA_PANE_KEY ?? null;
  if (!tabId && !paneKey) return { kind: "skip", reason: "not_orca" };
  return { kind: "run", tabId, paneKey };
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^set\s+/i, "");
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

export function defaultEndpointFile(
  home: string,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (platform === "win32") return join(home, "AppData/Roaming/orca/agent-hooks/endpoint.cmd");
  if (platform === "darwin") return join(home, "Library/Application Support/orca/agent-hooks/endpoint.env");
  const xdg = env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(home, ".config");
  return join(base, "orca/agent-hooks/endpoint.env");
}

function endpointFromVars(vars: Record<string, string>, fallbackPath?: string): HookEndpoint | null {
  const direct = vars.ORCA_AGENT_HOOK_ENDPOINT;
  if (direct && isHttpUrl(direct)) {
    return { url: direct, token: vars.ORCA_AGENT_HOOK_TOKEN ?? null };
  }
  const port = vars.ORCA_AGENT_HOOK_PORT;
  if (port && /^\d+$/.test(port)) {
    return { url: `http://127.0.0.1:${port}/`, token: vars.ORCA_AGENT_HOOK_TOKEN ?? null };
  }
  if (direct && !isHttpUrl(direct) && direct !== fallbackPath) {
    return null;
  }
  return null;
}

export function resolveHookEndpoint(opts: {
  env: NodeJS.ProcessEnv;
  home: string;
  platform: NodeJS.Platform;
  readFile: (path: string) => string | null;
}): HookEndpoint | null {
  const envVars: Record<string, string> = {};
  for (const key of ["ORCA_AGENT_HOOK_ENDPOINT", "ORCA_AGENT_HOOK_TOKEN", "ORCA_AGENT_HOOK_PORT"]) {
    const value = opts.env[key];
    if (value) envVars[key] = value;
  }
  const fromEnv = endpointFromVars(envVars);
  if (fromEnv) return fromEnv;

  const candidates = [envVars.ORCA_AGENT_HOOK_ENDPOINT, defaultEndpointFile(opts.home, opts.platform, opts.env)];
  for (const path of candidates) {
    if (!path || isHttpUrl(path)) continue;
    const text = opts.readFile(path);
    if (!text) continue;
    const parsed = parseEnvFile(text);
    const resolved = endpointFromVars({ ...parsed, ...envVars }, path);
    if (resolved) return resolved;
  }
  return null;
}

function notificationType(payload: Record<string, unknown> | null): string {
  return (
    readString(payload, "notification_type") ??
    readString(payload, "notificationType") ??
    readString(payload, "type") ??
    ""
  );
}

export function statusForEvent(event: string, payload: unknown): string {
  const rec = asRecord(payload);
  const name = event.toLowerCase();
  if (name === "sessionend") return "done";
  if (name === "sessionstart") return "idle";
  if (name.includes("pretool") || name.includes("beforeshell") || name.includes("beforemcp")) return "working";
  if (name === "notification") {
    const type = notificationType(rec);
    if (type.includes("permission")) return "blocked";
    return "waiting";
  }
  if (name === "permissionrequest") return "blocked";
  if (name.includes("stop")) return "waiting";
  return "working";
}

function inferSource(env: NodeJS.ProcessEnv, payload: unknown): string {
  const rec = asRecord(payload);
  const named = readString(rec, "agent_type") ?? readString(rec, "agentType") ?? readString(rec, "source");
  if (named) return named;
  if (env.CLAUDE_CODE || env.CLAUDECODE || env.CLAUDE_PLUGIN_ROOT) return "claude";
  if (env.CODEX_HOME || env.CODEX_THREAD_ID) return "codex";
  if (env.GROK_HOME || env.GROK_SESSION_ID) return "grok";
  return "herdr-orca";
}

export function hookBody(opts: {
  event: string;
  payload: unknown;
  tabId: string | null;
  paneKey: string | null;
  env: NodeJS.ProcessEnv;
}): Record<string, unknown> {
  return {
    paneKey: opts.paneKey,
    tabId: opts.tabId,
    source: inferSource(opts.env, opts.payload),
    hookEventName: opts.event,
    payload: {
      state: statusForEvent(opts.event, opts.payload),
      agentType: inferSource(opts.env, opts.payload),
    },
  };
}

export async function defaultPost(url: string, token: string | null, body: unknown): Promise<boolean> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function defaultReadFile(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export type RunHookOpts = {
  env: NodeJS.ProcessEnv;
  event: string;
  stdin: string;
  home?: string;
  platform?: NodeJS.Platform;
  post?: PostFn;
  readFile?: (path: string) => string | null;
};

export async function runHook(opts: RunHookOpts): Promise<{ code: number; gate: GateResult; posted: boolean }> {
  const gate = evaluateGate(opts.env);
  if (gate.kind === "skip") return { code: 0, gate, posted: false };
  const payload = parseJson(opts.stdin) ?? {};
  const endpoint = resolveHookEndpoint({
    env: opts.env,
    home: opts.home ?? homedir(),
    platform: opts.platform ?? process.platform,
    readFile: opts.readFile ?? defaultReadFile,
  });
  if (!endpoint) return { code: 0, gate, posted: false };
  const post = opts.post ?? defaultPost;
  const ok = await post(
    endpoint.url,
    endpoint.token,
    hookBody({
      event: opts.event,
      payload,
      tabId: gate.tabId,
      paneKey: gate.paneKey,
      env: opts.env,
    }),
  );
  return { code: 0, gate, posted: ok };
}
