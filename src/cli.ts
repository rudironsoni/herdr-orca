export type CommandName = "doctor" | "daemon" | "attach" | "launch-agent";

export type ParsedArgs =
  | { kind: "help" }
  | { kind: "unknown"; command: string }
  | {
      kind: "command";
      command: CommandName;
      json: boolean;
      help: boolean;
      rest: string[];
    };

const COMMANDS = new Set<string>(["doctor", "daemon", "attach", "launch-agent"]);

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    return { kind: "help" };
  }
  const command = argv[0];
  if (!COMMANDS.has(command)) {
    return { kind: "unknown", command };
  }
  const rest = argv.slice(1);
  const help = rest.includes("-h") || rest.includes("--help");
  const json = rest.includes("--json");
  return { kind: "command", command: command as CommandName, json, help, rest };
}

export function rootHelp(): string {
  return `herdr-orca

Attach stock Orca tabs to Herdr-owned terminals.

Usage:
  herdr-orca --help
  herdr-orca doctor [--json]
  herdr-orca attach --terminal ID
  herdr-orca launch-agent [--agent KIND] [--]
  herdr-orca daemon ensure
  herdr-orca daemon --foreground [--adopt]

Commands:
  doctor         Check Node, Herdr protocol floors, and Orca version
  attach         Attach this Orca PTY to a Herdr terminal
  launch-agent   Create a Herdr terminal from this Orca tab, then attach
  daemon         User service

Examples:
  herdr-orca doctor
  herdr-orca attach --terminal term_abc
  herdr-orca launch-agent --agent claude --
`;
}

export function doctorHelp(): string {
  return `herdr-orca doctor

Check that this machine meets the sync floors.

Options:
  --json    Print a machine-readable report
  --help    Show this help

Floors:
  Herdr protocol 18 or newer
  Orca 1.4.170 or newer

Examples:
  herdr-orca doctor
  herdr-orca doctor --json
`;
}

export function attachHelp(): string {
  return `herdr-orca attach --terminal ID

Attach this Orca terminal to a Herdr-owned PTY. Closing Orca detaches.
The Herdr process keeps running.

Options:
  --terminal ID    Herdr terminal_id (required)
  --help           Show this help

Examples:
  herdr-orca attach --terminal term_65a7d78ef8fcb35
`;
}

export function launchAgentHelp(): string {
  return `herdr-orca launch-agent [--agent KIND] [-- AGENT_ARGS...]

Create a Herdr tab for this Orca PTY, inject ORCA_* env, then attach.
Closing Orca detaches. The Herdr process keeps running.

Options:
  --agent KIND     Optional Herdr agent kind (claude, codex, grok, ...)
  --session NAME   Herdr session name
  --help           Show this help

Examples:
  herdr-orca launch-agent
  herdr-orca launch-agent --agent claude --
`;
}

export function flagValue(argv: string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) return null;
  return value;
}
