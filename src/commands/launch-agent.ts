import { basename } from "node:path";
import { agentName, herdrKindForOrcaAgent } from "../agents.ts";
import { insideHerdr, insideOrca, syncEnvPairs } from "./attach.ts";
import { gitWorktreeRoot, pathsMatch } from "../identity.ts";
import { asRecord, parseJson, readString, walkStrings, type Runner } from "../run.ts";

export type LaunchAgentDeps = {
  env: NodeJS.ProcessEnv;
  cwd: string;
  agent: string | null;
  agentArgs: string[];
  session: string | null;
  herdrBin: string;
  run: Runner;
  execAttach: (terminalId: string) => number;
};

export type LaunchResult = { code: number; error?: string; terminalId?: string; paneId?: string };

function herdrArgv(bin: string, session: string | null, rest: string[]): string[] {
  if (session) return [bin, "--session", session, ...rest];
  return [bin, ...rest];
}

function appendEnv(args: string[], env: NodeJS.ProcessEnv): void {
  for (const pair of syncEnvPairs(env)) {
    args.push("--env", pair);
  }
}

function paneRecords(run: Runner, bin: string, session: string | null, workspaceId?: string): Record<string, unknown>[] {
  const rest = workspaceId ? ["pane", "list", "--workspace", workspaceId] : ["pane", "list"];
  const listed = run(herdrArgv(bin, session, rest));
  const panes = asRecord(asRecord(parseJson(listed.stdout))?.result ?? null)?.panes;
  if (!Array.isArray(panes)) return [];
  const out: Record<string, unknown>[] = [];
  for (const pane of panes) {
    const rec = asRecord(pane);
    if (rec) out.push(rec);
  }
  return out;
}

export function workspaceIdForCwd(run: Runner, bin: string, session: string | null, cwd: string): string | null {
  for (const rec of paneRecords(run, bin, session)) {
    const id = readString(rec, "workspace_id");
    const paneCwd = readString(rec, "cwd") ?? readString(rec, "foreground_cwd");
    if (id && paneCwd && pathsMatch(paneCwd, cwd)) return id;
  }
  return null;
}

function surfaceFrom(value: unknown): { workspaceId?: string; paneId?: string; terminalId?: string } {
  const ids = walkStrings(value, ["workspace_id", "pane_id", "terminal_id"]);
  return { workspaceId: ids.workspace_id, paneId: ids.pane_id, terminalId: ids.terminal_id };
}

function firstPaneInWorkspace(
  run: Runner,
  bin: string,
  session: string | null,
  workspaceId: string,
): { paneId: string; terminalId?: string } | null {
  for (const rec of paneRecords(run, bin, session, workspaceId)) {
    const paneId = readString(rec, "pane_id");
    if (!paneId) continue;
    return { paneId, terminalId: readString(rec, "terminal_id") ?? undefined };
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
  let paneId: string | undefined;
  let terminalId: string | undefined;
  const title = deps.env.ORCA_TAB_TITLE || basename(cwd);
  if (!workspaceId) {
    const createArgs = ["workspace", "create", "--cwd", cwd, "--label", basename(cwd), "--no-focus"];
    appendEnv(createArgs, deps.env);
    const created = deps.run(herdrArgv(deps.herdrBin, deps.session, createArgs));
    const surface = surfaceFrom(parseJson(created.stdout));
    workspaceId = surface.workspaceId;
    paneId = surface.paneId;
    terminalId = surface.terminalId;
    if (!paneId && workspaceId) {
      const existing = firstPaneInWorkspace(deps.run, deps.herdrBin, deps.session, workspaceId);
      paneId = existing?.paneId;
      terminalId = terminalId ?? existing?.terminalId;
    }
  } else {
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
    appendEnv(createArgs, deps.env);
    const createdTab = deps.run(herdrArgv(deps.herdrBin, deps.session, createArgs));
    const ids = walkStrings(parseJson(createdTab.stdout), ["pane_id", "terminal_id"]);
    paneId = ids.pane_id;
    terminalId = ids.terminal_id;
  }
  if (!workspaceId) {
    return { code: 1, error: `Failed to create Herdr workspace for ${cwd}` };
  }
  if (!paneId) {
    return { code: 1, error: "herdr did not return a pane_id." };
  }
  if (!terminalId) {
    const pane = deps.run(herdrArgv(deps.herdrBin, deps.session, ["pane", "get", paneId]));
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
      agentName(kind, paneId),
      "--kind",
      kind,
      "--pane",
      paneId,
    ];
    if (deps.agentArgs.length > 0) start.push("--", ...deps.agentArgs);
    const started = deps.run(herdrArgv(deps.herdrBin, deps.session, start));
    if (started.status !== 0) {
      return { code: 1, error: started.stderr.trim() || "herdr agent start failed." };
    }
  }
  const code = deps.execAttach(terminalId);
  return { code, terminalId, paneId };
}
