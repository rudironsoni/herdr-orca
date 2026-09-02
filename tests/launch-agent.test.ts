import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runLaunchAgent } from "../src/commands/launch-agent.ts";
import type { Runner } from "../src/run.ts";

describe("runLaunchAgent", () => {
  it("creates a Herdr tab then attaches", () => {
    const calls: string[][] = [];
    const run: Runner = (argv) => {
      calls.push(argv.slice(1));
      const joined = argv.join(" ");
      if (joined.includes("workspace list")) {
        return { status: 0, stdout: JSON.stringify({ result: { workspaces: [] } }), stderr: "" };
      }
      if (joined.includes("workspace create")) {
        return {
          status: 0,
          stdout: JSON.stringify({ result: { workspace: { workspace_id: "w1" } } }),
          stderr: "",
        };
      }
      if (joined.includes("tab create")) {
        return {
          status: 0,
          stdout: JSON.stringify({
            result: { tab: { tab_id: "w1:t2" }, pane: { pane_id: "w1:p2", terminal_id: "term_new" } },
          }),
          stderr: "",
        };
      }
      return { status: 0, stdout: "{}", stderr: "" };
    };
    const result = runLaunchAgent({
      env: { TERM_PROGRAM: "Orca", ORCA_TAB_ID: "tab-orca", ORCA_PANE_KEY: "tab-orca:a" },
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
      openDb: () => null,
    });
    assert.equal(result.code, 0);
    assert.equal(result.terminalId, "term_new");
    assert.equal(calls.some((row) => row[0] === "attach" && row[1] === "term_new"), true);
    assert.equal(
      calls.some((row) => row.includes("--env") && row.some((item) => item.startsWith("ORCA_TAB_ID="))),
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
      openDb: () => null,
    });
    assert.equal(result.code, 1);
  });
});
