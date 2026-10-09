import { useRpg } from "@/game/rpg";
import { isBlocked } from "@/game/target";

export type ChatLine = { id: number; nick: string; text: string; whisper: boolean };

type Bubble = { key: string; nick: string; text: string; until: number };

type Whisper = { id: string; nick: string } | null;

let lines: ChatLine[] = [];
let bubbles: Bubble[] = [];
let whisper: Whisper = null;
let focused = false;
let seq = 1;
let sender: ((peerId: string | undefined, data: unknown) => void) | null = null;
const listeners = new Set<() => void>();
let snap: ChatLine[] = lines;

function publish() {
  snap = lines.slice();
  for (const fn of listeners) fn();
}

export function subscribeChat(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function chatSnapshot() {
  return snap;
}

export function chatFocused() {
  return focused;
}

export function setChatFocus(next: boolean) {
  if (focused === next) return;
  focused = next;
  publish();
}

export function whisperTarget() {
  return whisper;
}

export function setWhisper(next: Whisper) {
  whisper = next;
  publish();
}

export function bindChatSend(fn: (peerId: string | undefined, data: unknown) => void) {
  sender = fn;
  return () => {
    if (sender === fn) sender = null;
  };
}

function pushLine(nick: string, text: string, isWhisper: boolean) {
  lines = [...lines, { id: seq++, nick, text, whisper: isWhisper }].slice(-40);
  publish();
}

function pushBubble(key: string, nick: string, text: string) {
  const until = performance.now() + 4500;
  bubbles = [...bubbles.filter((row) => row.key !== key), { key, nick, text, until }];
}

export function chatBubbles(now: number) {
  if (bubbles.some((row) => row.until <= now)) bubbles = bubbles.filter((row) => row.until > now);
  return bubbles;
}

export function sendChat(raw: string) {
  const text = raw.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!text) return;
  const nick = useRpg.getState().nick || "Gezgin";
  pushLine(nick, text, false);
  pushBubble("me", nick, text);
  sender?.(undefined, { kind: "chat", nick, text, whisper: false });
}

export function sendWhisper(raw: string) {
  const text = raw.replace(/\s+/g, " ").trim().slice(0, 80);
  const to = whisper;
  if (!text || !to) return;
  const nick = useRpg.getState().nick || "Gezgin";
  pushLine(`→ ${to.nick}`, text, true);
  sender?.(to.id, { kind: "chat", nick, text, whisper: true });
}

export function receiveChat(from: string, data: unknown) {
  if (!data || typeof data !== "object") return;
  const row = data as Record<string, unknown>;
  if (row.kind !== "chat" || typeof row.text !== "string") return;
  const nick = typeof row.nick === "string" ? row.nick.replace(/\s+/g, " ").slice(0, 16) : "Oyuncu";
  if (isBlocked(from, nick)) return;
  const text = row.text.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!text) return;
  if (row.whisper && whisper?.id !== from) {
    const mine = useRpg.getState().nick;
    if (nick && nick !== mine && whisper?.id !== from) {
      /* still show whispers addressed to us; the sender only targets us */
    }
  }
  pushLine(row.whisper ? `${nick} fısıldadı` : nick, text, Boolean(row.whisper));
  pushBubble(from, nick, text);
}
