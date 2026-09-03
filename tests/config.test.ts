import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSyncConfig } from "../src/config.ts";

describe("parseSyncConfig", () => {
  it("defaults adopt on and replace_orca_shells on", () => {
    const cfg = parseSyncConfig(null);
    assert.equal(cfg.adopt, true);
    assert.equal(cfg.replaceOrcaShells, true);
  });

  it("reads adopt and replace_orca_shells", () => {
    const cfg = parseSyncConfig("[sync]\nadopt = true\nreplace_orca_shells = false\n");
    assert.equal(cfg.adopt, true);
    assert.equal(cfg.replaceOrcaShells, false);
  });
});
