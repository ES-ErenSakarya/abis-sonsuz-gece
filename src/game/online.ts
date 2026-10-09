export type BodyState = {
  nick: string;
  level: number;
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  run: number;
  swing: number;
  weapon: boolean;
  style: "fist" | "sword" | "bow" | "staff" | "dagger" | "pala" | "kazma" | "olta";
  helmet: boolean;
  armor: boolean;
  boots: boolean;
  hp: number;
  hpMax: number;
  side: number;
};

export const presence: BodyState = {
  nick: "",
  level: 1,
  x: 0,
  z: 0,
  yaw: 0,
  moving: false,
  run: 0,
  swing: 0,
  weapon: false,
  style: "fist",
  helmet: false,
  armor: false,
  boots: false,
  hp: 120,
  hpMax: 120,
  side: 1,
};

export type RemoteBody = BodyState & {
  tx: number;
  tz: number;
  tyaw: number;
};

export const remotes = new Map<string, RemoteBody>();

const listeners = new Set<() => void>();
let peerCount = 0;
let link: "off" | "live" | "wait" = "off";
let snap: { peers: number; link: "off" | "live" | "wait" } = { peers: 0, link: "off" };

export function subscribeOnline(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function poke() {
  for (const fn of listeners) fn();
}

export function onlineSnapshot() {
  return snap;
}

export function setLink(next: "off" | "live" | "wait", peers: number) {
  if (link === next && peerCount === peers) return;
  link = next;
  peerCount = peers;
  snap = { peers, link: next };
  poke();
}

export function upsertRemote(id: string, body: BodyState) {
  const prev = remotes.get(id);
  if (!prev) {
    remotes.set(id, { ...body, tx: body.x, tz: body.z, tyaw: body.yaw });
    return;
  }
  prev.tx = body.x;
  prev.tz = body.z;
  prev.tyaw = body.yaw;
  prev.nick = body.nick;
  prev.level = body.level;
  prev.moving = body.moving;
  prev.run = body.run;
  prev.swing = body.swing;
  prev.weapon = body.weapon;
  prev.style = body.style;
  prev.helmet = body.helmet;
  prev.armor = body.armor;
  prev.boots = body.boots;
  prev.hp = body.hp;
  prev.hpMax = body.hpMax;
  prev.side = body.side;
}

export function retainRemotes(ids: Set<string>) {
  for (const id of [...remotes.keys()]) {
    if (!ids.has(id)) remotes.delete(id);
  }
}

export function clearRemotes() {
  remotes.clear();
}

function num(data: Record<string, unknown>, key: string, fallback = 0) {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseBody(data: unknown): BodyState | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.kind !== "body") return null;
  const x = num(row, "x");
  const z = num(row, "z");
  if (Math.abs(x) > 200 || Math.abs(z) > 200) return null;
  const nick = typeof row.nick === "string" ? row.nick.replace(/\s+/g, " ").slice(0, 16) : "Gezgin";
  return {
    nick: nick || "Gezgin",
    level: Math.max(1, Math.min(200, Math.floor(num(row, "level", 1)))),
    x,
    z,
    yaw: num(row, "yaw"),
    moving: Boolean(row.moving),
    run: Math.max(0, Math.min(1, num(row, "run"))),
    swing: Math.max(0, Math.min(1, num(row, "swing"))),
    weapon: Boolean(row.weapon),
    style: row.style === "bow" || row.style === "staff" || row.style === "dagger" || row.style === "sword" || row.style === "pala" || row.style === "fist" || row.style === "kazma" || row.style === "olta"
      ? row.style
      : Boolean(row.weapon)
        ? "sword"
        : "fist",
    helmet: Boolean(row.helmet),
    armor: Boolean(row.armor),
    boots: Boolean(row.boots),
    hp: Math.max(0, num(row, "hp", 120)),
    hpMax: Math.max(1, num(row, "hpMax", 120)),
    side: num(row, "side", 1) < 0 ? -1 : 1,
  };
}
