export const MIN_HERDR_PROTOCOL = 18;
export const MIN_ORCA_VERSION = "1.4.170";

export type ProtocolClass = "unsupported" | "supported";

export function classifyHerdrProtocol(protocol: number): ProtocolClass {
  return protocol < MIN_HERDR_PROTOCOL ? "unsupported" : "supported";
}

export type Triple = readonly [number, number, number];

export function parseDottedVersion(input: string): Triple | null {
  const match = input.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareTriple(left: Triple, right: Triple): number {
  for (let i = 0; i < 3; i += 1) {
    if (left[i] < right[i]) return -1;
    if (left[i] > right[i]) return 1;
  }
  return 0;
}

export function orcaVersionMeetsFloor(version: string): boolean {
  const parsed = parseDottedVersion(version);
  const floor = parseDottedVersion(MIN_ORCA_VERSION);
  if (!parsed || !floor) return false;
  return compareTriple(parsed, floor) >= 0;
}
