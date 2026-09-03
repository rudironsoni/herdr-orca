import { readFileSync } from "node:fs";
import { runHook, type RunHookOpts } from "../hooks.ts";
import { flagValue } from "../cli.ts";

export function readHookStdin(): string {
  if (process.stdin.isTTY) return "";
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

export async function runHookCommand(opts: {
  rest: string[];
  env?: NodeJS.ProcessEnv;
  stdin?: string;
  run?: typeof runHook;
} & Partial<Pick<RunHookOpts, "post" | "readFile" | "home" | "platform">>): Promise<number> {
  const event = flagValue(opts.rest, "--event");
  if (!event) return 2;
  const result = await (opts.run ?? runHook)({
    env: opts.env ?? process.env,
    event,
    stdin: opts.stdin ?? readHookStdin(),
    home: opts.home,
    platform: opts.platform,
    post: opts.post,
    readFile: opts.readFile,
  });
  return result.code;
}
