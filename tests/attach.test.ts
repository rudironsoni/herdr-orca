import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attachArgv, injectEnvCommand, runAttach, syncEnvPairs } from "../src/commands/attach.ts";
import type { Runner } from "../src/run.ts";

const silentRun: Runner = () => ({ status: 0, stdout: "{}", stderr: "" });

describe("runAttach", () => {
  it("refuses to run outside Orca", () => {
    const result = runAttach("term_1", {
      env: {},
      which: () => "/bin/herdr",
      exec: () => 0,
      run: silentRun,
    });
    assert.equal(result.code, 1);
    assert.match(result.error ?? "", /outside an Orca terminal/);
  });

  it("refuses to run inside Herdr", () => {
    const result = runAttach("term_1", {
      env: {
        TERM_PROGRAM: "Orca",
        ORCA_TAB_ID: "tab",
        HERDR_ENV: "1",
        HERDR_SOCKET_PATH: "/tmp/herdr.sock",
      },
      which: () => "/bin/herdr",
      exec: () => 0,
      run: silentRun,
    });
    assert.equal(result.code, 1);
    assert.match(result.error ?? "", /inside a Herdr pane/);
  });

  it("execs herdr terminal attach --takeover", () => {
    let seen: string[] = [];
    const result = runAttach("term_1", {
      env: { TERM_PROGRAM: "Orca", ORCA_TAB_ID: "tab" },
      which: () => "/bin/herdr",
      exec: (argv) => {
        seen = argv;
        return 0;
      },
      run: silentRun,
      inject: false,
    });
    assert.equal(result.code, 0);
    assert.deepEqual(seen, ["/bin/herdr", ...attachArgv("term_1")]);
  });

  it("exports HERDR_ORCA_SYNC and ORCA_* into the Herdr pane before attach", () => {
    const calls: string[][] = [];
    const result = runAttach("term_1", {
      env: {
        TERM_PROGRAM: "Orca",
        ORCA_TAB_ID: "tab",
        ORCA_PANE_KEY: "tab:a",
        ORCA_AGENT_HOOK_ENDPOINT: "/tmp/endpoint.env",
      },
      which: () => "/bin/herdr",
      exec: () => 0,
      run: (argv) => {
        calls.push(argv.slice(1));
        if (argv.includes("list")) {
          return {
            status: 0,
            stdout: JSON.stringify({ result: { panes: [{ pane_id: "w1:p1", terminal_id: "term_1" }] } }),
            stderr: "",
          };
        }
        return { status: 0, stdout: "{}", stderr: "" };
      },
    });
    assert.equal(result.code, 0);
    const ran = calls.find((row) => row[0] === "pane" && row[1] === "run");
    assert.equal(Boolean(ran), true);
    assert.equal(ran?.[2], "w1:p1");
    assert.equal(ran?.[3]?.includes("HERDR_ORCA_SYNC='1'"), true);
    assert.equal(ran?.[3]?.includes("ORCA_TAB_ID='tab'"), true);
    assert.equal(ran?.[3]?.includes("ORCA_AGENT_HOOK_TOKEN"), false);
  });
});

describe("syncEnvPairs", () => {
  it("always stamps HERDR_ORCA_SYNC and never copies the hook token", () => {
    const pairs = syncEnvPairs({
      ORCA_TAB_ID: "tab",
      ORCA_AGENT_HOOK_TOKEN: "secret",
    });
    assert.equal(pairs.includes("HERDR_ORCA_SYNC=1"), true);
    assert.equal(pairs.some((pair) => pair.startsWith("ORCA_TAB_ID=")), true);
    assert.equal(pairs.some((pair) => pair.includes("TOKEN")), false);
    assert.equal(injectEnvCommand(["HERDR_ORCA_SYNC=1"]).includes("export"), true);
  });
});
