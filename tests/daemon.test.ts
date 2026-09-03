import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tick } from "../src/commands/daemon.ts";
import type { World } from "../src/reconcile.ts";

describe("daemon tick", () => {
  it("does not create Orca tabs without --adopt", () => {
    const world: World = {
      herdr: [
        {
          terminalId: "term_1",
          paneId: "w1:p1",
          tabId: "w1:t1",
          title: "shell",
          pluginOwned: false,
          cwd: "/tmp/repo",
        },
      ],
      orca: [],
      orcaReachable: true,
      mappings: [],
      mutations: [],
      orcaClose: "detach",
    };
    const calls: string[][] = [];
    tick(world, {
      adopt: false,
      orcaBin: "orca",
      run: (argv) => {
        calls.push(argv);
        return { status: 0, stdout: "{}", stderr: "" };
      },
    });
    assert.equal(calls.length, 0);
  });

  it("creates an Orca attach tab with --adopt", () => {
    const world: World = {
      herdr: [
        {
          terminalId: "term_1",
          paneId: "w1:p1",
          tabId: "w1:t1",
          title: "shell",
          pluginOwned: false,
          cwd: "/tmp/repo",
        },
      ],
      orca: [],
      orcaReachable: true,
      mappings: [],
      mutations: [],
      orcaClose: "detach",
    };
    const calls: string[][] = [];
    tick(world, {
      adopt: true,
      orcaBin: "orca",
      run: (argv) => {
        calls.push(argv);
        return { status: 0, stdout: "{}", stderr: "" };
      },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.includes("terminal"), true);
    assert.equal(calls[0]?.includes("create"), true);
    assert.equal(
      calls[0]?.some((item) => item.includes("herdr-orca attach --terminal term_1")),
      true,
    );
  });

  it("does not create a second Orca tab when attach already exists", () => {
    const world: World = {
      herdr: [
        {
          terminalId: "term_1",
          paneId: "w1:p1",
          tabId: "w1:t1",
          title: "shell",
          pluginOwned: false,
          cwd: "/tmp/repo",
        },
      ],
      orca: [
        {
          tabId: "tab_1",
          paneKey: "tab_1:a",
          title: "shell",
          command: "herdr-orca attach --terminal term_1",
        },
      ],
      orcaReachable: true,
      mappings: [],
      mutations: [],
      orcaClose: "detach",
    };
    const calls: string[][] = [];
    tick(world, {
      adopt: true,
      orcaBin: "orca",
      run: (argv) => {
        calls.push(argv);
        return { status: 0, stdout: "{}", stderr: "" };
      },
    });
    assert.equal(calls.length, 0);
  });
});
