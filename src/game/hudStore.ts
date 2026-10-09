import { create } from "zustand";

type HudState = {
  playing: boolean;
  ready: boolean;
  zone: string;
  setPlaying: (playing: boolean) => void;
  setReady: (ready: boolean) => void;
  setZone: (zone: string) => void;
};

function createHud() {
  return create<HudState>((set) => ({
    playing: false,
    ready: false,
    zone: "Demirköy",
    setPlaying: (playing) => set({ playing }),
    setReady: (ready) => set({ ready }),
    setZone: (zone) => set({ zone }),
  }));
}

const scope = globalThis as typeof globalThis & { __demirHud?: ReturnType<typeof createHud> };

export const useHud = (scope.__demirHud ??= createHud());

export type MobChip = { id: string; name: string; hp: number; max: number };

let chips: MobChip[] = [];
const chipListeners = new Set<() => void>();

export function subscribeMobs(fn: () => void) {
  chipListeners.add(fn);
  return () => {
    chipListeners.delete(fn);
  };
}

export function mobSnapshot() {
  return chips;
}

export function publishMobs(next: MobChip[]) {
  if (
    next.length === chips.length &&
    next.every((m, i) => m.id === chips[i]?.id && m.name === chips[i]?.name && m.hp === chips[i]?.hp && m.max === chips[i]?.max)
  ) {
    return;
  }
  chips = next;
  chipListeners.forEach((fn) => fn());
}