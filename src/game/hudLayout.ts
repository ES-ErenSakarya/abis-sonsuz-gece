export type HudId = "vitals" | "map" | "quests" | "hotbar" | "joy" | "attack" | "ride" | "edge" | "notes" | "chat";

export const HUD_IDS: HudId[] = ["vitals", "map", "quests", "hotbar", "joy", "attack", "ride", "edge", "notes", "chat"];

export const HUD_LABEL: Record<HudId, string> = {
  vitals: "Can",
  map: "Harita",
  quests: "Görevler",
  hotbar: "Kısayol",
  joy: "Koş",
  attack: "Vur",
  ride: "İn",
  edge: "Menü",
  notes: "Mesajlar",
  chat: "Sohbet yazısı",
};

export type HudShift = { x: number; y: number };
export type HudLayout = { scale: number; size: Record<HudId, number>; shift: Record<HudId, HudShift> };

const KEY = "abis-hud";
const blank = (): Record<HudId, HudShift> => ({
  vitals: { x: 0, y: 0 },
  map: { x: 0, y: 0 },
  quests: { x: 0, y: 0 },
  hotbar: { x: 0, y: 0 },
  joy: { x: 0, y: 0 },
  attack: { x: 0, y: 0 },
  ride: { x: 0, y: 0 },
  edge: { x: 0, y: 0 },
  notes: { x: 0, y: 0 },
  chat: { x: 0, y: 0 },
});
const one = (): Record<HudId, number> => ({
  vitals: 1,
  map: 1,
  quests: 1,
  hotbar: 1,
  joy: 1,
  attack: 1,
  ride: 1,
  edge: 1,
  notes: 1,
  chat: 1,
});

let layout: HudLayout = { scale: 1, size: one(), shift: blank() };
let editing = false;
let picked: HudId | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function clampScale(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.max(0.6, Math.min(1.6, Math.round(n * 100) / 100));
}

function clampShift(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-900, Math.min(900, Math.round(n)));
}

export function readHud() {
  return layout;
}

export function hudEditing() {
  return editing;
}

export function hudPick() {
  return picked;
}

export function subscribeHud(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function loadHud() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<HudLayout> & { shift?: Partial<Record<HudId, HudShift>>; size?: Partial<Record<HudId, number>> };
    const shift = blank();
    const shared = clampScale(parsed.scale ?? 1);
    const size = one();
    for (const id of HUD_IDS) {
      const row = parsed.shift?.[id];
      if (row) shift[id] = { x: clampShift(row.x), y: clampShift(row.y) };
      size[id] = clampScale(parsed.size?.[id] ?? shared);
    }
    layout = { scale: 1, size, shift };
  } catch {
    /* keep defaults */
  }
  applyHudLayout();
}

export function writeHud(next: HudLayout) {
  const shift = blank();
  const size = one();
  for (const id of HUD_IDS) {
    const row = next.shift[id] ?? { x: 0, y: 0 };
    shift[id] = { x: clampShift(row.x), y: clampShift(row.y) };
    size[id] = clampScale(next.size?.[id] ?? 1);
  }
  layout = { scale: 1, size, shift };
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    /* private mode */
  }
  applyHudLayout();
  emit();
}

export function setPieceScale(id: HudId, scale: number) {
  writeHud({ ...layout, size: { ...layout.size, [id]: scale } });
}

export function pickHud(id: HudId | null) {
  picked = id;
  const root = document.documentElement;
  if (id) root.setAttribute("data-hud-pick", id);
  else root.removeAttribute("data-hud-pick");
  emit();
}

export function nudgeHud(id: HudId, dx: number, dy: number) {
  const cur = layout.shift[id];
  const shift = { ...layout.shift, [id]: { x: cur.x + dx, y: cur.y + dy } };
  writeHud({ ...layout, shift });
}

export function resetHud() {
  writeHud({ scale: 1, size: one(), shift: blank() });
}

export function resetPiece(id: HudId) {
  writeHud({
    ...layout,
    size: { ...layout.size, [id]: 1 },
    shift: { ...layout.shift, [id]: { x: 0, y: 0 } },
  });
}

export function setHudEdit(on: boolean) {
  editing = on;
  document.documentElement.toggleAttribute("data-hud-edit", on);
  if (!on) pickHud(null);
  else emit();
}

export function applyHudLayout() {
  const root = document.documentElement;
  root.style.setProperty("--hud-user", "1");
  for (const id of HUD_IDS) {
    const row = layout.shift[id];
    root.style.setProperty(`--hud-shift-${id}-x`, `${row.x}px`);
    root.style.setProperty(`--hud-shift-${id}-y`, `${row.y}px`);
    root.style.setProperty(`--hud-size-${id}`, String(layout.size[id]));
  }
}
