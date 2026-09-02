import { parseArgs, rootHelp, doctorHelp, attachHelp, flagValue } from "./cli.ts";
import { collectDoctorReport, defaultDoctorDeps, formatDoctorText } from "./commands/doctor.ts";
import { defaultExec, runAttach } from "./commands/attach.ts";
import { spawnSync } from "node:child_process";

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
  if (parsed.command === "daemon") {
    const sub = parsed.rest[0] ?? "help";
    if (sub === "ensure") {
      writeErr("herdr-orca daemon is not in this build. Startup skips it.\n");
      return 0;
    }
    writeErr("Usage: herdr-orca daemon ensure\n");
    return 2;
  }
  writeErr(rootHelp());
  return 2;
}

const code = main(process.argv.slice(2));
process.exitCode = code;
