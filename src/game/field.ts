import type { Item } from "@/game/rpg";
import { useRpg } from "@/game/rpg";
import { partyMates } from "@/game/target";

export type MobSnap = { id: string; hp: number; alive: boolean; anger: boolean; x: number; z: number };
export type Loot = { id: string; item: Item; x: number; z: number };

let selfId = "";
let peers: string[] = [];
let mobs: MobSnap[] = [];
let loot: Loot[] = [];
const seen = new Set<string>();
let sender: ((data: unknown, peerId?: string) => void) | null = null;
const listeners = new Set<() => void>();
let pending: Item[] = [];
const remoteHits: { id: string; dmg: number; from: string }[] = [];
let lootHintText = "";

function publish() {
  for (const fn of listeners) fn();
}

export function subscribeField(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function bindField(fn: (data: unknown, peerId?: string) => void) {
  sender = fn;
  return () => {
    if (sender === fn) sender = null;
  };
}

export function setRoster(self: string, ids: string[]) {
  selfId = self;
  peers = ids;
}

export function amHost() {
  const all = [selfId, ...peers].filter(Boolean).sort();
  if (!all.length) return true;
  return all[0] === selfId;
}

export function fieldMobs() {
  return mobs;
}

export function fieldLoot() {
  return loot;
}

export function pushMobState(list: MobSnap[]) {
  mobs = list;
  sender?.({ kind: "mobs", mobs: list });
}

export function emitHit(id: string, dmg: number) {
  const hitId = `${id}:${Math.random().toString(36).slice(2, 8)}`;
  seen.add(hitId);
  sender?.({ kind: "mobhit", id, dmg, hitId });
}

export function queueGroundDrop(item: Item) {
  pending.push(item);
}

export function takePendingDrops() {
  const next = pending;
  pending = [];
  return next;
}

export function placeLoot(item: Item, x: number, z: number, id = `loot-${Math.random().toString(36).slice(2, 8)}`) {
  const row: Loot = { id, item, x, z };
  loot = [...loot, row].slice(-24);
  sender?.({ kind: "drop", id, item, x, z });
  publish();
  return row;
}

export function takeRemoteHits() {
  const next = remoteHits.slice();
  remoteHits.length = 0;
  return next;
}

export function sendReward(peerId: string, xp: number, gold: number) {
  sender?.({ kind: "reward", xp, gold }, peerId);
}

export function lootHint() {
  return lootHintText;
}

export function setLootHint(next: string) {
  if (lootHintText === next) return;
  lootHintText = next;
  publish();
}

export function takeNearLoot(x: number, z: number): Item | null {
  const row = loot.find((entry) => Math.hypot(entry.x - x, entry.z - z) < 1.35);
  if (!row) return null;
  return takeLoot(row.id);
}

export function takeLoot(id: string): Item | null {
  const row = loot.find((entry) => entry.id === id);
  if (!row) return null;
  loot = loot.filter((entry) => entry.id !== id);
  sender?.({ kind: "take", id });
  publish();
  return row.item;
}

export function shareXp(total: number) {
  const mates = partyMates();
  if (!mates.length) {
    useRpg.getState().grantXp(total);
    return;
  }
  const pool = Math.round(total * 0.4);
  const mine = Math.max(1, total - pool);
  const each = Math.max(1, Math.round(pool / mates.length));
  useRpg.getState().grantXp(mine);
  const nick = useRpg.getState().nick;
  for (const mate of mates) {
    sender?.({ kind: "xp", amount: each, nick, to: mate.id }, mate.id);
  }
}

function asItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Item;
  if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.uid !== "string") return null;
  return row;
}

export function ingestField(from: string, data: unknown) {
  if (!data || typeof data !== "object") return false;
  const row = data as Record<string, unknown>;
  if (row.kind === "mobs" && Array.isArray(row.mobs)) {
    if (amHost()) return true;
    const hostId = [selfId, ...peers].filter(Boolean).sort()[0];
    if (hostId && from !== hostId) return true;
    mobs = (row.mobs as MobSnap[]).filter((mob) => mob && typeof mob.id === "string");
    return true;
  }
  if (row.kind === "mobhit") {
    const hitId = typeof row.hitId === "string" ? row.hitId : "";
    if (hitId && seen.has(hitId)) return true;
    if (hitId) seen.add(hitId);
    const id = typeof row.id === "string" ? row.id : "";
    const dmg = Math.max(1, Math.min(400, Math.floor(Number(row.dmg) || 1)));
    if (id) remoteHits.push({ id, dmg, from });
    return true;
  }
  if (row.kind === "drop") {
    const item = asItem(row.item);
    const id = typeof row.id === "string" ? row.id : "";
    if (!item || !id || loot.some((entry) => entry.id === id)) return true;
    loot = [...loot, { id, item, x: Number(row.x) || 0, z: Number(row.z) || 0 }].slice(-24);
    publish();
    return true;
  }
  if (row.kind === "take") {
    const id = typeof row.id === "string" ? row.id : "";
    loot = loot.filter((entry) => entry.id !== id);
    publish();
    return true;
  }
  if (row.kind === "reward") {
    const xp = Math.max(1, Math.min(400, Math.floor(Number(row.xp) || 1)));
    const gold = Math.max(0, Math.min(500, Math.floor(Number(row.gold) || 0)));
    shareXp(xp);
    if (gold) useRpg.getState().addGold(gold);
    useRpg.setState({ toast: `+${xp} XP${gold ? ` +${gold}g` : ""}` });
    return true;
  }
  if (row.kind === "xp") {
    const nick = typeof row.nick === "string" ? row.nick : "";
    const amount = Math.max(1, Math.min(200, Math.floor(Number(row.amount) || 1)));
    const nickKey = nick.toLowerCase();
    const mate = partyMates().some((entry) => entry.id === from || entry.nick.toLowerCase() === nickKey);
    if (mate) {
      useRpg.getState().grantXp(amount);
      useRpg.setState({ toast: `${nick || "Grup"} +${amount} XP` });
    }
    return true;
  }
  return false;
}
