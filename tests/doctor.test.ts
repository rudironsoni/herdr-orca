import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { collectDoctorReport, type DoctorDeps, type RunResult } from "../src/commands/doctor.ts";

function stubDeps(overrides: Partial<DoctorDeps> & { pluginRoot: string }): DoctorDeps {
  const files = new Map<string, string>();
  return {
    nodePath: "/usr/bin/node",
    nodeVersion: "v22.0.0",
    which: () => null,
    run: () => ({ status: 1, stdout: "", stderr: "" }),
    readOrcaBundleVersion: () => null,
    hooksFs: {
      home: overrides.pluginRoot,
      env: {},
      read: (path) => files.get(path) ?? null,
      write: (path, text) => {
        files.set(path, text);
      },
      remove: (path) => {
        files.delete(path);
      },
      mkdirp: () => {},
    },
    ...overrides,
  };
}

describe("collectDoctorReport", () => {
  it("fails when Herdr protocol is 17", () => {
    const pluginRoot = mkdtempSync(join(tmpdir(), "herdr-orca-"));
    mkdirSync(join(pluginRoot, "dist"));
    writeFileSync(join(pluginRoot, "dist/herdr-orca.mjs"), "");
    const run = (argv: string[]): RunResult => {
      if (argv.includes("status")) {
        return {
          status: 0,
          stdout: JSON.stringify({
            client: { version: "0.7.5", protocol: 17 },
            server: { running: true, version: "0.7.5", protocol: 17, session: "default" },
          }),
          stderr: "",
        };
      }
      return { status: 1, stdout: "", stderr: "" };
    };
    const report = collectDoctorReport(
      stubDeps({
        pluginRoot,
        which: (name) => (name === "herdr" ? "/bin/herdr" : name === "orca" ? "/bin/orca" : null),
        run,
        readOrcaBundleVersion: () => "1.4.195",
      }),
    );
    assert.equal(report.ok, false);
    assert.equal(report.issues.some((issue) => issue.code === "herdr_protocol_low"), true);
  });

  it("passes protocol 20 with Orca 1.4.170", () => {
    const pluginRoot = mkdtempSync(join(tmpdir(), "herdr-orca-"));
    mkdirSync(join(pluginRoot, "dist"));
    writeFileSync(join(pluginRoot, "dist/herdr-orca.mjs"), "");
    const run = (argv: string[]): RunResult => {
      if (argv[0]?.endsWith("herdr")) {
        return {
          status: 0,
          stdout: JSON.stringify({
            client: { version: "0.8.2", protocol: 20, session: "rudironsoni" },
            server: {
              running: true,
              version: "0.8.2",
              protocol: 20,
              session: "rudironsoni",
            },
          }),
          stderr: "",
        };
      }
      return {
        status: 0,
        stdout: JSON.stringify({
          ok: true,
          result: { runtime: { reachable: true, appVersion: "1.4.170" } },
        }),
        stderr: "",
      };
    };
    const report = collectDoctorReport(
      stubDeps({
        pluginRoot,
        which: (name) => (name === "herdr" ? "/bin/herdr" : name === "orca" ? "/bin/orca" : null),
        run,
      }),
    );
    assert.equal(report.ok, true);
    assert.equal(report.herdr.protocol, 20);
    assert.equal(report.orca.version, "1.4.170");
  });
});
