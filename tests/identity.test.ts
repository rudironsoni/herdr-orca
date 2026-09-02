import assert from "node:assert/strict";
import { mkdtempSync, symlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { canonicalPath, gitCommonDir, gitWorktreeRoot } from "../src/identity.ts";

describe("identity", () => {
  it("maps a symlink and its target to the same path", () => {
    const root = mkdtempSync(join(tmpdir(), "herdr-orca-id-"));
    const real = join(root, "real");
    mkdirSync(real);
    const link = join(root, "link");
    symlinkSync(real, link);
    assert.equal(canonicalPath(link), canonicalPath(real));
  });

  it("uses git common dir so two worktrees in one repo share a project key", () => {
    const root = mkdtempSync(join(tmpdir(), "herdr-orca-git-"));
    const repo = join(root, "repo");
    mkdirSync(repo);
    spawnSync("git", ["init", "-q", repo], { stdio: "ignore" });
    spawnSync("git", ["-C", repo, "config", "user.email", "t@example.com"], { stdio: "ignore" });
    spawnSync("git", ["-C", repo, "config", "user.name", "t"], { stdio: "ignore" });
    spawnSync("git", ["-C", repo, "commit", "--allow-empty", "-qm", "init"], { stdio: "ignore" });
    const wt = join(root, "repo.worktrees", "feature");
    mkdirSync(join(root, "repo.worktrees"));
    spawnSync("git", ["-C", repo, "worktree", "add", "-q", wt, "-b", "feature"], { stdio: "ignore" });
    assert.equal(gitCommonDir(repo), gitCommonDir(wt));
    assert.notEqual(gitWorktreeRoot(repo), gitWorktreeRoot(wt));
  });
});
