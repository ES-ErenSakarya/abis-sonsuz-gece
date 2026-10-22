export type HudId = "vitals" | "map" | "quests" | "hotbar" | "joy" | "attack" | "edge";

export const HUD_IDS: HudId[] = ["vitals", "map", "quests", "hotbar", "joy", "attack", "edge"];

export const HUD_LABEL: Record<HudId, string> = {
  vitals: "Can",
  map: "Harita",
  quests: "Görevler",
  hotbar: "Kısayol",
  joy: "Yön",
  attack: "Saldırı",
  edge: "Menü",
};

export type HudShift = { x: number; y: number };
export type HudLayout = { scale: number; shift: Record<HudId, HudShift> };

const KEY = "abis-hud";
const blank = (): Record<HudId, HudShift> => ({
  vitals: { x: 0, y: 0 },
  map: { x: 0, y: 0 },
  quests: { x: 0, y: 0 },
  hotbar: { x: 0, y: 0 },
  joy: { x: 0, y: 0 },
  attack: { x: 0, y: 0 },
  edge: { x: 0, y: 0 },
});

let layout: HudLayout = { scale: 1, shift: blank() };
let editing = false;
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

export function subscribeHud(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function loadHud() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<HudLayout> & { shift?: Partial<Record<HudId, HudShift>> };
    const shift = blank();
    for (const id of HUD_IDS) {
      const row = parsed.shift?.[id];
      if (!row) continue;
      shift[id] = { x: clampShift(row.x), y: clampShift(row.y) };
    }
    layout = { scale: clampScale(parsed.scale ?? 1), shift };
  } catch {
    /* keep defaults */
  }
  applyHudLayout();
}

export function writeHud(next: HudLayout) {
  const shift = blank();
  for (const id of HUD_IDS) {
    const row = next.shift[id] ?? { x: 0, y: 0 };
    shift[id] = { x: clampShift(row.x), y: clampShift(row.y) };
  }
  layout = { scale: clampScale(next.scale), shift };
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    /* private mode */
  }
  applyHudLayout();
  emit();
}

export function setHudScale(scale: number) {
  writeHud({ ...layout, scale });
}

export function nudgeHud(id: HudId, dx: number, dy: number) {
  const cur = layout.shift[id];
  const shift = { ...layout.shift, [id]: { x: cur.x + dx, y: cur.y + dy } };
  writeHud({ ...layout, shift });
}

export function resetHud() {
  writeHud({ scale: 1, shift: blank() });
}

export function setHudEdit(on: boolean) {
  editing = on;
  document.documentElement.toggleAttribute("data-hud-edit", on);
  emit();
}

export function applyHudLayout() {
  const root = document.documentElement;
  root.style.setProperty("--hud-user", String(layout.scale));
  for (const id of HUD_IDS) {
    const row = layout.shift[id];
    root.style.setProperty(`--hud-${id}-x`, `${row.x}px`);
    root.style.setProperty(`--hud-${id}-y`, `${row.y}px`);
  }
}
