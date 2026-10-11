import type { Item } from "@/game/rpg";
import { bagRoom, tryReceiveItem, useRpg } from "@/game/rpg";
import { partyMates } from "@/game/target";

export type MobSnap = { id: string; hp: number; alive: boolean; anger: boolean; x: number; z: number };
export type Loot = { id: string; items: Item[]; x: number; z: number };

export type MarketListing = { uid: string; price: number; item: Item };
export type MarketBoard = { id: string; nick: string; x: number; z: number; items: MarketListing[] };

let selfId = "";
let peers: string[] = [];
let mobs: MobSnap[] = [];
let loot: Loot[] = [];
let markets: MarketBoard[] = [];
const seen = new Set<string>();
let sender: ((data: unknown, peerId?: string) => void) | null = null;
const listeners = new Set<() => void>();
let pending: Item[] = [];
const remoteHits: { id: string; dmg: number; from: string }[] = [];
let lootHintText = "";
let chestId = "";
let stallId = "";
let rev = 0;
const pendingBuys = new Map<string, number>();

function publish() {
  rev += 1;
  for (const fn of listeners) fn();
}

export function fieldRev() {
  return rev;
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

export function marketBoards() {
  return markets;
}

export function broadcastStall() {
  const s = useRpg.getState();
  const open = Array.isArray(s.stall) && Boolean(s.stallSpot);
  sender?.({
    kind: "stall",
    nick: s.nick,
    x: open && s.stallSpot ? s.stallSpot.x : 0,
    z: open && s.stallSpot ? s.stallSpot.z : 0,
    open,
    items: open && s.stall
      ? s.stall.map((row) => ({
          uid: row.uid,
          price: row.price,
          name: row.item?.name || "Eşya",
          item: row.item,
        }))
      : [],
  });
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

export function placeChest(items: Item[], x: number, z: number, id = `loot-${Math.random().toString(36).slice(2, 8)}`) {
  const pack = items.filter(Boolean);
  if (!pack.length) return null;
  const row: Loot = { id, items: pack, x, z };
  loot = [...loot, row].slice(-24);
  sender?.({ kind: "drop", id, items: pack, item: pack[0], x, z });
  publish();
  return row;
}

export function placeLoot(item: Item, x: number, z: number, id = `loot-${Math.random().toString(36).slice(2, 8)}`) {
  return placeChest([item], x, z, id);
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

export function openNearChest(x: number, z: number) {
  let best: Loot | null = null;
  let bestD = 1.7;
  for (const entry of loot) {
    const d = Math.hypot(entry.x - x, entry.z - z);
    if (d < bestD) {
      bestD = d;
      best = entry;
    }
  }
  if (!best) return false;
  chestId = best.id;
  publish();
  return true;
}

export function openChest(id: string) {
  if (!loot.some((entry) => entry.id === id)) return;
  chestId = id;
  publish();
}

export function closeChest() {
  if (!chestId) return;
  chestId = "";
  publish();
}

export function chestView(): Loot | null {
  if (!chestId) return null;
  return loot.find((entry) => entry.id === chestId) ?? null;
}

export function takeChestItem(index: number) {
  const row = loot.find((entry) => entry.id === chestId);
  if (!row) return;
  const item = row.items[index];
  if (!item) return;
  if (!tryReceiveItem(item)) return;
  const items = row.items.filter((_, i) => i !== index);
  if (!items.length) {
    loot = loot.filter((entry) => entry.id !== row.id);
    chestId = "";
    sender?.({ kind: "take", id: row.id });
  } else {
    loot = loot.map((entry) => (entry.id === row.id ? { ...entry, items } : entry));
    sender?.({ kind: "chest", id: row.id, items });
  }
  publish();
}

export function takeNearLoot(x: number, z: number): Item | null {
  if (!openNearChest(x, z)) return null;
  return null;
}

export function takeLoot(id: string): Item | null {
  const row = loot.find((entry) => entry.id === id);
  if (!row) return null;
  loot = loot.filter((entry) => entry.id !== id);
  if (chestId === id) chestId = "";
  sender?.({ kind: "take", id });
  publish();
  return row.items[0] ?? null;
}

export function openStallView(id: string) {
  stallId = id;
  publish();
}

export function closeStallView() {
  if (!stallId) return;
  stallId = "";
  publish();
}

export function stallViewId() {
  return stallId;
}

export function askStallBuy(peerId: string, uid: string, price: number, item?: Item | null) {
  const cost = Math.max(1, Math.floor(price));
  if (!peerId || !uid || pendingBuys.has(uid)) return;
  if (!bagRoom(item)) {
    useRpg.setState({ toast: "Envanterinde yer yok" });
    return;
  }
  const state = useRpg.getState();
  if (state.gold < cost) {
    useRpg.setState({ toast: "Yetersiz altın" });
    return;
  }
  useRpg.setState({ gold: state.gold - cost });
  pendingBuys.set(uid, cost);
  sender?.({ kind: "stallbuy", uid, price: cost }, peerId);
}

function refundBuy(uid: string, note: string) {
  const cost = pendingBuys.get(uid);
  if (cost == null) return;
  pendingBuys.delete(uid);
  useRpg.setState({ gold: useRpg.getState().gold + cost, toast: note });
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
  if (row.kind === "stall") {
    const id = from;
    const open = Boolean(row.open);
    markets = markets.filter((board) => board.id !== id);
    if (open) {
      const items = Array.isArray(row.items)
        ? row.items
            .filter((item) => item && typeof item === "object")
            .map((item) => {
              const rowItem = item as { uid?: unknown; name?: unknown; price?: unknown; item?: unknown };
              const packed = asItem(rowItem.item);
              if (!packed) return null;
              return {
                uid: typeof rowItem.uid === "string" ? rowItem.uid : packed.uid,
                price: Math.max(1, Math.floor(Number(rowItem.price) || 1)),
                item: packed,
              };
            })
            .filter((item): item is MarketListing => Boolean(item))
        : [];
      markets = [
        ...markets,
        {
          id,
          nick: typeof row.nick === "string" ? row.nick : "Oyuncu",
          x: Number(row.x) || 0,
          z: Number(row.z) || 0,
          items,
        },
      ];
    }
    publish();
    return true;
  }
  if (row.kind === "drop") {
    const listed = Array.isArray(row.items) ? row.items.map((item) => asItem(item)).filter((item): item is Item => Boolean(item)) : [];
    const single = asItem(row.item);
    const items = listed.length ? listed : single ? [single] : [];
    const id = typeof row.id === "string" ? row.id : "";
    if (!items.length || !id || loot.some((entry) => entry.id === id)) return true;
    loot = [...loot, { id, items, x: Number(row.x) || 0, z: Number(row.z) || 0 }].slice(-24);
    publish();
    return true;
  }
  if (row.kind === "chest") {
    const id = typeof row.id === "string" ? row.id : "";
    const items = Array.isArray(row.items) ? row.items.map((item) => asItem(item)).filter((item): item is Item => Boolean(item)) : [];
    if (!id) return true;
    if (!items.length) {
      loot = loot.filter((entry) => entry.id !== id);
      if (chestId === id) chestId = "";
    } else {
      loot = loot.map((entry) => (entry.id === id ? { ...entry, items } : entry));
    }
    publish();
    return true;
  }
  if (row.kind === "stallbuy") {
    const uid = typeof row.uid === "string" ? row.uid : "";
    const price = Math.max(1, Math.floor(Number(row.price) || 0));
    const sold = uid ? useRpg.getState().fulfillStall(uid, price) : null;
    if (!sold) sender?.({ kind: "stalldeny", uid }, from);
    else sender?.({ kind: "stallgrant", uid, item: sold.item, price: sold.price }, from);
    return true;
  }
  if (row.kind === "stalldeny") {
    refundBuy(typeof row.uid === "string" ? row.uid : "", "Eşya kalktı, altın iade");
    publish();
    return true;
  }
  if (row.kind === "stallgrant") {
    const uid = typeof row.uid === "string" ? row.uid : "";
    const item = asItem(row.item);
    if (uid) pendingBuys.delete(uid);
    if (item) {
      if (!tryReceiveItem(item)) {
        const price = Math.max(0, Math.floor(Number(row.price) || 0));
        useRpg.setState({ gold: useRpg.getState().gold + price, toast: "Envanterinde yer yok" });
        sender?.({ kind: "stallreturn", uid, item, price }, from);
      } else useRpg.setState({ toast: `${item.name} satın alındı` });
    }
    publish();
    return true;
  }
  if (row.kind === "stallreturn") {
    const item = asItem(row.item);
    const price = Math.max(0, Math.floor(Number(row.price) || 0));
    const uid = typeof row.uid === "string" ? row.uid : item?.uid || "";
    if (item && uid) useRpg.getState().restoreStall(uid, item, price);
    publish();
    return true;
  }
  if (row.kind === "take") {
    const id = typeof row.id === "string" ? row.id : "";
    loot = loot.filter((entry) => entry.id !== id);
    if (chestId === id) chestId = "";
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
