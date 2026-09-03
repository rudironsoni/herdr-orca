import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  collectHooksStatus,
  isOrcaOwnedConfig,
  runHooksInstall,
  runHooksUninstall,
  type FsHooks,
} from "../src/commands/hooks.ts";
import { isPluginHookCommand } from "../src/hooks.ts";

function memoryFs(home = "/tmp/home"): { fs: FsHooks; files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    fs: {
      home,
      env: {},
      read: (path) => files.get(path) ?? null,
      write: (path, text) => {
        files.set(path, text);
      },
      remove: (path) => {
        files.delete(path);
      },
      mkdirp: () => {},
    },
  };
}

describe("hooks install", () => {
  it("appends plugin hooks and leaves other Claude entries", () => {
    const { fs, files } = memoryFs();
    const claude = join(fs.home, ".claude/settings.json");
    files.set(
      claude,
      JSON.stringify({
        model: "keep-me",
        hooks: {
          Stop: [{ hooks: [{ type: "command", command: "echo other" }] }],
        },
      }),
    );
    const installed = runHooksInstall(fs);
    assert.equal(installed.ok, true);
    const claudeDoc = JSON.parse(files.get(claude) ?? "{}") as {
      model: string;
      hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> };
    };
    assert.equal(claudeDoc.model, "keep-me");
    assert.equal(
      claudeDoc.hooks.Stop.some((group) => group.hooks.some((hook) => hook.command === "echo other")),
      true,
    );
    assert.equal(
      claudeDoc.hooks.Stop.some((group) =>
        group.hooks.some((hook) => isPluginHookCommand(hook.command)),
      ),
      true,
    );
    const grok = files.get(join(fs.home, ".grok/hooks/herdr-orca.json"));
    assert.equal(typeof grok, "string");
    assert.equal(grok?.includes("herdr-orca hook --event SessionStart"), true);
    assert.equal(isOrcaOwnedConfig(join(fs.home, ".grok/hooks/orca-status.json")), true);

    const removed = runHooksUninstall(fs);
    assert.equal(removed.ok, true);
    const after = JSON.parse(files.get(claude) ?? "{}") as typeof claudeDoc;
    assert.equal(after.model, "keep-me");
    assert.equal(
      after.hooks.Stop.some((group) => group.hooks.some((hook) => hook.command === "echo other")),
      true,
    );
    assert.equal(
      after.hooks.Stop.some((group) => group.hooks.some((hook) => isPluginHookCommand(hook.command))),
      false,
    );
    assert.equal(files.has(join(fs.home, ".grok/hooks/herdr-orca.json")), false);
  });

  it("does not write Orca-owned Codex homes", () => {
    const { fs, files } = memoryFs();
    fs.env = { CODEX_HOME: "/tmp/Library/Application Support/orca/codex-runtime-home/home" };
    const installed = runHooksInstall(fs);
    const codex = installed.targets.find((row) => row.id === "codex");
    assert.equal(codex?.skipped, true);
    assert.equal(files.size > 0, true);
    assert.equal(
      [...files.keys()].some((path) => isOrcaOwnedConfig(path)),
      false,
    );
  });

  it("skips install when config disables hooks", () => {
    const { fs, files } = memoryFs();
    files.set(
      join(fs.home, ".config/herdr/plugins/config/rudironsoni.herdr-orca-sync/config.toml"),
      "[agents]\nhooks_install = false\n",
    );
    const installed = runHooksInstall(fs);
    assert.equal(installed.ok, false);
    assert.equal(installed.targets.every((row) => row.skipped), true);
    assert.equal(collectHooksStatus(fs).ok, false);
  });
});
