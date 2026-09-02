import { spawnSync } from "node:child_process";

export type AttachDeps = {
  env: NodeJS.ProcessEnv;
  which: (name: string) => string | null;
  exec: (argv: string[], env: NodeJS.ProcessEnv) => number;
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
