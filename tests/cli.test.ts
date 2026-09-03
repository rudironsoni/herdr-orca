import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArgs } from "../src/cli.ts";

describe("parseArgs", () => {
  it("prints root help for --help", () => {
    assert.equal(parseArgs(["--help"]).kind, "help");
  });

  it("treats no args as open (Orca tab command)", () => {
    const parsed = parseArgs([]);
    assert.equal(parsed.kind, "command");
    if (parsed.kind === "command") assert.equal(parsed.command, "open");
  });

  it("rejects unknown commands", () => {
    const parsed = parseArgs(["nope"]);
    assert.equal(parsed.kind, "unknown");
    if (parsed.kind === "unknown") assert.equal(parsed.command, "nope");
  });

  it("parses doctor --json", () => {
    const parsed = parseArgs(["doctor", "--json"]);
    assert.equal(parsed.kind, "command");
    if (parsed.kind === "command") {
      assert.equal(parsed.command, "doctor");
      assert.equal(parsed.json, true);
    }
  });

  it("parses attach --terminal", () => {
    const parsed = parseArgs(["attach", "--terminal", "term_1"]);
    assert.equal(parsed.kind, "command");
    if (parsed.kind === "command") assert.equal(parsed.command, "attach");
  });

  it("parses launch-agent", () => {
    const parsed = parseArgs(["launch-agent", "--agent", "claude"]);
    assert.equal(parsed.kind, "command");
    if (parsed.kind === "command") assert.equal(parsed.command, "launch-agent");
  });

  it("parses root --agent as open", () => {
    const parsed = parseArgs(["--agent", "claude"]);
    assert.equal(parsed.kind, "command");
    if (parsed.kind === "command") assert.equal(parsed.command, "open");
  });

  it("parses hook and hooks", () => {
    const hook = parseArgs(["hook", "--event", "SessionStart"]);
    assert.equal(hook.kind, "command");
    if (hook.kind === "command") assert.equal(hook.command, "hook");
    const hooks = parseArgs(["hooks", "status", "--json"]);
    assert.equal(hooks.kind, "command");
    if (hooks.kind === "command") {
      assert.equal(hooks.command, "hooks");
      assert.equal(hooks.json, true);
    }
  });
});
