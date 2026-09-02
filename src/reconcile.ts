export type HerdrTerminal = {
  terminalId: string;
  paneId: string;
  tabId: string;
  title: string;
  pluginOwned: boolean;
};

export type OrcaLeaf = {
  tabId: string;
  paneKey: string;
  title: string;
  command: string;
};

export type Surface = {
  herdrTerminalId: string | null;
  orcaTabId: string | null;
  orcaPaneKey: string | null;
  title: string | null;
};

export type Mutation = {
  id: string;
  field: "title" | "create_orca" | "close_orca" | "close_herdr";
  target: string;
  expectedValue: string;
  source: "herdr" | "orca";
};

export type World = {
  herdr: HerdrTerminal[];
  orca: OrcaLeaf[];
  orcaReachable: boolean;
  mappings: Surface[];
  mutations: Mutation[];
  orcaClose: "detach" | "terminate";
};

export type Op =
  | { type: "ack"; mutationId: string }
  | { type: "create_orca_attach"; herdrTerminalId: string; title: string }
  | { type: "replace_orca_pty"; orcaTabId: string; orcaPaneKey: string; title: string }
  | { type: "close_orca"; orcaTabId: string }
  | { type: "close_herdr"; herdrTerminalId: string }
  | { type: "rename_herdr"; herdrTabId: string; title: string }
  | { type: "rename_orca"; orcaTabId: string; title: string }
  | { type: "map"; herdrTerminalId: string; orcaTabId: string; orcaPaneKey: string };

export type Plan = { ops: Op[] };

function mappedByHerdr(world: World, terminalId: string): Surface | undefined {
  return world.mappings.find((row) => row.herdrTerminalId === terminalId);
}

function mappedByOrca(world: World, tabId: string, paneKey: string): Surface | undefined {
  return world.mappings.find((row) => row.orcaTabId === tabId && row.orcaPaneKey === paneKey);
}

function isAttachCommand(command: string): boolean {
  return command.includes("herdr-orca attach");
}

function pendingCreate(world: World, target: string): Mutation | undefined {
  return world.mutations.find((row) => row.field === "create_orca" && row.target === target);
}

export function reconcile(world: World): Plan {
  const ops: Op[] = [];
  const seenHerdr = new Set<string>();

  for (const mutation of world.mutations) {
    if (mutation.field === "title") {
      const herdr = world.herdr.find((row) => row.tabId === mutation.target || row.terminalId === mutation.target);
      const orca = world.orca.find((row) => row.tabId === mutation.target);
      const actual = herdr?.title ?? orca?.title;
      if (actual === mutation.expectedValue) {
        ops.push({ type: "ack", mutationId: mutation.id });
      }
    }
  }

  if (!world.orcaReachable) {
    return { ops };
  }

  for (const terminal of world.herdr) {
    if (terminal.pluginOwned) continue;
    if (seenHerdr.has(terminal.terminalId)) continue;
    seenHerdr.add(terminal.terminalId);
    const mapped = mappedByHerdr(world, terminal.terminalId);
    if (mapped?.orcaTabId) continue;
    if (pendingCreate(world, terminal.terminalId)) continue;
    ops.push({
      type: "create_orca_attach",
      herdrTerminalId: terminal.terminalId,
      title: terminal.title,
    });
  }

  for (const leaf of world.orca) {
    const mapped = mappedByOrca(world, leaf.tabId, leaf.paneKey);
    if (mapped?.herdrTerminalId) continue;
    if (isAttachCommand(leaf.command)) continue;
    ops.push({
      type: "replace_orca_pty",
      orcaTabId: leaf.tabId,
      orcaPaneKey: leaf.paneKey,
      title: leaf.title,
    });
  }

  for (const mapping of world.mappings) {
    if (!mapping.herdrTerminalId || !mapping.orcaTabId) continue;
    const herdr = world.herdr.find((row) => row.terminalId === mapping.herdrTerminalId);
    const orca = world.orca.find(
      (row) => row.tabId === mapping.orcaTabId && row.paneKey === mapping.orcaPaneKey,
    );
    if (!herdr && orca) {
      ops.push({ type: "close_orca", orcaTabId: mapping.orcaTabId });
    }
    if (herdr && !orca && world.orcaClose === "terminate") {
      ops.push({ type: "close_herdr", herdrTerminalId: mapping.herdrTerminalId });
    }
    if (herdr && orca && herdr.title !== orca.title) {
      const pending = world.mutations.find((row) => row.field === "title" && row.expectedValue === herdr.title);
      if (!pending) {
        ops.push({ type: "rename_orca", orcaTabId: orca.tabId, title: herdr.title });
      }
    }
  }

  return { ops };
}

export function applyOps(world: World, ops: Op[]): World {
  const next: World = {
    ...world,
    herdr: [...world.herdr],
    orca: [...world.orca],
    mappings: world.mappings.map((row) => ({ ...row })),
    mutations: world.mutations.filter((row) => !ops.some((op) => op.type === "ack" && op.mutationId === row.id)),
  };

  for (const op of ops) {
    if (op.type === "create_orca_attach") {
      const tabId = `orca-${op.herdrTerminalId}`;
      const paneKey = `${tabId}:leaf`;
      next.orca.push({
        tabId,
        paneKey,
        title: op.title,
        command: `herdr-orca attach --terminal ${op.herdrTerminalId}`,
      });
      next.mappings.push({
        herdrTerminalId: op.herdrTerminalId,
        orcaTabId: tabId,
        orcaPaneKey: paneKey,
        title: op.title,
      });
      next.mutations.push({
        id: `mut-create-${op.herdrTerminalId}`,
        field: "create_orca",
        target: op.herdrTerminalId,
        expectedValue: tabId,
        source: "herdr",
      });
    }
    if (op.type === "replace_orca_pty") {
      const terminalId = `term-from-${op.orcaTabId}`;
      next.herdr.push({
        terminalId,
        paneId: `p-${terminalId}`,
        tabId: `t-${terminalId}`,
        title: op.title,
        pluginOwned: false,
      });
      next.orca = next.orca.map((leaf) =>
        leaf.tabId === op.orcaTabId
          ? { ...leaf, command: `herdr-orca attach --terminal ${terminalId}` }
          : leaf,
      );
      next.mappings.push({
        herdrTerminalId: terminalId,
        orcaTabId: op.orcaTabId,
        orcaPaneKey: op.orcaPaneKey,
        title: op.title,
      });
    }
    if (op.type === "close_orca") {
      next.orca = next.orca.filter((leaf) => leaf.tabId !== op.orcaTabId);
      next.mappings = next.mappings.map((row) =>
        row.orcaTabId === op.orcaTabId ? { ...row, orcaTabId: null, orcaPaneKey: null } : row,
      );
    }
    if (op.type === "close_herdr") {
      next.herdr = next.herdr.filter((row) => row.terminalId !== op.herdrTerminalId);
    }
    if (op.type === "rename_orca") {
      next.orca = next.orca.map((leaf) => (leaf.tabId === op.orcaTabId ? { ...leaf, title: op.title } : leaf));
      next.mutations.push({
        id: `mut-title-${op.orcaTabId}`,
        field: "title",
        target: op.orcaTabId,
        expectedValue: op.title,
        source: "herdr",
      });
    }
    if (op.type === "map") {
      next.mappings.push({
        herdrTerminalId: op.herdrTerminalId,
        orcaTabId: op.orcaTabId,
        orcaPaneKey: op.orcaPaneKey,
        title: null,
      });
    }
  }

  return next;
}
