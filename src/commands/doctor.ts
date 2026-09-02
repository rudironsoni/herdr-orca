import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  classifyHerdrProtocol,
  MIN_HERDR_PROTOCOL,
  MIN_ORCA_VERSION,
  orcaVersionMeetsFloor,
} from "../floors.ts";
import { distEntry, pluginRootFromEntry } from "../paths.ts";

export type Issue = {
  level: "fail" | "warn";
  code: string;
  message: string;
};

export type DoctorReport = {
  ok: boolean;
  floors: {
    herdrMinProtocol: number;
    orcaMin: string;
  };
  node: { path: string | null; version: string | null };
  dist: { path: string; present: boolean };
  herdr: {
    path: string | null;
    version: string | null;
    protocol: number | null;
    session: string | null;
    running: boolean;
  };
  orca: {
    path: string | null;
    version: string | null;
    runtimeReachable: boolean;
  };
  issues: Issue[];
};

export type RunResult = { status: number | null; stdout: string; stderr: string };
export type Runner = (argv: string[]) => RunResult;

export type DoctorDeps = {
  pluginRoot: string;
  nodePath: string | null;
  nodeVersion: string;
  which: (name: string) => string | null;
  run: Runner;
  readOrcaBundleVersion: (orcaBin: string) => string | null;
};

const defaultWhich = (name: string): string | null => {
  const result = spawnSync("which", [name], { encoding: "utf8" });
  const found = result.stdout.trim();
  return result.status === 0 && found.length > 0 ? found : null;
};

const defaultRun: Runner = (argv) => {
  const [cmd, ...args] = argv;
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

export function readOrcaBundleVersion(orcaBin: string): string | null {
  let resolved = orcaBin;
  try {
    resolved = realpathSync(orcaBin);
  } catch {
    return null;
  }
  const marker = "/Contents/Resources/";
  const idx = resolved.indexOf(marker);
  if (idx === -1) return null;
  const plist = join(resolved.slice(0, idx), "Contents/Info.plist");
  if (!existsSync(plist)) return null;
  const result = spawnSync("defaults", ["read", plist, "CFBundleShortVersionString"], {
    encoding: "utf8",
  });
  const version = result.stdout.trim();
  return result.status === 0 && version.length > 0 ? version : null;
}

function parseJson(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(record: Record<string, unknown> | null, key: string): number | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBool(record: Record<string, unknown> | null, key: string): boolean | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

export function collectDoctorReport(deps: DoctorDeps): DoctorReport {
  const issues: Issue[] = [];
  const distPath = distEntry(deps.pluginRoot);
  const distPresent = existsSync(distPath);
  if (!distPresent) {
    issues.push({
      level: "fail",
      code: "dist_missing",
      message: `Built entry is missing: ${distPath}. Run pnpm build.`,
    });
  }
  if (!deps.nodePath) {
    issues.push({
      level: "fail",
      code: "node_missing",
      message: "node is not on PATH. The daemon runs node dist/herdr-orca.mjs.",
    });
  }

  const herdrPath = deps.which("herdr");
  let herdrVersion: string | null = null;
  let herdrProtocol: number | null = null;
  let herdrSession: string | null = null;
  let herdrRunning = false;
  if (!herdrPath) {
    issues.push({
      level: "fail",
      code: "herdr_missing",
      message: "herdr is not on PATH.",
    });
  } else {
    const status = deps.run([herdrPath, "status", "--json"]);
    const parsed = parseJson(status.stdout);
    const root = asRecord(parsed);
    const client = asRecord(root?.client ?? null);
    const server = asRecord(root?.server ?? null);
    herdrVersion = readString(server, "version") ?? readString(client, "version");
    herdrProtocol = readNumber(server, "protocol") ?? readNumber(client, "protocol");
    herdrSession = readString(server, "session") ?? readString(client, "session");
    herdrRunning = readBool(server, "running") ?? readString(server, "status") === "running";
    if (herdrProtocol === null) {
      issues.push({
        level: "fail",
        code: "herdr_protocol_unknown",
        message: "Could not read Herdr protocol from `herdr status --json`.",
      });
    } else {
      const klass = classifyHerdrProtocol(herdrProtocol);
      if (klass === "unsupported") {
        issues.push({
          level: "fail",
          code: "herdr_protocol_low",
          message: `Herdr protocol ${herdrProtocol} is below 18.`,
        });
      }
    }
  }

  const orcaPath = deps.which("orca");
  let orcaVersion: string | null = null;
  let runtimeReachable = false;
  if (!orcaPath) {
    issues.push({
      level: "fail",
      code: "orca_missing",
      message: "orca is not on PATH.",
    });
  } else {
    const status = deps.run([orcaPath, "status", "--json"]);
    const parsed = parseJson(status.stdout);
    const root = asRecord(parsed);
    const result = asRecord(root?.result ?? null);
    const runtime = asRecord(result?.runtime ?? null);
    const app = asRecord(result?.app ?? null);
    orcaVersion =
      readString(runtime, "appVersion") ??
      readString(app, "version") ??
      deps.readOrcaBundleVersion(orcaPath);
    runtimeReachable = readBool(runtime, "reachable") === true;
    if (!runtimeReachable) {
      issues.push({
        level: "warn",
        code: "orca_runtime_down",
        message: "Orca runtime is not reachable. Run `orca open`. Version still comes from the app bundle.",
      });
    }
    if (!orcaVersion) {
      issues.push({
        level: "warn",
        code: "orca_version_unknown",
        message: "Could not read Orca version. Floor is 1.4.170.",
      });
    } else if (!orcaVersionMeetsFloor(orcaVersion)) {
      issues.push({
        level: "fail",
        code: "orca_version_low",
        message: `Orca ${orcaVersion} is below ${MIN_ORCA_VERSION}.`,
      });
    }
  }

  const failures = issues.filter((issue) => issue.level === "fail");
  return {
    ok: failures.length === 0,
    floors: {
      herdrMinProtocol: MIN_HERDR_PROTOCOL,
      orcaMin: MIN_ORCA_VERSION,
    },
    node: { path: deps.nodePath, version: deps.nodeVersion },
    dist: { path: distPath, present: distPresent },
    herdr: {
      path: herdrPath,
      version: herdrVersion,
      protocol: herdrProtocol,
      session: herdrSession,
      running: herdrRunning,
    },
    orca: { path: orcaPath, version: orcaVersion, runtimeReachable },
    issues,
  };
}

export function formatDoctorText(report: DoctorReport): string {
  const lines = [
    `floors: herdr protocol >= ${report.floors.herdrMinProtocol}; orca >= ${report.floors.orcaMin}`,
    `node: ${report.node.path ?? "missing"} ${report.node.version ?? ""}`.trim(),
    `dist: ${report.dist.present ? "present" : "missing"} ${report.dist.path}`,
    `herdr: ${report.herdr.path ?? "missing"} version=${report.herdr.version ?? "unknown"} protocol=${report.herdr.protocol ?? "unknown"} session=${report.herdr.session ?? "unknown"} running=${report.herdr.running}`,
    `orca: ${report.orca.path ?? "missing"} version=${report.orca.version ?? "unknown"} runtime=${report.orca.runtimeReachable ? "reachable" : "down"}`,
  ];
  if (report.issues.length === 0) {
    lines.push("issues: none");
  } else {
    lines.push("issues:");
    for (const issue of report.issues) {
      lines.push(`  ${issue.level} ${issue.code}: ${issue.message}`);
    }
  }
  lines.push(report.ok ? "ok: true" : "ok: false");
  return `${lines.join("\n")}\n`;
}

export function defaultDoctorDeps(entryHref: string): DoctorDeps {
  const pluginRoot = process.env.HERDR_PLUGIN_ROOT ?? pluginRootFromEntry(entryHref);
  return {
    pluginRoot,
    nodePath: process.execPath,
    nodeVersion: process.version,
    which: defaultWhich,
    run: defaultRun,
    readOrcaBundleVersion,
  };
}
