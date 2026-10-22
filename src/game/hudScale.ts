import { touchHitSize } from "@/game/touchHit";
import { readHud } from "@/game/hudLayout";

export type Corner =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

const PIVOT: Record<Corner, { x: number; y: number }> = {
  "top-left": { x: 0, y: 0 },
  "top-center": { x: 0.5, y: 0 },
  "top-right": { x: 1, y: 0 },
  "middle-left": { x: 0, y: 0.5 },
  "center": { x: 0.5, y: 0.5 },
  "middle-right": { x: 1, y: 0.5 },
  "bottom-left": { x: 0, y: 1 },
  "bottom-center": { x: 0.5, y: 1 },
  "bottom-right": { x: 1, y: 1 },
};

export class HudAnchor {
  constructor(
    public corner: Corner,
    /** Inset from the corner, as a fraction of screen width. Positive moves inward. */
    public ox = 0,
    /** Inset from the corner, as a fraction of screen height. Positive moves inward. */
    public oy = 0,
  ) {}

  place(screenW: number, screenH: number, boxW = 0, boxH = 0) {
    const w = Math.max(1, screenW);
    const h = Math.max(1, screenH);
    const pivot = PIVOT[this.corner];
    const x = pivot.x * w + this.ox * w * (pivot.x === 1 ? -1 : 1) - pivot.x * boxW;
    const y = pivot.y * h + this.oy * h * (pivot.y === 1 ? -1 : 1) - pivot.y * boxH;
    return { x, y };
  }

  /** Keep this corner and store a dragged top-left as a fractional inset. */
  stick(left: number, top: number, screenW: number, screenH: number, boxW = 0, boxH = 0) {
    const w = Math.max(1, screenW);
    const h = Math.max(1, screenH);
    const pivot = PIVOT[this.corner];
    const rawX = (left - pivot.x * w + pivot.x * boxW) / w;
    const rawY = (top - pivot.y * h + pivot.y * boxH) / h;
    this.ox = pivot.x === 1 ? -rawX : rawX;
    this.oy = pivot.y === 1 ? -rawY : rawY;
  }
}

export type Anchors = {
  vitalsX: number;
  vitalsY: number;
  vitalsW: number;
  mapY: number;
  mapS: number;
  hotbarBottom: number;
  slot: number;
  questY: number;
  questW: number;
  questH: number;
  chatW: number;
  chatBottom: number;
  winW: number;
  winH: number;
  winWide: number;
  joy: number;
  hit: number;
  plusW: number;
  plusLeft: number;
  plusRight: number;
  font: number;
};

function aspect(screenW: number, screenH: number) {
  const w = Math.max(1, screenW);
  const h = Math.max(1, screenH);
  return { w, h, portrait: h > w * 1.05, short: h < w * 0.62, side: Math.min(w, h) };
}

export function hudPins(screenW: number, screenH: number) {
  const { portrait, short } = aspect(screenW, screenH);
  return {
    vitals: new HudAnchor("top-left", 0.02, 0.018),
    map: new HudAnchor("top-right", 0.02, portrait || short ? 0.085 : 0.07),
    hotbar: new HudAnchor("bottom-center", 0, portrait ? 0.155 : short ? 0.2 : 0.02),
    quests: new HudAnchor("top-right", 0.02, portrait || short ? 0.26 : 0.3),
    chat: new HudAnchor("bottom-center", 0, portrait ? 0.16 : short ? 0.2 : 0.055),
    plusLeft: new HudAnchor("bottom-left", 0.02, portrait ? 0.08 : 0.04),
    plusRight: new HudAnchor("bottom-right", 0.02, portrait ? 0.2 : 0.1),
    settings: new HudAnchor("top-right", 0.02, 0.012),
  };
}

export function hudAnchors(screenW: number, screenH: number): Anchors {
  const { w, h, portrait, short, side } = aspect(screenW, screenH);
  const pins = hudPins(w, h);
  const vitals = pins.vitals.place(w, h);
  const map = pins.map.place(w, h);
  const hotbar = pins.hotbar.place(w, h);
  const quests = pins.quests.place(w, h);
  const chat = pins.chat.place(w, h);
  const plusLeft = pins.plusLeft.place(w, h);
  const plusRight = pins.plusRight.place(w, h);
  return {
    vitalsX: vitals.x / w,
    vitalsY: vitals.y / h,
    vitalsW: portrait ? 0.62 : short ? 0.3 : 0.22,
    mapY: map.y / h,
    mapS: portrait ? 0.16 : short ? 0.13 : 0.15,
    hotbarBottom: (h - hotbar.y) / h,
    slot: portrait ? 0.088 : short ? 0.068 : 0.052,
    questY: quests.y / h,
    questW: portrait ? 0.42 : short ? 0.24 : 0.16,
    questH: portrait ? 0.2 : short ? 0.22 : 0.34,
    chatW: portrait ? 0.92 : short ? 0.46 : 0.34,
    chatBottom: (h - chat.y) / h,
    winW: portrait ? 0.92 : 0.32,
    winH: portrait ? 0.72 : short ? 0.86 : 0.78,
    winWide: portrait ? 0.94 : short ? 0.48 : 0.44,
    joy: portrait ? 0.2 : short ? 0.18 : 0.14,
    hit: portrait ? 0.12 : 0.1,
    plusW: portrait ? 0.22 : 0.1,
    plusLeft: (h - plusLeft.y) / h,
    plusRight: (h - plusRight.y) / h,
    font: side * (portrait ? 0.032 : short ? 0.03 : 0.016),
  };
}

export function placeWindow(pin: HudAnchor, screenW: number, screenH: number, wide = false) {
  const boxW = (wide ? hudAnchors(screenW, screenH).winWide : hudAnchors(screenW, screenH).winW) * screenW;
  return { ...pin.place(screenW, screenH, boxW, 0), boxW };
}

export function applyHudScale(screenW = window.innerWidth, screenH = window.innerHeight) {
  const user = readHud().scale;
  const a = hudAnchors(screenW, screenH);
  const w = Math.max(1, screenW);
  const h = Math.max(1, screenH);
  const { portrait, short } = aspect(w, h);
  const side = Math.min(w, h);
  const root = document.documentElement;
  const px = (name: string, value: number) => root.style.setProperty(name, `${Math.round(value)}px`);
  px("--hud-vitals-x", a.vitalsX * w);
  px("--hud-vitals-y", a.vitalsY * h);
  px("--hud-vitals-w", a.vitalsW * w * user);
  px("--hud-map-y", a.mapY * h);
  px("--hud-map-s", a.mapS * side * user);
  px("--hud-hotbar-b", a.hotbarBottom * h);
  px("--hud-slot", a.slot * side * user);
  px("--hud-quest-y", a.questY * h);
  px("--hud-quest-w", a.questW * w * user);
  px("--hud-quest-h", a.questH * h);
  px("--hud-chat-w", a.chatW * w);
  px("--hud-chat-b", a.chatBottom * h);
  px("--hud-win-w", a.winW * w);
  px("--hud-win-h", a.winH * h);
  px("--hud-win-wide", a.winWide * w);
  px("--hud-joy", a.joy * side * user);
  px("--hud-hit", a.hit * side * user);
  px("--hud-plus-w", a.plusW * w);
  px("--hud-plus-l", a.plusLeft * h);
  px("--hud-plus-r", a.plusRight * h);
  px("--hud-font", Math.max(11, Math.min(18, a.font)));
  px("--touch-hit", touchHitSize(w, h));
  root.style.setProperty("--hud-user", String(user));
  const tight = portrait || short || w <= 1100 || h <= 680;
  const head = tight ? (portrait ? 0.3 : 0.28) : 0.08;
  const dock = tight ? (portrait ? 0.36 : 0.34) : 0.12;
  px("--hud-safe-top", head * h);
  px("--hud-dock", dock * h);
  px("--hud-safe-h", Math.max(h * 0.28, (1 - head - dock) * h));
}
