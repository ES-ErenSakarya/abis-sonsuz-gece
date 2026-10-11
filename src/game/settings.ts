import { setWindVolume } from "@/game/input";

export type GfxLevel = 0 | 1 | 2;
export type GfxPreset = "low" | "med" | "high" | "ultra" | "custom";
export type Gfx = {
  fps: number;
  quality: number;
  auto: boolean;
  volume: number;
  preset: GfxPreset;
  scale: number;
  distance: number;
  grass: GfxLevel;
  mobs: GfxLevel;
  effects: boolean;
};

const KEY = "abis-gfx";
const BASE: Gfx = {
  fps: 60,
  quality: 1,
  auto: true,
  volume: 0.45,
  preset: "med",
  scale: 0.85,
  distance: 72,
  grass: 1,
  mobs: 1,
  effects: true,
};

export const GFX_PRESETS: Record<Exclude<GfxPreset, "custom">, Pick<Gfx, "preset" | "scale" | "distance" | "grass" | "mobs" | "effects" | "fps" | "quality">> = {
  low: { preset: "low", scale: 0.65, distance: 52, grass: 0, mobs: 0, effects: false, fps: 30, quality: 0.65 },
  med: { preset: "med", scale: 0.85, distance: 72, grass: 1, mobs: 1, effects: true, fps: 60, quality: 0.85 },
  high: { preset: "high", scale: 1, distance: 150, grass: 2, mobs: 1, effects: true, fps: 60, quality: 1 },
  ultra: { preset: "ultra", scale: 1.2, distance: 240, grass: 2, mobs: 2, effects: true, fps: 60, quality: 1.2 },
};

let gfx: Gfx = { ...BASE };
let view: Gfx | null = null;
const listeners = new Set<() => void>();

export function readGfx() {
  return gfx;
}

export function subscribeGfx(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function weakDevice() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return cores <= 4 || mem <= 4;
}

export function effectiveGfx(): Gfx {
  if (view) return view;
  if (typeof navigator === "undefined" || !gfx.auto) view = gfx;
  else {
    const pick = weakDevice() ? GFX_PRESETS.low : GFX_PRESETS.med;
    view = { ...gfx, ...pick, auto: true, volume: gfx.volume };
  }
  return view;
}

export function loadGfx() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<Gfx>;
    gfx = { ...BASE, ...parsed };
    if (parsed.grass !== 0 && parsed.grass !== 1 && parsed.grass !== 2) gfx.grass = BASE.grass;
    if (parsed.mobs !== 0 && parsed.mobs !== 1 && parsed.mobs !== 2) gfx.mobs = BASE.mobs;
  } catch {
    /* keep defaults */
  }
  view = null;
}

export function writeGfx(patch: Partial<Gfx>) {
  gfx = { ...gfx, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(gfx));
  } catch {
    /* private mode */
  }
  setWindVolume(gfx.volume);
  view = null;
  for (const fn of listeners) fn();
}

export function autoQuality() {
  return weakDevice() ? 0.7 : 1;
}
