import { realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";

export function canonicalPath(path: string): string {
  return realpathSync(path);
}

export function gitCommonDir(cwd: string): string | null {
  const result = spawnSync("git", ["-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  const dir = result.stdout.trim();
  if (!dir) return null;
  try {
    return realpathSync(dir);
  } catch {
    return dir;
  }
}

export function gitWorktreeRoot(cwd: string): string | null {
  const result = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  const dir = result.stdout.trim();
  if (!dir) return null;
  try {
    return realpathSync(dir);
  } catch {
    return dir;
  }
}
