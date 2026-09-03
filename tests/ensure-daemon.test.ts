import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ensureDaemon } from "../src/commands/daemon.ts";
import type { ServiceFs } from "../src/service.ts";

describe("ensureDaemon", () => {
  it("does not write a live unit when dist is missing", () => {
    const files = new Map<string, string>();
    const fs: ServiceFs = {
      home: "/tmp/home",
      platform: "darwin",
      write: (path, text) => {
        files.set(path, text);
      },
      chmod: () => {},
      remove: (path) => {
        files.delete(path);
      },
      mkdirp: () => {},
    };
    const pluginRoot = mkdtempSync(join(tmpdir(), "herdr-orca-empty-"));
    const out = ensureDaemon({
      pluginRoot,
      fs,
      home: "/tmp/home",
      platform: "darwin",
      run: () => ({ status: 0, stdout: "", stderr: "" }),
    });
    assert.equal(out.code, 1);
    assert.equal(files.size, 0);
  });
});
