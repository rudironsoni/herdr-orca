import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { pluginStateDir } from "../paths.ts";
import { asRecord, parseJson, readString, which, type Runner } from "../run.ts";
import {
  mappingsFromOrca,
  reconcile,
  type HerdrTerminal,
  type Mutation,
  type OrcaLeaf,
  type World,
} from "../reconcile.ts";

export function pidPath(stateDir = pluginStateDir()): string {
  return join(stateDir, "syncd.pid");
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readPid(path = pidPath()): number | null {
  if (!existsSync(path)) return null;
  const n = Number(readFileSync(path, "utf8").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function ensureDaemon(opts: {
  pluginRoot: string;
  stateDir?: string;
  spawnDetached?: boolean;
}): { code: number; message: string } {
  const stateDir = opts.stateDir ?? pluginStateDir();
  mkdirSync(stateDir, { recursive: true });
  const existing = readPid(pidPath(stateDir));
  if (existing && isPidAlive(existing)) {
    return { code: 0, message: `daemon already running pid=${existing}` };
  }
  if (existing) {
    try {
      unlinkSync(pidPath(stateDir));
    } catch {
      /* ignore */
    }
  }
  if (!opts.spawnDetached) {
    return { code: 0, message: "daemon not running; start with herdr-orca daemon --foreground" };
  }
  const entry = join(opts.pluginRoot, "dist/herdr-orca.mjs");
  const child = spawn(process.execPath, [entry, "daemon", "--foreground"], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  if (child.pid) writeFileSync(pidPath(stateDir), `${child.pid}\n`);
  return { code: 0, message: `started daemon pid=${child.pid ?? "unknown"}` };
}

export function snapshotHerdr(run: Runner, herdrBin: string, session: string | null): HerdrTerminal[] {
  const argv = session
    ? [herdrBin, "--session", session, "pane", "list"]
    : [herdrBin, "pane", "list"];
  const listed = run(argv);
  const parsed = parseJson(listed.stdout);
  const result = asRecord(asRecord(parsed)?.result ?? null);
  const panes = result?.panes;
  if (!Array.isArray(panes)) return [];
  const out: HerdrTerminal[] = [];
  for (const pane of panes) {
    const rec = asRecord(pane);
    const terminalId = readString(rec, "terminal_id");
    const paneId = readString(rec, "pane_id");
    const tabId = readString(rec, "tab_id");
    if (!terminalId || !paneId || !tabId) continue;
    out.push({
      terminalId,
      paneId,
      tabId,
      title: readString(rec, "label") ?? paneId,
      pluginOwned: Boolean(readString(rec, "plugin_id")),
      cwd: readString(rec, "cwd") ?? undefined,
    });
  }
  return out;
}

export function snapshotOrca(run: Runner, orcaBin: string): { reachable: boolean; leaves: OrcaLeaf[] } {
  const status = run([orcaBin, "status", "--json"]);
  const runtime = asRecord(asRecord(asRecord(parseJson(status.stdout))?.result ?? null)?.runtime ?? null);
  const reachable = runtime?.reachable === true;
  if (!reachable) return { reachable: false, leaves: [] };
  const list = run([orcaBin, "terminal", "list", "--json"]);
  const parsed = parseJson(list.stdout);
  const leaves: OrcaLeaf[] = [];
  const rec = asRecord(asRecord(parsed)?.result ?? parsed);
  const terminals = rec?.terminals;
  if (Array.isArray(terminals)) {
    for (const item of terminals) {
      const t = asRecord(item);
      const tabId = readString(t, "tabId") ?? readString(t, "id");
      if (!tabId) continue;
      leaves.push({
        tabId,
        paneKey: readString(t, "paneKey") ?? tabId,
        title: readString(t, "title") ?? tabId,
        command: readString(t, "command") ?? "",
      });
    }
  }
  return { reachable: true, leaves };
}

export function applyCreateOrcaAttach(
  run: Runner,
  orcaBin: string,
  op: { herdrTerminalId: string; title: string },
  cwd: string | undefined,
): void {
  const args = [orcaBin, "terminal", "create", "--title", op.title, "--command", `herdr-orca attach --terminal ${op.herdrTerminalId}`, "--json"];
  if (cwd) args.push("--worktree", `path:${cwd}`);
  run(args);
}

export function tick(world: World, opts: { adopt: boolean; run: Runner; orcaBin: string | null }): World {
  const plan = reconcile(world);
  const next: World = {
    ...world,
    mappings: world.mappings.map((row) => ({ ...row })),
    mutations: [...world.mutations],
  };
  for (const op of plan.ops) {
    if (op.type === "ack") {
      next.mutations = next.mutations.filter((row) => row.id !== op.mutationId);
    }
    if (op.type === "create_orca_attach" && opts.adopt && opts.orcaBin) {
      const herdr = world.herdr.find((row) => row.terminalId === op.herdrTerminalId);
      applyCreateOrcaAttach(opts.run, opts.orcaBin, op, herdr?.cwd);
      next.mutations.push({
        id: `create-${op.herdrTerminalId}`,
        field: "create_orca",
        target: op.herdrTerminalId,
        expectedValue: op.herdrTerminalId,
        source: "herdr",
      });
    }
  }
  return next;
}

export async function runForeground(opts: {
  stateDir: string;
  session: string | null;
  adopt: boolean;
  run: Runner;
  intervalMs?: number;
  once?: boolean;
}): Promise<void> {
  mkdirSync(opts.stateDir, { recursive: true });
  writeFileSync(pidPath(opts.stateDir), `${process.pid}\n`);
  const herdrBin = which("herdr");
  const orcaBin = which("orca");
  let mutations: Mutation[] = [];
  const loop = (): void => {
    const herdr = herdrBin ? snapshotHerdr(opts.run, herdrBin, opts.session) : [];
    const orca = orcaBin ? snapshotOrca(opts.run, orcaBin) : { reachable: false, leaves: [] };
    const mappings = mappingsFromOrca(orca.leaves);
    mutations = mutations.filter(
      (row) => !(row.field === "create_orca" && mappings.some((item) => item.herdrTerminalId === row.target)),
    );
    const world: World = {
      herdr,
      orca: orca.leaves,
      orcaReachable: orca.reachable,
      mappings,
      mutations,
      orcaClose: "detach",
    };
    const next = tick(world, { adopt: opts.adopt, run: opts.run, orcaBin });
    mutations = next.mutations;
  };
  loop();
  if (opts.once) return;
  const interval = setInterval(loop, opts.intervalMs ?? 2000);
  await new Promise<void>((resolve) => {
    process.on("SIGTERM", () => {
      clearInterval(interval);
      resolve();
    });
    process.on("SIGINT", () => {
      clearInterval(interval);
      resolve();
    });
  });
}
