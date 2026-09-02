import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = (process.env.PLUGIN_VERSION || pkg.version).replace(/^v/, "");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });
const zipName = `herdr-orca-${version}-plugin.zip`;
const zipPath = join(dist, zipName);
const tmpZip = join(tmpdir(), zipName);

const files = [
  "src",
  "dist/herdr-orca.mjs",
  "herdr-plugin.toml",
  "package.json",
  "pnpm-lock.yaml",
  "LICENSE",
  "README.md",
  "CONTEXT.md",
  "AGENTS.md",
  "CHANGELOG.md",
];

const result = spawnSync("zip", ["-r", tmpZip, ...files, "-x", "node_modules/*"], {
  cwd: root,
  stdio: "inherit",
});
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
copyFileSync(tmpZip, zipPath);
console.log(zipPath);
