import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadMappings, openState, upsertMapping } from "../src/state.ts";

describe("state", () => {
  it("round-trips a mapping", () => {
    const db = openState(":memory:");
    upsertMapping(db, {
      herdrTerminalId: "term_1",
      orcaTabId: "tab_1",
      orcaPaneKey: "tab_1:a",
      title: "shell",
    });
    const rows = loadMappings(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.herdrTerminalId, "term_1");
    assert.equal(rows[0]?.orcaTabId, "tab_1");
  });
});
