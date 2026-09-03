export type CommandName =
  | "doctor"
  | "daemon"
  | "attach"
  | "launch-agent"
  | "hook"
  | "hooks"
  | "open"
  | "status"
  | "sync"
  | "open-in-orca"
  | "repair";

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

const COMMANDS = new Set<string>([
  "doctor",
  "daemon",
  "attach",
  "launch-agent",
  "hook",
  "hooks",
  "open",
  "status",
  "sync",
  "open-in-orca",
  "repair",
]);

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv[0] === "-h" || argv[0] === "--help") {
    return { kind: "help" };
  }
  if (argv.length === 0 || argv[0]?.startsWith("-")) {
    const rest = argv;
    if (rest.includes("-h") || rest.includes("--help")) return { kind: "help" };
    return { kind: "command", command: "open", json: rest.includes("--json"), help: false, rest };
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
  herdr-orca                          (Orca tab: create a Herdr shell and attach)
  herdr-orca --agent KIND [--]
  herdr-orca --terminal ID
  herdr-orca doctor [--json]
  herdr-orca attach --terminal ID
  herdr-orca open-in-orca
  herdr-orca status
  herdr-orca sync
  herdr-orca repair
  herdr-orca hooks install|uninstall|status [--json]
  herdr-orca daemon ensure|stop|uninstall
  herdr-orca daemon --foreground [--adopt]

Commands:
  (none)         In Orca, create a Herdr shell and attach
  doctor         Check floors
  attach         Attach this Orca PTY to a Herdr terminal
  open-in-orca   From a Herdr pane, open this terminal in Orca
  status         Same as doctor
  sync           One reconcile tick
  repair         Ensure the user service, then doctor
  hook           Agent hook entry
  hooks          Install plugin-owned agent hook entries
  daemon         User service (launchd / systemd)

Examples:
  herdr-orca
  herdr-orca --agent claude --
  herdr-orca doctor
  herdr-orca hooks install
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
Copies ORCA_* and HERDR_ORCA_SYNC=1 into the Herdr pane before attach.

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

export function hookHelp(): string {
  return `herdr-orca hook --event NAME

Called by agent user hooks. Reads JSON on stdin.

The hook prints nothing and exits 0 unless all of these are true:
  HERDR_ENV=1 and HERDR_SOCKET_PATH are set
  HERDR_ORCA_SYNC=1 (set at attach / launch-agent)
  ORCA_TAB_ID or ORCA_PANE_KEY is set

Options:
  --event NAME    Agent hook event (required)
  --help          Show this help

Examples:
  herdr-orca hook --event SessionStart
`;
}

export function hooksHelp(): string {
  return `herdr-orca hooks install|uninstall|status [--json]

Install plugin-owned hook entries in agent user configs.
Does not edit Orca-owned hook files.

Subcommands:
  install      Append herdr-orca hook entries
  uninstall    Remove only commands that call herdr-orca hook
  status       Show whether our entries are present

Options:
  --json    Print a machine-readable report
  --help    Show this help

Examples:
  herdr-orca hooks install
  herdr-orca hooks status --json
`;
}

export function flagValue(argv: string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) return null;
  return value;
}
