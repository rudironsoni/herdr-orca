import { spawnSync } from "node:child_process";
import { asRecord, parseJson, readString, type Runner } from "../run.ts";

export const PLUGIN_SYNC_ENV = "HERDR_ORCA_SYNC";

const ORCA_ENV_KEYS = [
  "ORCA_TAB_ID",
  "ORCA_PANE_KEY",
  "ORCA_TERMINAL_HANDLE",
  "ORCA_WORKTREE_ID",
  "ORCA_AGENT_HOOK_ENDPOINT",
];

export type AttachDeps = {
  env: NodeJS.ProcessEnv;
  which: (name: string) => string | null;
  exec: (argv: string[], env: NodeJS.ProcessEnv) => number;
  run: Runner;
  inject?: boolean;
  session?: string | null;
};

export function insideOrca(env: NodeJS.ProcessEnv): boolean {
  if (env.TERM_PROGRAM !== "Orca") return false;
  return Boolean(env.ORCA_TAB_ID || env.ORCA_TERMINAL_HANDLE || env.ORCA_PANE_KEY);
}

export function insideHerdr(env: NodeJS.ProcessEnv): boolean {
  return env.HERDR_ENV === "1" && Boolean(env.HERDR_SOCKET_PATH);
}

export function attachArgv(terminalId: string): string[] {
  return ["terminal", "attach", terminalId, "--takeover"];
}

export function syncEnvPairs(env: NodeJS.ProcessEnv): string[] {
  const pairs = [`${PLUGIN_SYNC_ENV}=1`];
  for (const key of ORCA_ENV_KEYS) {
    const value = env[key];
    if (value) pairs.push(`${key}=${value}`);
  }
  return pairs;
}

function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function injectEnvCommand(pairs: string[]): string {
  const assigns = pairs.map((pair) => {
    const eq = pair.indexOf("=");
    return `${pair.slice(0, eq)}=${shQuote(pair.slice(eq + 1))}`;
  });
  return `export ${assigns.join(" ")}`;
}

function herdrArgv(bin: string, session: string | null, rest: string[]): string[] {
  if (session) return [bin, "--session", session, ...rest];
  return [bin, ...rest];
}

export function paneIdForTerminal(run: Runner, herdrBin: string, session: string | null, terminalId: string): string | null {
  const listed = run(herdrArgv(herdrBin, session, ["pane", "list"]));
  const parsed = parseJson(listed.stdout);
  const panes = asRecord(asRecord(parsed)?.result ?? null)?.panes;
  if (!Array.isArray(panes)) return null;
  for (const pane of panes) {
    const rec = asRecord(pane);
    if (readString(rec, "terminal_id") === terminalId) return readString(rec, "pane_id");
  }
  return null;
}

function injectSyncEnv(terminalId: string, herdr: string, deps: AttachDeps): void {
  const paneId = paneIdForTerminal(deps.run, herdr, deps.session ?? null, terminalId);
  if (!paneId) return;
  const command = injectEnvCommand(syncEnvPairs(deps.env));
  deps.run(herdrArgv(herdr, deps.session ?? null, ["pane", "run", paneId, command]));
}

export function runAttach(terminalId: string, deps: AttachDeps): { code: number; error?: string } {
  if (!insideOrca(deps.env)) {
    return {
      code: 1,
      error: "Refusing to attach outside an Orca terminal. Orca sets TERM_PROGRAM=Orca and a pane id.",
    };
  }
  if (insideHerdr(deps.env)) {
    return {
      code: 1,
      error: "Refusing to attach from inside a Herdr pane. Run this as the Orca PTY command.",
    };
  }
  const herdr = deps.which("herdr");
  if (!herdr) {
    return { code: 1, error: "herdr is not on PATH." };
  }
  if (deps.inject !== false) injectSyncEnv(terminalId, herdr, deps);
  const env = { ...deps.env };
  delete env.HERDR_ENV;
  delete env.HERDR_SOCKET_PATH;
  delete env.HERDR_SESSION;
  delete env.HERDR_WORKSPACE_ID;
  delete env.HERDR_TAB_ID;
  delete env.HERDR_PANE_ID;
  const code = deps.exec([herdr, ...attachArgv(terminalId)], env);
  return { code };
}

export function defaultExec(argv: string[], env: NodeJS.ProcessEnv): number {
  const [cmd, ...args] = argv;
  const result = spawnSync(cmd, args, { env, stdio: "inherit" });
  return result.status ?? 1;
}
