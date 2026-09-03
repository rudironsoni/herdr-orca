import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyOps, reconcile, type World } from "../src/reconcile.ts";

function world(partial: Partial<World>): World {
  return {
    herdr: [],
    orca: [],
    orcaReachable: true,
    mappings: [],
    mutations: [],
    orcaClose: "detach",
    ...partial,
  };
}

describe("reconcile", () => {
  it("is idempotent after apply", () => {
    const start = world({
      herdr: [
        {
          terminalId: "term_1",
          paneId: "w1:p1",
          tabId: "w1:t1",
          title: "shell",
          pluginOwned: false,
        },
      ],
    });
    const first = reconcile(start);
    assert.equal(first.ops.length, 1);
    assert.equal(first.ops[0]?.type, "create_orca_attach");
    const after = applyOps(start, first.ops);
    const second = reconcile(after);
    const third = reconcile(applyOps(after, second.ops));
    assert.deepEqual(
      third.ops.filter((op) => op.type !== "ack"),
      [],
    );
  });

  it("maps one Herdr terminal to at most one Orca leaf", () => {
    const start = world({
      herdr: [
        {
          terminalId: "term_1",
          paneId: "w1:p1",
          tabId: "w1:t1",
          title: "shell",
          pluginOwned: false,
        },
      ],
    });
    const after = applyOps(start, reconcile(start).ops);
    const again = applyOps(after, reconcile(after).ops);
    const leaves = again.orca.filter((leaf) => leaf.command.includes("term_1"));
    assert.equal(leaves.length, 1);
    assert.equal(again.mappings.filter((row) => row.herdrTerminalId === "term_1").length, 1);
  });

  it("does not kill a Herdr process when Orca closes and orca_close is detach", () => {
    const start = world({
      herdr: [
        {
          terminalId: "term_1",
          paneId: "w1:p1",
          tabId: "w1:t1",
          title: "shell",
          pluginOwned: false,
        },
      ],
      mappings: [
        {
          herdrTerminalId: "term_1",
          orcaTabId: "tab_1",
          orcaPaneKey: "tab_1:leaf",
          title: "shell",
        },
      ],
      orca: [],
      orcaClose: "detach",
    });
    const plan = reconcile(start);
    assert.equal(
      plan.ops.some((op) => op.type === "close_herdr"),
      false,
    );
  });

  it("does not delete mappings when Orca is unreachable", () => {
    const start = world({
      orcaReachable: false,
      herdr: [
        {
          terminalId: "term_1",
          paneId: "w1:p1",
          tabId: "w1:t1",
          title: "shell",
          pluginOwned: false,
        },
      ],
    });
    assert.deepEqual(reconcile(start).ops, []);
  });

  it("replaces an ordinary Orca PTY instead of leaving it Orca-only", () => {
    const start = world({
      orca: [{ tabId: "tab_1", paneKey: "tab_1:a", title: "zsh", command: "zsh" }],
    });
    const plan = reconcile(start);
    assert.equal(plan.ops[0]?.type, "replace_orca_pty");
  });

  it("does not replace a bare herdr-orca tab", () => {
    const start = world({
      orca: [{ tabId: "tab_1", paneKey: "tab_1:a", title: "fever2", command: "herdr-orca" }],
    });
    const plan = reconcile(start);
    assert.equal(
      plan.ops.some((op) => op.type === "replace_orca_pty"),
      false,
    );
  });

  it("does not replace an Orca tab when the command is unknown", () => {
    const start = world({
      orca: [{ tabId: "tab_1", paneKey: "tab_1:a", title: "zsh", command: "" }],
    });
    const plan = reconcile(start);
    assert.equal(
      plan.ops.some((op) => op.type === "replace_orca_pty"),
      false,
    );
  });

  it("does not adopt a Herdr terminal whose cwd is not an open Orca terminal", () => {
    const start = world({
      herdr: [
        {
          terminalId: "term_1",
          paneId: "w1:p1",
          tabId: "w1:t1",
          title: "shell",
          pluginOwned: false,
          cwd: "/tmp/other",
        },
      ],
      orca: [{ tabId: "tab_1", paneKey: "tab_1:a", title: "fever2", command: "zsh", cwd: "/tmp/fever2" }],
    });
    const plan = reconcile(start);
    assert.equal(
      plan.ops.some((op) => op.type === "create_orca_attach"),
      false,
    );
  });

  it("treats an Orca attach command as the mapping", () => {
    const start = world({
      herdr: [
        {
          terminalId: "term_1",
          paneId: "w1:p1",
          tabId: "w1:t1",
          title: "shell",
          pluginOwned: false,
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
    });
    const plan = reconcile(start);
    assert.equal(
      plan.ops.some((op) => op.type === "create_orca_attach" || op.type === "replace_orca_pty"),
      false,
    );
  });

  it("acks a title mutation instead of bouncing", () => {
    const start = world({
      herdr: [
        {
          terminalId: "term_1",
          paneId: "w1:p1",
          tabId: "w1:t1",
          title: "Auth",
          pluginOwned: false,
        },
      ],
      orca: [
        {
          tabId: "tab_1",
          paneKey: "tab_1:a",
          title: "Auth",
          command: "herdr-orca attach --terminal term_1",
        },
      ],
      mappings: [
        {
          herdrTerminalId: "term_1",
          orcaTabId: "tab_1",
          orcaPaneKey: "tab_1:a",
          title: "Auth",
        },
      ],
      mutations: [
        {
          id: "m1",
          field: "title",
          target: "tab_1",
          expectedValue: "Auth",
          source: "herdr",
        },
      ],
    });
    const plan = reconcile(start);
    assert.deepEqual(plan.ops, [{ type: "ack", mutationId: "m1" }]);
  });
});
