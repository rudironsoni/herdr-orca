import { parseArgs, rootHelp, doctorHelp, attachHelp, launchAgentHelp, hookHelp, hooksHelp, flagValue } from "./cli.ts";
import { collectDoctorReport, defaultDoctorDeps, formatDoctorText } from "./commands/doctor.ts";
import { defaultExec, runAttach } from "./commands/attach.ts";
import { runLaunchAgent } from "./commands/launch-agent.ts";
import { ensureDaemon, runForeground, stopDaemon, uninstallDaemon } from "./commands/daemon.ts";
import { runOpenInOrca } from "./commands/open-in-orca.ts";
import { runHookCommand } from "./commands/hook.ts";
import {
  collectHooksStatus,
  defaultFsHooks,
  formatHooksStatus,
  runHooksInstall,
  runHooksUninstall,
} from "./commands/hooks.ts";
import { loadSyncConfig } from "./config.ts";
import { pluginRootFromEntry, pluginStateDir, distEntry } from "./paths.ts";
import { defaultRunner, which } from "./run.ts";
import { existsSync } from "node:fs";

function existsDist(pluginRoot: string): boolean {
  return existsSync(distEntry(pluginRoot));
}

function writeOut(text: string): void {
  process.stdout.write(text);
}

function writeErr(text: string): void {
  process.stderr.write(text);
}

async function main(argv: string[]): Promise<number> {
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
      which,
      exec: defaultExec,
      run: defaultRunner,
    });
    if (result.error) writeErr(`${result.error}\n`);
    return result.code;
  }
  if (parsed.command === "launch-agent" && parsed.help) {
    writeOut(launchAgentHelp());
    return 0;
  }
  if (parsed.command === "open" || parsed.command === "launch-agent") {
    const dash = parsed.rest.indexOf("--");
    const flags = dash === -1 ? parsed.rest : parsed.rest.slice(0, dash);
    const agentArgs = dash === -1 ? [] : parsed.rest.slice(dash + 1);
    const terminalId = flagValue(flags, "--terminal");
    if (terminalId) {
      const result = runAttach(terminalId, {
        env: process.env,
        which,
        exec: defaultExec,
        run: defaultRunner,
      });
      if (result.error) writeErr(`${result.error}\n`);
      return result.code;
    }
    const herdrBin = which("herdr");
    if (!herdrBin) {
      writeErr("herdr is not on PATH.\n");
      return 1;
    }
    const result = runLaunchAgent({
      env: process.env,
      cwd: process.cwd(),
      agent: flagValue(flags, "--agent"),
      agentArgs,
      session: flagValue(flags, "--session"),
      herdrBin,
      run: defaultRunner,
      execAttach: (terminalId) =>
        runAttach(terminalId, {
          env: process.env,
          which,
          exec: defaultExec,
          run: defaultRunner,
          inject: false,
        }).code,
    });
    if (result.error) writeErr(`${result.error}\n`);
    return result.code;
  }
  if (parsed.command === "hook" && parsed.help) {
    writeOut(hookHelp());
    return 0;
  }
  if (parsed.command === "hook") {
    return runHookCommand({ rest: parsed.rest });
  }
  if (parsed.command === "hooks" && parsed.help) {
    writeOut(hooksHelp());
    return 0;
  }
  if (parsed.command === "hooks") {
    const sub = parsed.rest.find((item) => !item.startsWith("-")) ?? "status";
    const fs = defaultFsHooks();
    if (sub === "install") {
      const status = runHooksInstall(fs);
      if (parsed.json) writeOut(`${JSON.stringify(status, null, 2)}\n`);
      else writeOut(formatHooksStatus(status));
      return status.ok ? 0 : 1;
    }
    if (sub === "uninstall") {
      const status = runHooksUninstall(fs);
      if (parsed.json) writeOut(`${JSON.stringify(status, null, 2)}\n`);
      else writeOut(formatHooksStatus(status));
      return 0;
    }
    if (sub === "status") {
      const status = collectHooksStatus(fs);
      if (parsed.json) writeOut(`${JSON.stringify(status, null, 2)}\n`);
      else writeOut(formatHooksStatus(status));
      return status.ok ? 0 : 1;
    }
    writeErr(hooksHelp());
    return 2;
  }
  if (parsed.command === "status") {
    const report = collectDoctorReport(defaultDoctorDeps(import.meta.url));
    writeOut(formatDoctorText(report));
    return report.ok ? 0 : 1;
  }
  if (parsed.command === "open-in-orca") {
    const result = runOpenInOrca({
      env: process.env,
      run: defaultRunner,
      herdrBin: which("herdr"),
      orcaBin: which("orca"),
    });
    if (result.error) writeErr(`${result.error}\n`);
    else writeOut("opened Orca attach tab\n");
    return result.code;
  }
  if (parsed.command === "sync") {
    const cfg = loadSyncConfig();
    void runForeground({
      stateDir: pluginStateDir(),
      session: process.env.HERDR_SESSION ?? null,
      adopt: cfg.adopt,
      replaceOrcaShells: cfg.replaceOrcaShells,
      run: defaultRunner,
      once: true,
    });
    writeOut("sync tick done\n");
    return 0;
  }
  if (parsed.command === "repair") {
    const pluginRoot = process.env.HERDR_PLUGIN_ROOT ?? pluginRootFromEntry(import.meta.url);
    const out = ensureDaemon({ pluginRoot, spawnDetached: existsDist(pluginRoot) });
    writeOut(`${out.message}\n`);
    const report = collectDoctorReport(defaultDoctorDeps(import.meta.url));
    writeOut(formatDoctorText(report));
    return out.code !== 0 ? out.code : report.ok ? 0 : 1;
  }
  if (parsed.command === "daemon") {
    const rest = parsed.rest;
    if (rest.includes("--help") || rest[0] === "help") {
      writeOut("herdr-orca daemon ensure|stop|uninstall\nherdr-orca daemon --foreground [--adopt]\n");
      return 0;
    }
    if (rest[0] === "ensure") {
      const pluginRoot = process.env.HERDR_PLUGIN_ROOT ?? pluginRootFromEntry(import.meta.url);
      const out = ensureDaemon({ pluginRoot, spawnDetached: existsDist(pluginRoot) });
      writeOut(`${out.message}\n`);
      return out.code;
    }
    if (rest[0] === "stop") {
      const out = stopDaemon({});
      writeOut(`${out.message}\n`);
      return out.code;
    }
    if (rest[0] === "uninstall") {
      const out = uninstallDaemon({});
      writeOut(`${out.message}\n`);
      return out.code;
    }
    if (rest.includes("--foreground")) {
      const cfg = loadSyncConfig();
      void runForeground({
        stateDir: pluginStateDir(),
        session: process.env.HERDR_SESSION ?? null,
        adopt: rest.includes("--adopt") || cfg.adopt,
        replaceOrcaShells: cfg.replaceOrcaShells,
        run: defaultRunner,
      });
      return 0;
    }
    writeErr("Usage: herdr-orca daemon ensure|stop|uninstall | herdr-orca daemon --foreground [--adopt]\n");
    return 2;
  }
  writeErr(rootHelp());
  return 2;
}

void main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
