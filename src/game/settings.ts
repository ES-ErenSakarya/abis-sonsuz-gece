import { setWindVolume } from "@/game/input";

export type Gfx = { fps: number; quality: number; auto: boolean; volume: number };

const KEY = "abis-gfx";
let gfx: Gfx = { fps: 60, quality: 1, auto: true, volume: 0.45 };
const listeners = new Set<() => void>();

export function readGfx() {
  return gfx;
}

export function subscribeGfx(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function loadGfx() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<Gfx>;
    gfx = { ...gfx, ...parsed };
  } catch {
    /* keep defaults */
  }
}

export function writeGfx(patch: Partial<Gfx>) {
  gfx = { ...gfx, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(gfx));
  } catch {
    /* private mode */
  }
  setWindVolume(gfx.volume);
  for (const fn of listeners) fn();
}

export function autoQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (cores <= 4 || mem <= 4) return 0.7;
  return 1;
}
