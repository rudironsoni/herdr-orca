import { spawnSync } from "node:child_process";

export type RunResult = { status: number | null; stdout: string; stderr: string };
export type Runner = (argv: string[]) => RunResult;

export const defaultRunner: Runner = (argv) => {
  const [cmd, ...args] = argv;
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

export function parseJson(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function readString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function walkStrings(value: unknown, keys: string[]): Record<string, string> {
  const found: Record<string, string> = {};
  const visit = (node: unknown): void => {
    const rec = asRecord(node);
    if (!rec) {
      if (Array.isArray(node)) node.forEach(visit);
      return;
    }
    for (const key of keys) {
      if (found[key]) continue;
      const item = rec[key];
      if (typeof item === "string" && item.length > 0) found[key] = item;
    }
    for (const nested of Object.values(rec)) visit(nested);
  };
  visit(value);
  return found;
}

export function which(name: string): string | null {
  const result = spawnSync("which", [name], { encoding: "utf8" });
  const found = result.stdout.trim();
  return result.status === 0 && found.length > 0 ? found : null;
}
