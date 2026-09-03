import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openInOrcaArgv, runOpenInOrca } from "../src/commands/open-in-orca.ts";

describe("open-in-orca", () => {
  it("builds an Orca create command that attaches the Herdr terminal", () => {
    const argv = openInOrcaArgv("term_1", "shell", "/tmp/repo");
    assert.equal(argv.includes("terminal"), true);
    assert.equal(argv.includes("create"), true);
    assert.equal(
      argv.some((item) => item.includes("herdr-orca attach --terminal term_1")),
      true,
    );
  });

  it("refuses to run outside Herdr", () => {
    const result = runOpenInOrca({
      env: {},
      herdrBin: "herdr",
      orcaBin: "orca",
      run: () => ({ status: 0, stdout: "{}", stderr: "" }),
    });
    assert.equal(result.code, 1);
  });

  it("creates an Orca attach tab for the current pane", () => {
    const calls: string[][] = [];
    const result = runOpenInOrca({
      env: { HERDR_ENV: "1", HERDR_SOCKET_PATH: "/tmp/herdr.sock", HERDR_PANE_ID: "w1:p1" },
      herdrBin: "herdr",
      orcaBin: "orca",
      run: (argv) => {
        calls.push(argv);
        if (argv.includes("pane") && argv.includes("get")) {
          return {
            status: 0,
            stdout: JSON.stringify({ result: { terminal_id: "term_1", cwd: "/tmp/repo", label: "shell" } }),
            stderr: "",
          };
        }
        return { status: 0, stdout: "{}", stderr: "" };
      },
    });
    assert.equal(result.code, 0);
    assert.equal(
      calls.some((row) => row.includes("create") && row.some((item) => item.includes("herdr-orca attach --terminal term_1"))),
      true,
    );
  });
});
