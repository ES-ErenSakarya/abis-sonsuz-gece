const TRACKS: Record<string, string> = {
  koy: "/audio/ana-koy.mp3",
  koy2: "/audio/koy2.mp3",
  dolunay: "/audio/dolunay.mp3",
  ay: "/audio/sonsuz-ay.mp3",
};

const HITS: Record<string, string> = {
  savasci: "/audio/kilic.mp3",
  ninja: "/audio/bicak.mp3",
  buyucu: "/audio/buyu.mp3",
  okcu: "/audio/yay.mp3",
};

const KEY = "abis-music";
let volume = 0.5;
let realm = "";
let music: HTMLAudioElement | null = null;
let hit: HTMLAudioElement | null = null;
let unlocked = false;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function readMusic() {
  return volume;
}

export function subscribeMusic(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function loadMusic() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return;
    const next = Number(raw);
    if (Number.isFinite(next)) volume = Math.max(0, Math.min(1, next));
  } catch {
    /* keep default */
  }
  if (music) music.volume = volume;
}

export function writeMusic(next: number) {
  volume = Math.max(0, Math.min(1, next));
  try {
    localStorage.setItem(KEY, String(volume));
  } catch {
    /* private mode */
  }
  if (music) music.volume = volume;
  emit();
}

function arm() {
  if (unlocked) return;
  unlocked = true;
  if (music && realm) void music.play().catch(() => undefined);
}

if (typeof window !== "undefined") {
  loadMusic();
  window.addEventListener("pointerdown", arm, { once: true });
  window.addEventListener("keydown", arm, { once: true });
}

export function syncRealmMusic(nextRealm: string, active: boolean) {
  if (!active) {
    music?.pause();
    realm = "";
    return;
  }
  const src = TRACKS[nextRealm] || TRACKS.koy;
  if (!music) {
    music = new Audio(src);
    music.loop = true;
    music.preload = "auto";
  } else if (realm !== nextRealm) {
    music.src = src;
  }
  realm = nextRealm;
  music.volume = volume;
  if (volume <= 0.001) {
    music.pause();
    return;
  }
  if (unlocked && music.paused) void music.play().catch(() => undefined);
}

export function playAttack(classId: string) {
  const src = HITS[classId] || HITS.savasci;
  if (!src) return;
  if (!hit) {
    hit = new Audio(src);
    hit.preload = "auto";
  } else if (!hit.src.endsWith(src)) {
    hit.src = src;
  }
  hit.volume = Math.max(0.2, Math.min(1, 0.55 + volume * 0.35));
  hit.currentTime = 0;
  void hit.play().catch(() => undefined);
}
