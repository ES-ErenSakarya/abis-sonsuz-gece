import { useRpg, type Item } from "@/game/rpg";
import { readSim } from "@/game/input";
import { onPlaza } from "@/game/world";
import { remotes } from "@/game/online";
import { queueGroundDrop } from "@/game/field";

export type Sel =
  | { kind: "mob"; id: string; name: string }
  | { kind: "meteor"; id: string; name: string; level: number }
  | { kind: "player"; id: string; nick: string; level: number };

export type DuelPhase = "idle" | "sent" | "in" | "live";

export type Duel = { phase: DuelPhase; id: string; nick: string; level: number };

export type SocialAct = "trade" | "friend" | "party";

export type Social = { phase: DuelPhase; act: SocialAct | ""; id: string; nick: string };

export type Mate = { id: string; nick: string; level: number };

export type MobCard = { name: string; hp: number; hpMax: number; level: number; drops: string[] } | null;

type Snap = { sel: Sel | null; duel: Duel; social: Social; friends: Mate[]; party: Mate[]; trade: TradeBoard; card: MobCard };

export type TradeBoard = { mine: Item[]; theirs: Item[]; mineGold: number; theirGold: number; mineOk: boolean; theirsOk: boolean };

const idleDuel: Duel = { phase: "idle", id: "", nick: "", level: 0 };
const idleSocial: Social = { phase: "idle", act: "", id: "", nick: "" };
const emptyBoard = (): TradeBoard => ({ mine: [], theirs: [], mineGold: 0, theirGold: 0, mineOk: false, theirsOk: false });
let sel: Sel | null = null;
let duel: Duel = idleDuel;
let social: Social = idleSocial;
let friends: Mate[] = [];
let party: Mate[] = [];
let board: TradeBoard = emptyBoard();
let card: MobCard = null;
let pick: { x: number; y: number } | null = null;
let snap: Snap = { sel, duel, social, friends, party, trade: board, card };
const listeners = new Set<() => void>();
let sender: ((peerId: string, data: unknown) => void) | null = null;

function publish() {
  snap = { sel, duel, social, friends, party, trade: board, card };
  for (const fn of listeners) fn();
}

export function setMobCard(next: MobCard) {
  const same =
    (!next && !card) ||
    (!!next &&
      !!card &&
      next.name === card.name &&
      next.level === card.level &&
      Math.ceil(next.hp) === Math.ceil(card.hp) &&
      Math.ceil(next.hpMax) === Math.ceil(card.hpMax));
  if (same) return;
  card = next;
  publish();
}

export function subscribeTarget(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function targetSnapshot() {
  return snap;
}

export function readTarget() {
  return { sel, duel, social };
}

export function queuePick(x: number, y: number) {
  pick = { x, y };
}

export function takePick() {
  const next = pick;
  pick = null;
  return next;
}

export function setSelection(next: Sel | null) {
  if (!next) {
    if (!sel) return;
    sel = null;
    publish();
    return;
  }
  if (sel && sel.kind === next.kind && sel.id === next.id) {
    if (sel.kind === "player" && next.kind === "player" && (sel.nick !== next.nick || sel.level !== next.level)) {
      sel = next;
      publish();
    }
    return;
  }
  sel = next;
  publish();
}

export function bindDuelSend(fn: (peerId: string, data: unknown) => void) {
  sender = fn;
  return () => {
    if (sender === fn) sender = null;
  };
}

function packet(act: string, nick: string, level: number, extra?: Record<string, unknown>) {
  return { kind: "duel", act, nick, level, ...extra };
}

export function offerDuel(nick: string, level: number) {
  if (!sel || sel.kind !== "player") return;
  if (duel.phase === "live" || duel.phase === "sent") return;
  const here = readSim();
  const foe = remotes.get(sel.id);
  if (onPlaza(here.x, here.z) || (foe && onPlaza(foe.x, foe.z))) {
    useRpg.setState({ toast: "Taş meydanda düello yok. Meydanın dışına çık." });
    return;
  }
  duel = { phase: "sent", id: sel.id, nick: sel.nick, level: sel.level };
  sender?.(sel.id, packet("ask", nick, level));
  useRpg.setState({ toast: `${sel.nick} için düello teklifi gitti` });
  publish();
}

export function answerDuel(yes: boolean, nick: string, level: number) {
  if (duel.phase !== "in") return;
  if (yes && onPlaza(readSim().x, readSim().z)) {
    useRpg.setState({ toast: "Taş meydanda düello yok. Meydanın dışına çık." });
    return;
  }
  sender?.(duel.id, packet(yes ? "yes" : "no", nick, level));
  if (yes) {
    duel = { ...duel, phase: "live" };
    sel = { kind: "player", id: duel.id, nick: duel.nick, level: duel.level };
    useRpg.setState({ toast: `VS · ${duel.nick}` });
  } else {
    duel = idleDuel;
    useRpg.setState({ toast: "Düello reddedildi" });
  }
  publish();
}

export function endDuel(nick: string, level: number) {
  if (duel.phase === "idle") return;
  if (duel.id) sender?.(duel.id, packet("end", nick, level));
  duel = idleDuel;
  useRpg.setState({ toast: "Düello bitti" });
  publish();
}

export function sendDuelHit(dmg: number, crit: boolean) {
  if (duel.phase !== "live" || !duel.id) return;
  const who = useRpg.getState();
  sender?.(duel.id, packet("hit", who.nick, who.level, { dmg, crit }));
}

function upsertMate(list: Mate[], mate: Mate) {
  if (!mate.nick) return list;
  const index = list.findIndex((row) => row.id === mate.id || row.nick === mate.nick);
  if (index >= 0) {
    const next = list.slice();
    next[index] = mate;
    return next;
  }
  return [...list, mate].slice(-8);
}

export function hydrateFriends(list: Mate[]) {
  friends = (list || []).filter((row) => row && row.id && row.nick).slice(0, 24);
  publish();
}

export function removeFriend(id: string) {
  friends = friends.filter((mate) => mate.id !== id);
  publish();
}

export function blockMate(mate: Mate) {
  friends = friends.filter((row) => row.id !== mate.id && row.nick !== mate.nick);
  party = party.filter((row) => row.id !== mate.id && row.nick !== mate.nick);
  const cur = useRpg.getState().blocked ?? [];
  const blocked = Array.from(new Set([...cur, mate.id, mate.nick.toLowerCase()]));
  useRpg.setState({ blocked, toast: `${mate.nick} engellendi` });
  if (social.id === mate.id) social = idleSocial;
  publish();
}

export function isBlocked(id: string, nick?: string) {
  const list = useRpg.getState().blocked ?? [];
  if (list.includes(id)) return true;
  return Boolean(nick && list.includes(nick.toLowerCase()));
}

export function partyMates() {
  return party;
}

export function friendMates() {
  return friends;
}

export function offerSocial(act: SocialAct) {
  if (!sel || sel.kind !== "player") return;
  if (social.phase === "sent" || social.phase === "live") return;
  const who = useRpg.getState();
  social = { phase: "sent", act, id: sel.id, nick: sel.nick };
  sender?.(sel.id, { kind: "social", act: "ask", what: act, nick: who.nick, level: who.level });
  const label = act === "trade" ? "Ticaret" : act === "friend" ? "Dostluk" : "Grup";
  useRpg.setState({ toast: `${sel.nick} için ${label.toLowerCase()} teklifi gitti` });
  publish();
}

export function answerSocial(yes: boolean) {
  if (social.phase !== "in" || !social.act) return;
  const who = useRpg.getState();
  sender?.(social.id, { kind: "social", act: yes ? "yes" : "no", what: social.act, nick: who.nick, level: who.level });
  if (!yes) {
    social = idleSocial;
    useRpg.setState({ toast: "Teklif reddedildi" });
    publish();
    return;
  }
  acceptSocial(social.act, social.nick, social.id, sel?.kind === "player" && sel.id === social.id ? sel.level : 1);
}

function acceptSocial(act: SocialAct, nick: string, id: string, level: number) {
  if (act === "trade") {
    social = { ...social, phase: "live", act, nick };
    board = emptyBoard();
    useRpg.setState({ toast: `Ticaret · ${nick}`, invOpen: true });
  } else if (act === "friend") {
    friends = upsertMate(friends, { id, nick, level });
    social = idleSocial;
    useRpg.setState({ toast: `${nick} artık dostun` });
  } else {
    party = upsertMate(party, { id, nick, level });
    social = idleSocial;
    useRpg.setState({ toast: `${nick} gruba katıldı` });
  }
  publish();
}

function giveBack(items: Item[], gold = 0) {
  const state = useRpg.getState();
  const bag = state.bag.slice();
  const leftover: Item[] = [];
  for (const item of items) {
    const hole = bag.findIndex((slot) => slot == null);
    if (hole >= 0) bag[hole] = item;
    else leftover.push(item);
  }
  useRpg.setState({ bag, gold: state.gold + Math.max(0, Math.floor(gold)) });
  if (leftover.length) leftover.forEach((item) => queueGroundDrop(item));
}

function tryCommit() {
  if (social.phase !== "live" || social.act !== "trade") return;
  if (!board.mineOk || !board.theirsOk) return;
  const got = board.theirs.slice();
  const gotGold = Math.max(0, Math.floor(board.theirGold || 0));
  board = emptyBoard();
  social = idleSocial;
  const state = useRpg.getState();
  const bag = state.bag.slice();
  const leftover: Item[] = [];
  for (const item of got) {
    const hole = bag.findIndex((slot) => slot == null);
    if (hole >= 0) bag[hole] = item;
    else leftover.push(item);
  }
  useRpg.setState({ bag, gold: state.gold + gotGold, toast: gotGold ? `Ticaret tamam · +${gotGold} altın` : "Ticaret tamam" });
  if (leftover.length) leftover.forEach((item) => queueGroundDrop(item));
  publish();
}

export function addTradeItem(index: number) {
  if (social.phase !== "live" || social.act !== "trade" || !social.id) return;
  const state = useRpg.getState();
  const item = state.bag[index];
  if (!item || item.id === "starter-chest") return;
  if (board.mine.length >= 8) {
    useRpg.setState({ toast: "Ticaret penceresi dolu" });
    return;
  }
  const bag = state.bag.slice();
  bag[index] = null;
  board = { mine: [...board.mine, item], theirs: board.theirs, mineGold: board.mineGold, theirGold: board.theirGold, mineOk: false, theirsOk: false };
  useRpg.setState({ bag });
  sender?.(social.id, { kind: "social", act: "offer", items: board.mine, gold: board.mineGold, nick: state.nick, level: state.level });
  publish();
}

export function offerTradeGold(amount: number) {
  if (social.phase !== "live" || social.act !== "trade" || !social.id) return;
  const want = Math.max(0, Math.floor(Number(amount) || 0));
  const state = useRpg.getState();
  const held = board.mineGold || 0;
  const pool = state.gold + held;
  if (want > pool) {
    useRpg.setState({ toast: "Yeterli altın yok" });
    return;
  }
  board = { ...board, mineGold: want, mineOk: false, theirsOk: false };
  useRpg.setState({ gold: pool - want });
  sender?.(social.id, { kind: "social", act: "offer", items: board.mine, gold: want, nick: state.nick, level: state.level });
  publish();
}

export function setTradeOk(yes: boolean) {
  if (social.phase !== "live" || social.act !== "trade" || !social.id) return;
  board = { ...board, mineOk: yes };
  sender?.(social.id, { kind: "social", act: "accept", yes, nick: useRpg.getState().nick, level: useRpg.getState().level });
  publish();
  tryCommit();
}

export function leaveParty() {
  const ids = party.map((mate) => mate.id);
  party = [];
  const who = useRpg.getState();
  for (const id of ids) sender?.(id, { kind: "social", act: "leave", what: "party", nick: who.nick, level: who.level });
  useRpg.setState({ toast: "Gruptan ayrıldın" });
  publish();
}

export function sendTradeItem(index: number) {
  addTradeItem(index);
}

export function closeTrade() {
  if (social.phase === "idle") return;
  if (social.act === "trade") giveBack(board.mine, board.mineGold);
  board = emptyBoard();
  if (social.id) sender?.(social.id, { kind: "social", act: "end", what: social.act, nick: "", level: 1 });
  social = idleSocial;
  publish();
}

function takeItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Item;
  if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.uid !== "string") return null;
  return row;
}

export function receivePacket(from: string, data: unknown) {
  if (!data || typeof data !== "object") return;
  const row = data as Record<string, unknown>;
  if (row.kind === "social") {
    receiveSocial(from, row);
    return;
  }
  if (row.kind === "duel") receiveDuel(from, data);
}

function receiveSocial(from: string, row: Record<string, unknown>) {
  const nick = typeof row.nick === "string" ? row.nick.replace(/\s+/g, " ").slice(0, 16) : "Oyuncu";
  const what = row.what === "trade" || row.what === "friend" || row.what === "party" ? row.what : social.act;
  if (row.act === "ask" && (what === "trade" || what === "friend" || what === "party")) {
    if (isBlocked(from, nick)) return;
    if (social.phase === "live") {
      sender?.(from, { kind: "social", act: "no", what, nick: "", level: 1 });
      return;
    }
    social = { phase: "in", act: what, id: from, nick: nick || "Oyuncu" };
    sel = { kind: "player", id: from, nick: social.nick, level: 1 };
    publish();
    return;
  }
  if (row.act === "yes" && social.phase === "sent" && social.id === from && what) {
    const level = Math.max(1, Math.min(200, Math.floor(Number(row.level) || 1)));
    acceptSocial(what, social.nick || nick, social.id, level);
    return;
  }
  if (row.act === "offer" && social.phase === "live" && social.id === from) {
    const items = Array.isArray(row.items) ? row.items.map((entry) => takeItem(entry)).filter((entry): entry is Item => entry != null) : [];
    const gold = Math.max(0, Math.floor(Number(row.gold) || 0));
    board = { ...board, theirs: items, theirGold: gold, mineOk: false, theirsOk: false };
    publish();
    return;
  }
  if (row.act === "accept" && social.phase === "live" && social.id === from) {
    board = { ...board, theirsOk: row.yes === true };
    publish();
    tryCommit();
    return;
  }
  if (row.act === "leave") {
    party = party.filter((mate) => mate.id !== from);
    useRpg.setState({ toast: `${nick} gruptan ayrıldı` });
    publish();
    return;
  }
  if (row.act === "give") {
    const item = takeItem(row.item);
    if (!item) return;
    const state = useRpg.getState();
    const bag = state.bag.slice();
    const hole = bag.findIndex((slot) => slot == null);
    if (hole < 0) {
      useRpg.setState({ toast: "Çanta dolu, eşya alınamadı" });
      return;
    }
    bag[hole] = item;
    useRpg.setState({ bag, toast: `${item.name} geldi` });
    return;
  }
  if ((row.act === "no" || row.act === "end") && social.id === from && social.phase !== "idle") {
    if (social.act === "trade") giveBack(board.mine, board.mineGold);
    board = emptyBoard();
    social = idleSocial;
    useRpg.setState({ toast: row.act === "no" ? "Teklif reddedildi" : "Ticaret kapandı" });
    publish();
  }
}

export function receiveDuel(from: string, data: unknown) {
  if (!data || typeof data !== "object") return;
  const row = data as Record<string, unknown>;
  if (row.kind !== "duel") return;
  const nick = typeof row.nick === "string" ? row.nick.replace(/\s+/g, " ").slice(0, 16) : "Oyuncu";
  const level = Math.max(1, Math.min(200, Math.floor(typeof row.level === "number" ? row.level : 1)));
  const act = row.act;
  if (act === "hit" && duel.phase === "live" && duel.id === from) {
    const dmg = Math.max(1, Math.min(400, Math.floor(typeof row.dmg === "number" ? row.dmg : 1)));
    const dead = useRpg.getState().hurtPlayer(dmg);
    useRpg.setState({ toast: dead ? "Düelloyu kaybettin" : `-${dmg}` });
    if (dead) {
      useRpg.setState({ hp: useRpg.getState().hpMax * 0.45, toast: "Düelloyu kaybettin" });
      const who = useRpg.getState();
      sender?.(from, packet("end", who.nick, who.level, { fallen: true }));
      duel = idleDuel;
      publish();
    }
    return;
  }
  if (act === "ask") {
    if (isBlocked(from, nick)) return;
    if (duel.phase === "live") {
      sender?.(from, packet("no", "", 1));
      return;
    }
    duel = { phase: "in", id: from, nick: nick || "Oyuncu", level };
    sel = { kind: "player", id: from, nick: duel.nick, level };
    publish();
    return;
  }
  if (act === "yes" && duel.phase === "sent" && duel.id === from) {
    if (onPlaza(readSim().x, readSim().z)) {
      sender?.(from, packet("end", nick, level));
      duel = idleDuel;
      useRpg.setState({ toast: "Taş meydanda düello yok. Meydanın dışına çık." });
      publish();
      return;
    }
    duel = { ...duel, phase: "live" };
    sel = { kind: "player", id: from, nick: duel.nick, level: duel.level };
    useRpg.setState({ toast: `VS · ${duel.nick}` });
    publish();
    return;
  }
  if ((act === "no" || act === "end") && duel.id === from && duel.phase !== "idle") {
    const rejected = act === "no" && duel.phase === "sent";
    const won = act === "end" && duel.phase === "live" && row.fallen === true;
    duel = idleDuel;
    if (won) useRpg.getState().noteDuelWin();
    useRpg.setState({ toast: rejected ? "Düello reddedildi" : won ? "Düelloyu kazandın" : "Düello bitti" });
    publish();
  }
}
