import { arenaFloor } from "@/game/dungeon";
export type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Circle = { x: number; z: number; r: number };

export const WORLD = 150;
export const PLAYER_R = 0.42;
export const SPAWN = { x: 0, z: 10 };
export const PLAZA_R = 16.7;

export function onPlaza(x: number, z: number) {
  return Math.hypot(x, z) < PLAZA_R;
}

function box(cx: number, cz: number, w: number, d: number): Box {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
}

export function faceYaw(x: number, z: number) {
  const len = Math.hypot(x, z) || 1;
  return Math.atan2(-x / len, -z / len);
}

function rotatedBox(x: number, z: number, w: number, d: number, yaw: number): Box {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const lx of [-w / 2, w / 2]) {
    for (const lz of [-d / 2, d / 2]) {
      const wx = x + lx * c + lz * s;
      const wz = z - lx * s + lz * c;
      minX = Math.min(minX, wx);
      maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz);
      maxZ = Math.max(maxZ, wz);
    }
  }
  return { minX, maxX, minZ, maxZ };
}

export const HOUSES = [
  { id: "hall", x: -22, z: -34, w: 34, d: 6.4, h: 3.45, rh: 1.9, door: "pz" as const, yaw: faceYaw(-22, -34) },
  { id: "west", x: -28, z: -16, w: 6.4, d: 5.2, h: 2.95, rh: 1.5, door: "pz" as const, yaw: faceYaw(-28, -16) },
  { id: "east", x: 28, z: -16, w: 6.2, d: 5.0, h: 2.85, rh: 1.45, door: "pz" as const, yaw: faceYaw(28, -16) },
  { id: "forge", x: -16.5, z: 22.5, w: 12.6, d: 5.6, h: 2.9, rh: 1.45, door: "pz" as const, yaw: faceYaw(-16.5, 22.5) },
  { id: "barn", x: 22, z: 22, w: 7.4, d: 5.4, h: 3.1, rh: 1.6, door: "pz" as const, yaw: faceYaw(22, 22) },
  { id: "depot", x: 14, z: 30, w: 7.2, d: 5.2, h: 2.85, rh: 1.4, door: "pz" as const, yaw: faceYaw(14, 30) },
];

export const CHIMNEYS = [
  { x: -30, z: -34, y: 5.4 },
  { x: -28, z: -16, y: 4.7 },
  { x: 28, z: -16, y: 4.55 },
  { x: -16.5, z: 22.5, y: 4.5 },
];

export const TREES = [
  { x: -30, z: -28, s: 1.1, seed: 1 },
  { x: 32, z: -26, s: 1.15, seed: 2 },
  { x: -34, z: 22, s: 1.05, seed: 3 },
  { x: 34, z: 16, s: 1.2, seed: 4 },
  { x: -14, z: 36, s: 1.0, seed: 5 },
  { x: 12, z: -38, s: 1.12, seed: 6 },
  { x: 40, z: -6, s: 0.95, seed: 7 },
  { x: -40, z: 6, s: 1.08, seed: 8 },
];

export const BOXES: Box[] = HOUSES.map((h) => rotatedBox(h.x, h.z, h.w + 0.85, h.d + 0.85, h.yaw));

const FISHER = { x: 33, z: 56 };
const FISHER_R = Math.hypot(FISHER.x, FISHER.z) || 1;
const FISHER_IN = { x: -FISHER.x / FISHER_R, z: -FISHER.z / FISHER_R };
const FISHER_SIDE = { x: -FISHER_IN.z, z: FISHER_IN.x };
function fisherAt(inward: number, side = 0) {
  return {
    x: FISHER.x + FISHER_IN.x * inward + FISHER_SIDE.x * side,
    z: FISHER.z + FISHER_IN.z * inward + FISHER_SIDE.z * side,
  };
}
export const FISHER_YAW = Math.atan2(FISHER_IN.x, FISHER_IN.z);
const fisherHutAt = fisherAt(-8.8, 0);
export const FISHER_HUT = { x: fisherHutAt.x, z: fisherHutAt.z, w: 4.4, d: 3.5, yaw: FISHER_YAW };
export const FISHER_STAND = fisherAt(-6.5, 2.35);
const pierLand = fisherAt(-1.1, 0);
const pierTip = fisherAt(4.6, 0);
const lakeAt = fisherAt(8.2, 0);
export const LAKE = { x: lakeAt.x, z: lakeAt.z, r: 5.2 };
export const PIER = { x0: pierLand.x, z0: pierLand.z, x1: pierTip.x, z1: pierTip.z, half: 1.12 };
export const PIER_TOP = 0.48;
BOXES.push(rotatedBox(FISHER_HUT.x, FISHER_HUT.z, FISHER_HUT.w, FISHER_HUT.d, FISHER_HUT.yaw));

type Solid = { x: number; z: number; c: number; s: number; hw: number; hd: number };
const SOLIDS: Solid[] = [];

function fillSolids() {
  SOLIDS.length = 0;
  for (const h of HOUSES) {
    SOLIDS.push({
      x: h.x,
      z: h.z,
      c: Math.cos(h.yaw),
      s: Math.sin(h.yaw),
      hw: (h.w + 0.55) / 2,
      hd: (h.d + 0.55) / 2,
    });
  }
  SOLIDS.push({
    x: FISHER_HUT.x,
    z: FISHER_HUT.z,
    c: Math.cos(FISHER_HUT.yaw),
    s: Math.sin(FISHER_HUT.yaw),
    hw: FISHER_HUT.w / 2,
    hd: FISHER_HUT.d / 2,
  });
}

fillSolids();

export function setHousePose(id: string, x: number, z: number, yaw: number) {
  const house = HOUSES.find((row) => row.id === id);
  if (!house) return;
  house.x = x;
  house.z = z;
  house.yaw = yaw;
  fillSolids();
}

export function setHutPose(x: number, z: number, yaw: number) {
  FISHER_HUT.x = x;
  FISHER_HUT.z = z;
  FISHER_HUT.yaw = yaw;
  fillSolids();
}

export function setLakePose(x: number, z: number) {
  LAKE.x = x;
  LAKE.z = z;
}

export let pierLift = 0;

export function setPierPose(x: number, z: number, yaw: number, lift: number, len: number, half: number) {
  const hx = Math.sin(yaw) * (len / 2);
  const hz = Math.cos(yaw) * (len / 2);
  PIER.x0 = x - hx;
  PIER.z0 = z - hz;
  PIER.x1 = x + hx;
  PIER.z1 = z + hz;
  PIER.half = half;
  pierLift = lift;
}

export function setTreePose(index: number, x: number, z: number) {
  const tree = TREES[index];
  const circle = CIRCLES[index + 1];
  if (tree) {
    tree.x = x;
    tree.z = z;
  }
  if (circle) {
    circle.x = x;
    circle.z = z;
  }
}

export function setVeinPose(index: number, x: number, z: number) {
  const vein = VEINS[index];
  if (!vein) return;
  vein.x = x;
  vein.z = z;
}

export const WELL = { x: 0, z: 0 };

export function setWellPose(x: number, z: number) {
  WELL.x = x;
  WELL.z = z;
  const circle = CIRCLES[0];
  if (circle) {
    circle.x = x;
    circle.z = z;
  }
}

export const FENCE_POSE = { x: 0, z: 0, yaw: 0 };

export function setFencePose(x: number, z: number, yaw: number) {
  FENCE_POSE.x = x;
  FENCE_POSE.z = z;
  FENCE_POSE.yaw = yaw;
}

export function setRealmCenter(id: string, x: number, z: number) {
  const realm = REALMS.find((row) => row.id === id) as { x: number; z: number } | undefined;
  if (!realm) return;
  realm.x = x;
  realm.z = z;
}

export function moveMark(name: string, x: number, z: number) {
  const mark = MAP_MARKS.find((row) => row.name === name);
  if (!mark) return;
  mark.x = x;
  mark.z = z;
}
function solidHits(b: Solid, x: number, z: number, radius: number) {
  const dx = x - b.x;
  const dz = z - b.z;
  const lx = dx * b.c - dz * b.s;
  const lz = dx * b.s + dz * b.c;
  const clx = Math.max(-b.hw, Math.min(lx, b.hw));
  const clz = Math.max(-b.hd, Math.min(lz, b.hd));
  const ddx = lx - clx;
  const ddz = lz - clz;
  return ddx * ddx + ddz * ddz < radius * radius;
}

export function onPier(x: number, z: number) {
  const ax = PIER.x1 - PIER.x0;
  const az = PIER.z1 - PIER.z0;
  const len2 = ax * ax + az * az || 1;
  const t = ((x - PIER.x0) * ax + (z - PIER.z0) * az) / len2;
  if (t < 0 || t > 1) return false;
  const px = PIER.x0 + ax * t;
  const pz = PIER.z0 + az * t;
  const dx = x - px;
  const dz = z - pz;
  return dx * dx + dz * dz <= PIER.half * PIER.half;
}

export function lakeBlocks(x: number, z: number, radius = 0) {
  if (onPier(x, z)) return false;
  return Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r - 0.05 + radius * 0.15;
}

export function pierSideBlocks(x: number, z: number, radius: number) {
  const ax = PIER.x1 - PIER.x0;
  const az = PIER.z1 - PIER.z0;
  const len2 = ax * ax + az * az || 1;
  const t = ((x - PIER.x0) * ax + (z - PIER.z0) * az) / len2;
  if (t < 0.16 || t > 1.04) return false;
  const px = PIER.x0 + ax * Math.max(0, Math.min(1, t));
  const pz = PIER.z0 + az * Math.max(0, Math.min(1, t));
  const lateral = Math.hypot(x - px, z - pz);
  const inner = PIER.half * 0.62;
  return lateral > inner && lateral < PIER.half + 0.7 + radius;
}

export const CIRCLES: Circle[] = [
  { x: 0, z: 0, r: 1.22 },
  ...TREES.map((t) => ({ x: t.x, z: t.z, r: 0.46 * t.s })),
];

export function addBlockCircle(x: number, z: number, r: number) {
  for (let i = 0; i < CIRCLES.length; i++) {
    const c = CIRCLES[i]!;
    const dx = c.x - x;
    const dz = c.z - z;
    if (dx * dx + dz * dz < 0.05) return;
  }
  CIRCLES.push({ x, z, r });
}

export const WALL_R = 46.2;
const WALL_HALF = 0.72;
export const DECK_HALF = 2.62;
export const RAIL_T = 0.2;
export const RAIL_IN = DECK_HALF - RAIL_T;
export const DECK_TOP = 0.5;
export const WALK_HALF = 1.45;
export const SPAN_IN = 40.4;
export const SPAN_OUT = 70.2;
export const MOAT_IN = 46.55;
export const MOAT_OUT = 64.9;
export const RISE_IN = MOAT_IN - 1.1;
export const RISE_OUT = MOAT_OUT + 1.1;
export const GATE_VIS = Math.asin(Math.min(0.2, (DECK_HALF + 0.08) / WALL_R));

function angDist(a: number, b: number) {
  let d = Math.abs(a - b);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

export function gateOpen(x: number, z: number, half = 0.11) {
  const a = Math.atan2(x, z);
  return angDist(a, 0) < half || angDist(a, Math.PI) < half || angDist(a, Math.PI / 2) < half || angDist(a, -Math.PI / 2) < half;
}

function spanOf(x: number, z: number, half: number, inner: number, outer: number) {
  if (Math.abs(x) <= half && z >= inner && z <= outer) return { across: x, along: z };
  if (Math.abs(x) <= half && z <= -inner && z >= -outer) return { across: x, along: z };
  if (Math.abs(z) <= half && x >= inner && x <= outer) return { across: z, along: x };
  if (Math.abs(z) <= half && x <= -inner && x >= -outer) return { across: z, along: x };
  return null;
}

export function bridgeSpan(x: number, z: number) {
  return spanOf(x, z, DECK_HALF, SPAN_IN, SPAN_OUT);
}

export function onBridge(x: number, z: number) {
  const span = bridgeSpan(x, z);
  return !!span && Math.abs(span.across) <= WALK_HALF;
}

function deckBlocks(x: number, z: number, radius: number) {
  const span = spanOf(x, z, DECK_HALF + radius, SPAN_IN, SPAN_OUT);
  if (!span) return false;
  return Math.abs(span.across) + radius > WALK_HALF;
}

export function bridgeDeckY(along: number) {
  const a = Math.abs(along);
  const lo = 0.02;
  const hi = DECK_TOP;
  if (a <= SPAN_IN || a >= SPAN_OUT) return lo;
  if (a < RISE_IN) return lo + ((hi - lo) * (a - SPAN_IN)) / (RISE_IN - SPAN_IN);
  if (a <= RISE_OUT) return hi;
  return lo + ((hi - lo) * (SPAN_OUT - a)) / (SPAN_OUT - RISE_OUT);
}

export function groundY(x: number, z: number) {
  const floor = arenaFloor();
  if (floor && Math.hypot(x - floor.x, z - floor.z) <= floor.r + 0.35) return floor.y;
  if (onPier(x, z)) return PIER_TOP + pierLift;
  const h = heightFn ? heightFn(x, z) : 0;
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r - 0.15) return Math.max(h, 0.07);
  return h;
}

export function inWater(x: number, z: number, radius = 0) {
  if (onPier(x, z)) return false;
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r - 0.2 + radius) return false;
  return extraWater ? extraWater(x, z, radius) : false;
}

export const VILLAGE_BOUND = 200;
export const DUNGEON_BOUND = 168;
export const FENCE_R = 80;
export const FENCE_GATE = 3.8;

export function fenceBlocks(x: number, z: number, radius: number) {
  const dx = x - FENCE_POSE.x;
  const dz = z - FENCE_POSE.z;
  const c = Math.cos(FENCE_POSE.yaw);
  const s = Math.sin(FENCE_POSE.yaw);
  const lx = dx * c + dz * s;
  const lz = -dx * s + dz * c;
  const r = Math.hypot(lx, lz);
  if (Math.abs(r - FENCE_R) > 1.15 + radius) return false;
  if (Math.min(Math.abs(lx), Math.abs(lz)) < FENCE_GATE) return false;
  return true;
}

export function bridgeName(_x: number, _z: number) {
  return "";
}

const extras: Solid[] = [];

export function setExtraSolid(id: string, x: number, z: number, yaw: number, hw: number, hd: number) {
  const row: Solid = { x, z, c: Math.cos(yaw), s: Math.sin(yaw), hw, hd };
  const prev = extras.find((item) => (item as Solid & { id?: string }).id === id) as (Solid & { id?: string }) | undefined;
  if (prev) {
    prev.x = row.x;
    prev.z = row.z;
    prev.c = row.c;
    prev.s = row.s;
    prev.hw = hw;
    prev.hd = hd;
    return;
  }
  extras.push(Object.assign(row, { id }));
}

export function removeExtraSolid(id: string) {
  const index = extras.findIndex((item) => (item as Solid & { id?: string }).id === id);
  if (index >= 0) extras.splice(index, 1);
}

export function eachSolid(fn: (solid: { x: number; z: number; c: number; s: number; hw: number; hd: number }) => void) {
  for (const solid of SOLIDS) fn(solid);
  for (const solid of extras) fn(solid);
}

let heightFn: ((x: number, z: number) => number) | null = null;
let extraWater: ((x: number, z: number, radius: number) => boolean) | null = null;

export function bindGroundHeight(fn: ((x: number, z: number) => number) | null) {
  heightFn = fn;
}

export function bindExtraWater(fn: ((x: number, z: number, radius: number) => boolean) | null) {
  extraWater = fn;
}

const scratch = { x: 0, z: 0 };

export function blocked(x: number, z: number, radius: number) {
  for (let i = 0; i < SOLIDS.length; i++) {
    if (solidHits(SOLIDS[i]!, x, z, radius)) return true;
  }
  for (let i = 0; i < extras.length; i++) {
    if (solidHits(extras[i]!, x, z, radius)) return true;
  }
  for (let i = 0; i < CIRCLES.length; i++) {
    const c = CIRCLES[i]!;
    const dx = x - c.x;
    const dz = z - c.z;
    const rr = radius + c.r;
    if (dx * dx + dz * dz < rr * rr) return true;
  }
  if (fenceBlocks(x, z, radius)) return true;
  if (lakeBlocks(x, z, radius)) return true;
  if (pierSideBlocks(x, z, radius)) return true;
  if (!inPlayfield(x, z, radius)) return true;
  if (x < -640 || x > 640 || z < -640 || z > 640) return true;
  return false;
}

export function occluded(x: number, z: number, radius: number, y = 4) {
  for (const h of HOUSES) {
    const dx = x - h.x;
    const dz = z - h.z;
    const c = Math.cos(h.yaw);
    const s = Math.sin(h.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const hw = h.w / 2 + 0.55 + radius;
    const hd = h.d / 2 + 0.5 + radius;
    if (Math.abs(lx) < hw && Math.abs(lz) < hd && y < h.h + h.rh + 0.55) return true;
  }
  return false;
}

const DRY = [
  [0, 28],
  [0, 40],
  [0, -28],
  [22, 8],
  [-18, 8],
  [0, 54],
  [0, -54],
  [54, 0],
  [-54, 0],
];

export function dryLand(x: number, z: number, radius: number) {
  if (!inWater(x, z, 0)) return null;
  let bestX = 0;
  let bestZ = 20;
  let bestD = Infinity;
  for (const [sx, sz] of DRY) {
    if (blocked(sx!, sz!, radius)) continue;
    const d = (sx! - x) * (sx! - x) + (sz! - z) * (sz! - z);
    if (d < bestD) {
      bestD = d;
      bestX = sx!;
      bestZ = sz!;
    }
  }
  if (bestD === Infinity) return null;
  return { x: bestX, z: bestZ };
}

export function slide(x: number, z: number, nx: number, nz: number, radius: number) {
  if (!blocked(nx, nz, radius)) {
    scratch.x = nx;
    scratch.z = nz;
    return scratch;
  }
  if (!blocked(nx, z, radius)) {
    scratch.x = nx;
    scratch.z = z;
    return scratch;
  }
  if (!blocked(x, nz, radius)) {
    scratch.x = x;
    scratch.z = nz;
    return scratch;
  }
  scratch.x = x;
  scratch.z = z;
  return scratch;
}

export const MAP_MARKS = [
  { name: "Köy Muhafızı", x: 2.2, z: 2.5 },
  { name: "Kuyu", x: 0, z: 0 },
  { name: "Zırhçı", x: -24, z: -10 },
  { name: "Silahçı", x: 24, z: -10 },
  { name: "Satıcı", x: -12.9, z: 19.9 },
  { name: "Depo", x: 11.2, z: 24.2 },
  { name: "Seyis", x: 16.6, z: 16.4 },
  { name: "Demirci", x: -15.1, z: 18.3 },
  { name: "Balıkçı", x: 38.2, z: 60.2 },
  { name: "Madenci", x: 70, z: 10 },
];
{
  const fisherMark = MAP_MARKS.find((row) => row.name === "Balıkçı");
  if (fisherMark) {
    fisherMark.x = FISHER_STAND.x;
    fisherMark.z = FISHER_STAND.z;
  }
}

export const VEINS = [
  { x: 108, z: 36 },
  { x: -96, z: 72 },
  { x: 48, z: -128 },
  { x: -132, z: -28 },
  { x: 150, z: -55 },
  { x: 18, z: 150 },
  { x: 78, z: 488 },
  { x: -54, z: 352 },
  { x: 22, z: 540 },
  { x: 498, z: 62 },
  { x: 352, z: -48 },
  { x: 455, z: -88 },
  { x: -505, z: 36 },
  { x: -348, z: 70 },
  { x: -470, z: -78 },
];

export const REALMS = [
  { id: "koy", name: "Ana Köy", x: 0, z: 0, min: 1, max: 10 },
  { id: "koy2", name: "İkinci Köy", x: 0, z: 420, min: 10, max: 25 },
  { id: "dolunay", name: "Dolunay", x: 420, z: 0, min: 25, max: 40 },
  { id: "ay", name: "Sonsuz Ay", x: -420, z: 0, min: 40, max: 55 },
] as const;

export function realmAt(x: number, z: number) {
  let best: (typeof REALMS)[number] = REALMS[0];
  let bestD = Infinity;
  for (const realm of REALMS) {
    const d = Math.hypot(x - realm.x, z - realm.z);
    if (d < bestD) {
      bestD = d;
      best = realm;
    }
  }
  return bestD < 240 ? best : REALMS[0];
}

export function realmGate(id: string) {
  const realm = REALMS.find((row) => row.id === id) ?? REALMS[0];
  if (realm.id === "koy") return { x: -5.4, z: 7.2 };
  return { x: realm.x + 2.2, z: realm.z + 2.2 };
}

export function realmHerald(id: string) {
  const realm = REALMS.find((row) => row.id === id) ?? REALMS[0];
  if (realm.id === "koy") return { x: 2.2, z: 2.5 };
  return { x: realm.x - 2.2, z: realm.z + 2.2 };
}

const CAMP_LAYOUT = [
  { id: "rat", level: 2, realm: "koy", a: 0.4 },
  { id: "hare", level: 4, realm: "koy", a: 1.6 },
  { id: "wolf", level: 7, realm: "koy", a: 2.8 },
  { id: "frog", level: 10, realm: "koy", a: 4.3 },
  { id: "jackal", level: 12, realm: "koy2", a: 0.2 },
  { id: "boar", level: 16, realm: "koy2", a: 1.7 },
  { id: "spider", level: 20, realm: "koy2", a: 3.3 },
  { id: "scorp", level: 24, realm: "koy2", a: 4.8 },
  { id: "bear", level: 27, realm: "dolunay", a: 0.4 },
  { id: "skel", level: 31, realm: "dolunay", a: 2.0 },
  { id: "snake", level: 35, realm: "dolunay", a: 3.5 },
  { id: "goat", level: 39, realm: "dolunay", a: 5.0 },
  { id: "bandit", level: 42, realm: "ay", a: 0.5 },
  { id: "golem", level: 46, realm: "ay", a: 2.1 },
  { id: "bat", level: 50, realm: "ay", a: 3.6 },
  { id: "wraith", level: 54, realm: "ay", a: 5.0 },
] as const;

export type CampSpawn = {
  id: string;
  specId: string;
  level: number;
  realm: string;
  pack: number;
  x: number;
  z: number;
};

export function campSpawns(): CampSpawn[] {
  return CAMP_LAYOUT.flatMap((row, index) =>
    [0, 1, 2, 3, 4].map((n) => {
      const home = REALMS.find((item) => item.id === row.realm) ?? REALMS[0];
      const band = row.realm === "koy" ? 102 + (n % 3) * 20 : 46 + (n % 3) * 28;
      const angle = row.a + (n - 2) * 0.1;
      return {
        id: `${row.id}-${n}`,
        specId: row.id,
        level: row.level,
        realm: row.realm,
        pack: index,
        x: home.x + Math.cos(angle) * band,
        z: home.z + Math.sin(angle) * band,
      };
    }),
  );
}

export function inPlayfield(x: number, z: number, radius = 0) {
  for (let i = 0; i < REALMS.length; i++) {
    const realm = REALMS[i]!;
    const bound = realm.id === "koy" ? VILLAGE_BOUND : DUNGEON_BOUND;
    const dx = x - realm.x;
    const dz = z - realm.z;
    const limit = bound - 1.25 - radius;
    if (dx * dx + dz * dz <= limit * limit) return true;
  }
  return false;
}
export function zoneName(x: number, z: number) {
  const realm = realmAt(x, z);
  if (realm.id !== "koy") return realm.name;
  const spots = [
    { n: "Köy Merkezi", x: 0, z: 0, r: 16.6 },
    { n: "Demirci ve satıcı", x: -16, z: 20, r: 8 },
    { n: "Ahır", x: 22, z: 22, r: 6 },
    { n: "Usta salonu", x: 0, z: -29, r: 18 },
    { n: "Zırhçı", x: -26, z: 0, r: 6 },
    { n: "Silahçı", x: 26, z: 0, r: 6 },
    { n: "Pazar", x: -14, z: 18, r: 5 },
    { n: "Depo", x: 14, z: 30, r: 6 },
    { n: "Köy", x: 0, z: 0, r: 47 },
    { n: "Dış arazi", x: 0, z: 0, r: 170 },
  ];
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i]!;
    const dx = x - s.x;
    const dz = z - s.z;
    if (dx * dx + dz * dz < s.r * s.r) return s.n;
  }
  return "Demirköy";
}
