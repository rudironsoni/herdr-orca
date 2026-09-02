import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attachArgv, runAttach } from "../src/commands/attach.ts";

describe("runAttach", () => {
  it("refuses to run outside Orca", () => {
    const result = runAttach("term_1", {
      env: {},
      which: () => "/bin/herdr",
      exec: () => 0,
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
    });
    assert.equal(result.code, 0);
    assert.deepEqual(seen, ["/bin/herdr", ...attachArgv("term_1")]);
  });
});
