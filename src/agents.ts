export function herdrKindForOrcaAgent(orcaId: string): string | null {
  switch (orcaId) {
    case "claude":
    case "claude-agent-teams":
      return "claude";
    case "github-copilot":
      return "copilot";
    case "antigravity":
    case "agy":
      return "agy";
    case "codex":
    case "grok":
    case "opencode":
    case "pi":
    case "omp":
    case "cursor":
    case "hermes":
    case "copilot":
      return orcaId;
    default:
      return null;
  }
}

export function agentName(kind: string, paneId: string): string {
  const slug = paneId.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase() || "pane";
  return `${kind}-${slug}`.slice(0, 32);
}
