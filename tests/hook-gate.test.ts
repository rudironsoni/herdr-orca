import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateGate, runHook } from "../src/hooks.ts";

const herdrEnv = {
  HERDR_ENV: "1",
  HERDR_SOCKET_PATH: "/tmp/herdr.sock",
};

describe("hook gate", () => {
  it("skips a plain Orca Cmd-T shell", () => {
    const result = evaluateGate({
      TERM_PROGRAM: "Orca",
      ORCA_TAB_ID: "tab",
      HERDR_ORCA_SYNC: "1",
    });
    assert.equal(result.kind, "skip");
    if (result.kind === "skip") assert.equal(result.reason, "not_herdr");
  });

  it("skips a Herdr pane that attach never stamped", () => {
    const result = evaluateGate(herdrEnv);
    assert.equal(result.kind, "skip");
    if (result.kind === "skip") assert.equal(result.reason, "plugin_not_attached");
  });

  it("runs when attach stamped Herdr plus Orca env", () => {
    const result = evaluateGate({
      ...herdrEnv,
      HERDR_ORCA_SYNC: "1",
      ORCA_TAB_ID: "tab",
      ORCA_PANE_KEY: "tab:a",
    });
    assert.equal(result.kind, "run");
  });

  it("skips a stamped Herdr pane with no Orca ids", () => {
    const result = evaluateGate({
      ...herdrEnv,
      HERDR_ORCA_SYNC: "1",
    });
    assert.equal(result.kind, "skip");
    if (result.kind === "skip") assert.equal(result.reason, "not_orca");
  });

  it("does not POST on a no-op path", async () => {
    const posts: unknown[] = [];
    const result = await runHook({
      env: { TERM_PROGRAM: "Orca", ORCA_TAB_ID: "tab" },
      event: "SessionStart",
      stdin: "{}",
      post: async (url, _token, body) => {
        posts.push({ url, body });
        return true;
      },
      readFile: () => null,
    });
    assert.equal(result.gate.kind, "skip");
    assert.equal(result.posted, false);
    assert.equal(posts.length, 0);
    assert.equal(result.code, 0);
  });

  it("POSTs when the gate passes", async () => {
    const posts: Array<{ url: string; body: unknown }> = [];
    const result = await runHook({
      env: {
        ...herdrEnv,
        HERDR_ORCA_SYNC: "1",
        ORCA_TAB_ID: "tab",
        ORCA_PANE_KEY: "tab:a",
        ORCA_AGENT_HOOK_ENDPOINT: "http://127.0.0.1:9/",
      },
      event: "PreToolUse",
      stdin: "{}",
      post: async (url, _token, body) => {
        posts.push({ url, body });
        return true;
      },
      readFile: () => null,
    });
    assert.equal(result.gate.kind, "run");
    assert.equal(result.posted, true);
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.url, "http://127.0.0.1:9/");
    const body = posts[0]?.body as { payload?: { state?: string } };
    assert.equal(body.payload?.state, "working");
  });
});
