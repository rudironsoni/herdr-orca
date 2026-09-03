import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLUGIN_ID } from "../src/paths.ts";
import {
  installServiceFiles,
  launchdPlistPath,
  renderLaunchdPlist,
  renderShim,
  renderSystemdUnit,
  SERVICE_LABEL,
  type ServiceFs,
} from "../src/service.ts";

function memoryFs(home: string, platform: "darwin" | "linux"): { fs: ServiceFs; files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    fs: {
      home,
      platform,
      write: (path, text) => {
        files.set(path, text);
      },
      chmod: () => {},
      remove: (path) => {
        files.delete(path);
      },
      mkdirp: () => {},
    },
  };
}

describe("service units", () => {
  it("renders a shim that execs herdr-orca.mjs", () => {
    const text = renderShim("/usr/bin/node");
    assert.equal(text.includes("#!/bin/sh"), true);
    assert.equal(text.includes("/usr/bin/node"), true);
    assert.equal(text.includes("herdr-orca.mjs"), true);
    assert.equal(text.includes(PLUGIN_ID), true);
  });

  it("renders launchd KeepAlive that does not restart a clean stop", () => {
    const text = renderLaunchdPlist({
      home: "/Users/rudi",
      shimPath: "/Users/rudi/.local/bin/herdr-orca",
      pathValue: "/Users/rudi/.local/bin:/usr/bin",
    });
    assert.equal(text.includes(SERVICE_LABEL), true);
    assert.equal(text.includes("SuccessfulExit"), true);
    assert.equal(text.includes("daemon"), true);
  });

  it("renders a systemd user unit", () => {
    const text = renderSystemdUnit({
      shimPath: "/home/rudi/.local/bin/herdr-orca",
      pathValue: "/home/rudi/.local/bin:/usr/bin",
    });
    assert.equal(text.includes("herdr-orca-sync"), true);
    assert.equal(text.includes("daemon --foreground"), true);
  });

  it("writes shim and plist on darwin", () => {
    const { fs, files } = memoryFs("/tmp/home", "darwin");
    installServiceFiles({ fs, nodePath: "/usr/bin/node", envPath: "/bin" });
    assert.equal(files.has("/tmp/home/.local/bin/herdr-orca"), true);
    assert.equal(files.has(launchdPlistPath("/tmp/home")), true);
  });
});
