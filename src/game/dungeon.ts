export type ArenaFloor = { x: number; z: number; y: number; r: number };
export type DungeonRun = { bossId: string; wave: number; name: string };

let run: DungeonRun | null = null;
let floor: ArenaFloor | null = null;
const listeners = new Set<() => void>();

export function dungeonNow() {
  return run;
}

export function arenaFloor() {
  return floor;
}

export function subscribeDungeon(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function publish() {
  for (const fn of listeners) fn();
}

export function beginRun(next: DungeonRun, spot: ArenaFloor) {
  run = next;
  floor = spot;
  publish();
}

export function setWave(wave: number) {
  if (!run || run.wave === wave) return;
  run = { ...run, wave };
  publish();
}

export function endRun() {
  if (!run && !floor) return;
  run = null;
  floor = null;
  publish();
}
