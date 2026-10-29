const TRACKS: Record<string, string> = {
  koy: "/audio/ana-koy.mp3",
  koy2: "/audio/koy2.mp3",
  dolunay: "/audio/dolunay.mp3",
  ay: "/audio/sonsuz-ay.mp3",
  abis: "/audio/sonsuz-ay.mp3",
  kanli: "/audio/dolunay.mp3",
  kiyamet: "/audio/sonsuz-ay.mp3",
};

const HITS: Record<string, string> = {
  savasci: "/audio/kilic.mp3",
  ninja: "/audio/bicak.mp3",
  buyucu: "/audio/buyu.mp3",
  okcu: "/audio/ok.mp3",
};

const KEY = "abis-music";
let volume = 0.5;
let realm = "";
let music: HTMLAudioElement | null = null;
let menu: HTMLAudioElement | null = null;
let menuOn = false;
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
  if (menu) menu.volume = volume;
  emit();
}

function ensureMenu() {
  if (!menu) {
    menu = new Audio("/audio/karakter.mp3");
    menu.loop = true;
    menu.preload = "auto";
    menu.autoplay = true;
  }
  return menu;
}

function tryPlayMenu() {
  if (!menuOn || !menu) return;
  menu.volume = volume;
  if (volume <= 0.001) {
    menu.pause();
    return;
  }
  if (menu.paused) void menu.play().catch(() => undefined);
}

function arm() {
  unlocked = true;
  if (music && realm && music.paused) void music.play().catch(() => undefined);
  tryPlayMenu();
}

if (typeof window !== "undefined") {
  loadMusic();
  window.addEventListener("pointerdown", arm);
  window.addEventListener("keydown", arm);
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

export function primeMenuMusic() {
  unlocked = true;
  const node = ensureMenu();
  node.volume = menuOn ? volume : 0;
  if (node.paused) void node.play().catch(() => undefined);
}

export function syncMenuMusic(active: boolean) {
  menuOn = active;
  const node = ensureMenu();
  if (!active) {
    node.pause();
    return;
  }
  node.volume = volume;
  if (volume <= 0.001) {
    node.pause();
    return;
  }
  if (node.paused) void node.play().catch(() => undefined);
}

const hitPool: HTMLAudioElement[] = [];

export function playArrow() {
  window.setTimeout(() => playAttack("okcu"), 500);
}

export function playAttack(classId: string) {
  const src = HITS[classId] || HITS.savasci;
  if (!src) return;
  const node = hitPool.find((row) => row.paused || row.ended) ?? new Audio();
  if (!hitPool.includes(node)) hitPool.push(node);
  if (hitPool.length > 6) hitPool.shift();
  if (!node.src.endsWith(src)) node.src = src;
  node.volume = Math.max(0.2, Math.min(1, 0.55 + volume * 0.35));
  try {
    node.currentTime = 0;
  } catch {
    /* not ready */
  }
  void node.play().catch(() => undefined);
}
