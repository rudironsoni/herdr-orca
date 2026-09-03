import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runLaunchAgent } from "../src/commands/launch-agent.ts";
import type { Runner } from "../src/run.ts";

const orcaEnv = { TERM_PROGRAM: "Orca", ORCA_TAB_ID: "tab-orca", ORCA_PANE_KEY: "tab-orca:a" };

describe("runLaunchAgent", () => {
  it("uses the default workspace pane and does not create a second tab", () => {
    const calls: string[][] = [];
    const run: Runner = (argv) => {
      calls.push(argv.slice(1));
      const joined = argv.join(" ");
      if (joined.includes("pane list")) {
        return { status: 0, stdout: JSON.stringify({ result: { panes: [] } }), stderr: "" };
      }
      if (joined.includes("workspace create")) {
        return {
          status: 0,
          stdout: JSON.stringify({
            result: {
              workspace: { workspace_id: "w1" },
              tab: { tab_id: "w1:t1" },
              root_pane: { pane_id: "w1:p1", terminal_id: "term_new" },
            },
          }),
          stderr: "",
        };
      }
      return { status: 0, stdout: "{}", stderr: "" };
    };
    const result = runLaunchAgent({
      env: orcaEnv,
      cwd: "/tmp",
      agent: null,
      agentArgs: [],
      session: null,
      herdrBin: "herdr",
      run,
      execAttach: (id) => {
        calls.push(["attach", id]);
        return 0;
      },
    });
    assert.equal(result.code, 0);
    assert.equal(result.terminalId, "term_new");
    assert.equal(
      calls.some((row) => row[0] === "tab" && row[1] === "create"),
      false,
    );
    assert.equal(calls.some((row) => row[0] === "attach" && row[1] === "term_new"), true);
    assert.equal(
      calls.some((row) => row.includes("--env") && row.some((item) => item.startsWith("ORCA_TAB_ID="))),
      true,
    );
  });

  it("reuses an existing workspace for the same cwd instead of creating another", () => {
    const calls: string[][] = [];
    const run: Runner = (argv) => {
      calls.push(argv.slice(1));
      const joined = argv.join(" ");
      if (joined.includes("pane list") && !joined.includes("--workspace")) {
        return {
          status: 0,
          stdout: JSON.stringify({
            result: {
              panes: [
                {
                  workspace_id: "wF",
                  pane_id: "wF:p1",
                  tab_id: "wF:t1",
                  terminal_id: "term_old",
                  cwd: "/tmp/fever2",
                },
              ],
            },
          }),
          stderr: "",
        };
      }
      if (joined.includes("tab create")) {
        return {
          status: 0,
          stdout: JSON.stringify({
            result: { tab: { tab_id: "wF:t2" }, pane: { pane_id: "wF:p2", terminal_id: "term_new" } },
          }),
          stderr: "",
        };
      }
      return { status: 0, stdout: "{}", stderr: "" };
    };
    const result = runLaunchAgent({
      env: orcaEnv,
      cwd: "/tmp/fever2",
      agent: null,
      agentArgs: [],
      session: null,
      herdrBin: "herdr",
      run,
      execAttach: (id) => {
        calls.push(["attach", id]);
        return 0;
      },
    });
    assert.equal(result.code, 0);
    assert.equal(result.terminalId, "term_new");
    assert.equal(
      calls.some((row) => row[0] === "workspace" && row[1] === "create"),
      false,
    );
    assert.equal(
      calls.some((row) => row[0] === "tab" && row[1] === "create" && row.includes("wF")),
      true,
    );
  });

  it("refuses to run outside Orca", () => {
    const result = runLaunchAgent({
      env: {},
      cwd: "/tmp",
      agent: null,
      agentArgs: [],
      session: null,
      herdrBin: "herdr",
      run: () => ({ status: 0, stdout: "{}", stderr: "" }),
      execAttach: () => 0,
    });
    assert.equal(result.code, 1);
  });
});
