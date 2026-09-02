import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });

const launcher = `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", join(distDir, "../src/main.ts"), ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
`;

const out = join(dist, "herdr-orca.mjs");
writeFileSync(out, launcher);
chmodSync(out, 0o755);
console.log(out);
