import { basename } from "node:path";
import { agentName, herdrKindForOrcaAgent } from "../agents.ts";
import { insideHerdr, insideOrca } from "./attach.ts";
import { gitWorktreeRoot } from "../identity.ts";
import { asRecord, parseJson, readString, walkStrings, type Runner } from "../run.ts";
import { upsertMapping } from "../state.ts";
import type { DatabaseSync } from "node:sqlite";

export type LaunchAgentDeps = {
  env: NodeJS.ProcessEnv;
  cwd: string;
  agent: string | null;
  agentArgs: string[];
  session: string | null;
  herdrBin: string;
  run: Runner;
  execAttach: (terminalId: string) => number;
  openDb: () => DatabaseSync | null;
};

export type LaunchResult = { code: number; error?: string; terminalId?: string; paneId?: string };

function herdrArgv(bin: string, session: string | null, rest: string[]): string[] {
  if (session) return [bin, "--session", session, ...rest];
  return [bin, ...rest];
}

function orcaEnvPairs(env: NodeJS.ProcessEnv): string[] {
  const keys = [
    "ORCA_TAB_ID",
    "ORCA_PANE_KEY",
    "ORCA_TERMINAL_HANDLE",
    "ORCA_WORKTREE_ID",
    "ORCA_AGENT_HOOK_ENDPOINT",
  ];
  const pairs: string[] = [];
  for (const key of keys) {
    const value = env[key];
    if (value) pairs.push(`${key}=${value}`);
  }
  return pairs;
}

function workspaceIdForCwd(run: Runner, bin: string, session: string | null, cwd: string): string | null {
  const listed = run(herdrArgv(bin, session, ["workspace", "list"]));
  const parsed = parseJson(listed.stdout);
  const root = asRecord(parsed);
  const result = asRecord(root?.result ?? null);
  const workspaces = result?.workspaces;
  if (!Array.isArray(workspaces)) return null;
  for (const item of workspaces) {
    const rec = asRecord(item);
    const id = readString(rec, "workspace_id");
    if (!id) continue;
    const got = run(herdrArgv(bin, session, ["workspace", "get", id]));
    const info = walkStrings(parseJson(got.stdout), ["identity_cwd", "cwd"]);
    if (info.identity_cwd === cwd || info.cwd === cwd) return id;
  }
  return null;
}

export function runLaunchAgent(deps: LaunchAgentDeps): LaunchResult {
  if (!insideOrca(deps.env)) {
    return { code: 1, error: "Refusing to launch outside an Orca terminal." };
  }
  if (insideHerdr(deps.env)) {
    return { code: 1, error: "Refusing to launch from inside a Herdr pane." };
  }
  if (!deps.herdrBin) {
    return { code: 1, error: "herdr is not on PATH." };
  }
  const cwd = gitWorktreeRoot(deps.cwd) ?? deps.cwd;
  let workspaceId = workspaceIdForCwd(deps.run, deps.herdrBin, deps.session, cwd);
  if (!workspaceId) {
    const created = deps.run(
      herdrArgv(deps.herdrBin, deps.session, [
        "workspace",
        "create",
        "--cwd",
        cwd,
        "--label",
        basename(cwd),
        "--no-focus",
      ]),
    );
    workspaceId = walkStrings(parseJson(created.stdout), ["workspace_id"]).workspace_id ?? null;
  }
  if (!workspaceId) {
    return { code: 1, error: `Failed to create Herdr workspace for ${cwd}` };
  }
  const title = deps.env.ORCA_TAB_TITLE || basename(cwd);
  const createArgs = [
    "tab",
    "create",
    "--workspace",
    workspaceId,
    "--cwd",
    cwd,
    "--label",
    title,
    "--no-focus",
  ];
  for (const pair of orcaEnvPairs(deps.env)) {
    createArgs.push("--env", pair);
  }
  const createdTab = deps.run(herdrArgv(deps.herdrBin, deps.session, createArgs));
  const ids = walkStrings(parseJson(createdTab.stdout), ["pane_id", "terminal_id", "tab_id"]);
  if (!ids.pane_id) {
    return { code: 1, error: "herdr tab create did not return a pane_id." };
  }
  let terminalId = ids.terminal_id;
  if (!terminalId) {
    const pane = deps.run(herdrArgv(deps.herdrBin, deps.session, ["pane", "get", ids.pane_id]));
    terminalId = walkStrings(parseJson(pane.stdout), ["terminal_id"]).terminal_id;
  }
  if (!terminalId) {
    return { code: 1, error: "Could not read herdr terminal_id." };
  }
  if (deps.agent) {
    const kind = herdrKindForOrcaAgent(deps.agent);
    if (!kind) {
      return { code: 1, error: `Unsupported agent: ${deps.agent}` };
    }
    const start = [
      "agent",
      "start",
      agentName(kind, ids.pane_id),
      "--kind",
      kind,
      "--pane",
      ids.pane_id,
    ];
    if (deps.agentArgs.length > 0) start.push("--", ...deps.agentArgs);
    const started = deps.run(herdrArgv(deps.herdrBin, deps.session, start));
    if (started.status !== 0) {
      return { code: 1, error: started.stderr.trim() || "herdr agent start failed." };
    }
  }
  const db = deps.openDb();
  if (db) {
    upsertMapping(db, {
      herdrTerminalId: terminalId,
      orcaTabId: deps.env.ORCA_TAB_ID ?? null,
      orcaPaneKey: deps.env.ORCA_PANE_KEY ?? null,
      title,
    });
  }
  const code = deps.execAttach(terminalId);
  return { code, terminalId, paneId: ids.pane_id };
}
