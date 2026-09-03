import { insideHerdr } from "./attach.ts";
import { applyCreateOrcaAttach } from "./daemon.ts";
import { parseJson, walkStrings, type Runner } from "../run.ts";

export type OpenInOrcaDeps = {
  env: NodeJS.ProcessEnv;
  run: Runner;
  herdrBin: string | null;
  orcaBin: string | null;
  session?: string | null;
};

function herdrArgv(bin: string, session: string | null, rest: string[]): string[] {
  if (session) return [bin, "--session", session, ...rest];
  return [bin, ...rest];
}

export function openInOrcaArgv(terminalId: string, title: string, cwd?: string): string[] {
  const args = ["orca", "terminal", "create", "--title", title, "--command", `herdr-orca attach --terminal ${terminalId}`, "--json"];
  if (cwd) args.push("--worktree", `path:${cwd}`);
  return args;
}

export function runOpenInOrca(deps: OpenInOrcaDeps): { code: number; error?: string; argv?: string[] } {
  if (!insideHerdr(deps.env)) {
    return { code: 1, error: "Open in Orca runs from a Herdr pane." };
  }
  if (!deps.herdrBin) return { code: 1, error: "herdr is not on PATH." };
  if (!deps.orcaBin) return { code: 1, error: "orca is not on PATH." };
  const paneId = deps.env.HERDR_PANE_ID;
  const session = deps.session ?? deps.env.HERDR_SESSION ?? null;
  const getArgs = paneId
    ? herdrArgv(deps.herdrBin, session, ["pane", "get", paneId])
    : herdrArgv(deps.herdrBin, session, ["pane", "get", "--current"]);
  const got = deps.run(getArgs);
  const ids = walkStrings(parseJson(got.stdout), ["terminal_id", "cwd", "label", "pane_id"]);
  const terminalId = ids.terminal_id;
  if (!terminalId) return { code: 1, error: "Could not read herdr terminal_id." };
  const title = ids.label || terminalId;
  const argv = openInOrcaArgv(terminalId, title, ids.cwd);
  applyCreateOrcaAttach(deps.run, deps.orcaBin, { herdrTerminalId: terminalId, title }, ids.cwd);
  return { code: 0, argv };
}
