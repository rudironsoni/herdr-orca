import { parseArgs, rootHelp, doctorHelp, attachHelp, launchAgentHelp, flagValue } from "./cli.ts";
import { collectDoctorReport, defaultDoctorDeps, formatDoctorText } from "./commands/doctor.ts";
import { defaultExec, runAttach } from "./commands/attach.ts";
import { runLaunchAgent } from "./commands/launch-agent.ts";
import { ensureDaemon, runForeground } from "./commands/daemon.ts";
import { pluginRootFromEntry, pluginStateDir, distEntry } from "./paths.ts";
import { openState } from "./state.ts";
import { defaultRunner, which } from "./run.ts";
import { existsSync } from "node:fs";
import { join } from "node:path";

function existsDist(pluginRoot: string): boolean {
  return existsSync(distEntry(pluginRoot));
}

function writeOut(text: string): void {
  process.stdout.write(text);
}

function writeErr(text: string): void {
  process.stderr.write(text);
}

function main(argv: string[]): number {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    writeOut(rootHelp());
    return 0;
  }
  if (parsed.kind === "unknown") {
    writeErr(`Unknown command: ${parsed.command}\n\n${rootHelp()}`);
    return 2;
  }
  if (parsed.command === "doctor" && parsed.help) {
    writeOut(doctorHelp());
    return 0;
  }
  if (parsed.command === "doctor") {
    const report = collectDoctorReport(defaultDoctorDeps(import.meta.url));
    if (parsed.json) {
      writeOut(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      writeOut(formatDoctorText(report));
    }
    return report.ok ? 0 : 1;
  }
  if (parsed.command === "attach" && parsed.help) {
    writeOut(attachHelp());
    return 0;
  }
  if (parsed.command === "attach") {
    const terminalId = flagValue(parsed.rest, "--terminal");
    if (!terminalId) {
      writeErr("Error: --terminal is required.\n  herdr-orca attach --terminal term_abc\n");
      return 2;
    }
    const result = runAttach(terminalId, {
      env: process.env,
      which: (name) => {
        const found = spawnSync("which", [name], { encoding: "utf8" });
        const path = found.stdout.trim();
        return found.status === 0 && path.length > 0 ? path : null;
      },
      exec: defaultExec,
    });
    if (result.error) writeErr(`${result.error}\n`);
    return result.code;
  }
  if (parsed.command === "launch-agent" && parsed.help) {
    writeOut(launchAgentHelp());
    return 0;
  }
  if (parsed.command === "launch-agent") {
    const dash = parsed.rest.indexOf("--");
    const flags = dash === -1 ? parsed.rest : parsed.rest.slice(0, dash);
    const agentArgs = dash === -1 ? [] : parsed.rest.slice(dash + 1);
    const herdrBin = which("herdr");
    if (!herdrBin) {
      writeErr("herdr is not on PATH.\n");
      return 1;
    }
    const pluginRoot = process.env.HERDR_PLUGIN_ROOT ?? pluginRootFromEntry(import.meta.url);
    const result = runLaunchAgent({
      env: process.env,
      cwd: process.cwd(),
      agent: flagValue(flags, "--agent"),
      agentArgs,
      session: flagValue(flags, "--session"),
      herdrBin,
      run: defaultRunner,
      execAttach: (terminalId) =>
        runAttach(terminalId, { env: process.env, which, exec: defaultExec }).code,
      openDb: () => openState(join(pluginStateDir(), "sync.sqlite3")),
    });
    if (result.error) writeErr(`${result.error}\n`);
    return result.code;
  }
  if (parsed.command === "daemon") {
    const rest = parsed.rest;
    if (rest.includes("--help") || rest[0] === "help") {
      writeOut("herdr-orca daemon ensure\nherdr-orca daemon --foreground [--adopt]\n");
      return 0;
    }
    if (rest[0] === "ensure") {
      const pluginRoot = process.env.HERDR_PLUGIN_ROOT ?? pluginRootFromEntry(import.meta.url);
      const out = ensureDaemon({ pluginRoot, spawnDetached: existsDist(pluginRoot) });
      writeOut(`${out.message}\n`);
      return out.code;
    }
    if (rest.includes("--foreground")) {
      void runForeground({
        stateDir: pluginStateDir(),
        session: process.env.HERDR_SESSION ?? null,
        adopt: rest.includes("--adopt"),
        run: defaultRunner,
      });
      return 0;
    }
    writeErr("Usage: herdr-orca daemon ensure | herdr-orca daemon --foreground [--adopt]\n");
    return 2;
  }
  writeErr(rootHelp());
  return 2;
}

const code = main(process.argv.slice(2));
process.exitCode = code;
