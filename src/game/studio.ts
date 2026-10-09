import * as THREE from "three";
import { readSim } from "@/game/input";
import { trackProp } from "@/game/creative";
import { bindExtraWater, bindGroundHeight, blocked, eachSolid, groundY } from "@/game/world";

const HALF = 640;
const N = 96;
const KEY = "abis-studio-v1";

export type Stamp = { id: string; prefab: string; x: number; y: number; z: number; yaw: number; scale: number };
export type Water = { id: string; kind: "gol" | "nehir" | "batak" | "lav"; x: number; z: number; r: number };
export type Zone = { id: string; kind: "guvenli" | "pvp" | "seviye" | "sehir"; x: number; z: number; r: number; level: number; name: string };
export type Spawner = { id: string; spec: string; x: number; z: number; roam: number; aggro: number; respawn: number; count: number; patrol: { x: number; z: number }[] };
export type Gather = { id: string; kind: "maden" | "bitki" | "sandik" | "gorev"; x: number; z: number; name: string };
export type Biome = { id: string; x: number; z: number; r: number; fog: string; name: string };
export type Marker = { id: string; kind: "dogma" | "mezar" | "taksi"; x: number; z: number; name: string };
export type Blueprint = { id: string; name: string; theme: string; parts: { prefab: string; dx: number; dy: number; dz: number; yaw: number; scale: number }[] };

type Doc = {
  stamps: Stamp[];
  waters: Water[];
  zones: Zone[];
  spawners: Spawner[];
  gathers: Gather[];
  biomes: Biome[];
  markers: Marker[];
  blueprints: Blueprint[];
  prices: Record<string, number>;
  hour: number | null;
};

const heights = new Float32Array((N + 1) * (N + 1));
const paints = new Uint8Array((N + 1) * (N + 1));
let doc: Doc = emptyDoc();
let tool = "sec";
let brush = 14;
let power = 0.35;
let paintId = 0;
let scatter = "agac";
let waterKind: Water["kind"] = "gol";
let waterR = 8;
let zoneKind: Zone["kind"] = "guvenli";
let zoneR = 18;
let zoneLevel = 1;
let showNav = false;
let showHit = false;
let showMan = false;
let playtest = false;
let manX = 0;
let manZ = 10;
let measure: { x: number; z: number }[] = [];
let painting = false;
let paintPoint = { x: 0, y: 0, active: false };
let note = "";
let version = 0;
const listeners = new Set<() => void>();
const undo: { h: Float32Array; p: Uint8Array; doc: string }[] = [];
const redo: { h: Float32Array; p: Uint8Array; doc: string }[] = [];

let sceneRef: THREE.Scene | null = null;
let terrain: THREE.Mesh | null = null;
let visuals: THREE.Group | null = null;
let nav: THREE.InstancedMesh | null = null;
let hitLines: THREE.LineSegments | null = null;
let mannequin: THREE.Group | null = null;
let measureLine: THREE.Line | null = null;
const colors = [new THREE.Color("#6f8f45"), new THREE.Color("#6a5038"), new THREE.Color("#8d8882"), new THREE.Color("#d2c091")];

function emptyDoc(): Doc {
  return { stamps: [], waters: [], zones: [], spawners: [], gathers: [], biomes: [], markers: [], blueprints: [], prices: {}, hour: null };
}

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

function bump() {
  version += 1;
  for (const fn of listeners) fn();
}

function cellIndex(ix: number, iz: number) {
  return iz * (N + 1) + ix;
}

export function sampleHeight(x: number, z: number) {
  const u = ((x + HALF) / (HALF * 2)) * N;
  const v = ((z + HALF) / (HALF * 2)) * N;
  if (u < 0 || v < 0 || u > N || v > N) return 0;
  const x0 = Math.floor(u);
  const z0 = Math.floor(v);
  const x1 = Math.min(N, x0 + 1);
  const z1 = Math.min(N, z0 + 1);
  const tx = u - x0;
  const tz = v - z0;
  const h00 = heights[cellIndex(x0, z0)] ?? 0;
  const h10 = heights[cellIndex(x1, z0)] ?? 0;
  const h01 = heights[cellIndex(x0, z1)] ?? 0;
  const h11 = heights[cellIndex(x1, z1)] ?? 0;
  return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
}

function pushUndo() {
  undo.push({ h: heights.slice(), p: paints.slice(), doc: JSON.stringify(doc) });
  if (undo.length > 24) undo.shift();
  redo.length = 0;
}

function applySnap(snap: { h: Float32Array; p: Uint8Array; doc: string }) {
  heights.set(snap.h);
  paints.set(snap.p);
  doc = JSON.parse(snap.doc) as Doc;
  syncTerrain();
  rebuildVisuals();
  saveLocal();
  bump();
}

export function studioUndo() {
  const snap = undo.pop();
  if (!snap) return;
  redo.push({ h: heights.slice(), p: paints.slice(), doc: JSON.stringify(doc) });
  applySnap(snap);
}

export function studioRedo() {
  const snap = redo.pop();
  if (!snap) return;
  undo.push({ h: heights.slice(), p: paints.slice(), doc: JSON.stringify(doc) });
  applySnap(snap);
}

function saveLocal() {
  try {
    const pack = {
      doc,
      h: Array.from(heights),
      p: Array.from(paints),
    };
    localStorage.setItem(KEY, JSON.stringify(pack));
  } catch {
    /* ignore */
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const pack = JSON.parse(raw) as { doc?: Doc; h?: number[]; p?: number[] };
    if (pack.doc) doc = { ...emptyDoc(), ...pack.doc };
    if (pack.h && pack.h.length === heights.length) heights.set(pack.h);
    if (pack.p && pack.p.length === paints.length) paints.set(pack.p);
  } catch {
    /* ignore */
  }
}

if (typeof localStorage !== "undefined") loadLocal();

function syncTerrain() {
  if (!terrain) return;
  const pos = terrain.geometry.attributes.position as THREE.BufferAttribute;
  const col = terrain.geometry.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const u = ((x + HALF) / (HALF * 2)) * N;
    const v = ((z + HALF) / (HALF * 2)) * N;
    const ix = Math.max(0, Math.min(N, Math.round(u)));
    const iz = Math.max(0, Math.min(N, Math.round(v)));
    pos.setY(i, heights[cellIndex(ix, iz)] ?? 0);
    const tint = colors[paints[cellIndex(ix, iz)] ?? 0] ?? colors[0]!;
    col.setXYZ(i, tint.r, tint.g, tint.b);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  terrain.geometry.computeVertexNormals();
}

function stampMesh(prefab: string) {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#b7aa96", roughness: 0.86 });
  const wood = new THREE.MeshStandardMaterial({ color: "#6b4a32", roughness: 0.8 });
  const leaf = new THREE.MeshLambertMaterial({ color: "#3f6a34" });
  if (prefab === "ev" || prefab === "harabe" || prefab === "col") {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.8, 4.4), prefab === "col" ? new THREE.MeshStandardMaterial({ color: "#d8c39a" }) : prefab === "harabe" ? new THREE.MeshStandardMaterial({ color: "#6e675e" }) : stone);
    wall.position.y = 1.4;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.6, 4), wood);
    roof.position.y = 3.4;
    roof.rotation.y = Math.PI / 4;
    group.add(wall, roof);
  } else if (prefab === "lamba") {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), wood);
    post.position.y = 1.1;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: "#ffd089" }));
    lamp.position.y = 2.2;
    group.add(post, lamp);
  } else if (prefab === "sandik") {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.5), wood);
    box.position.y = 0.28;
    group.add(box);
  } else if (prefab === "cali") {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.55, 7, 6), leaf);
    bush.position.y = 0.4;
    bush.scale.y = 0.7;
    group.add(bush);
  } else if (prefab === "kaya") {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), stone);
    rock.position.y = 0.4;
    group.add(rock);
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.4, 6), wood);
    trunk.position.y = 0.7;
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), leaf);
    top.position.y = 1.8;
    group.add(trunk, top);
  }
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return group;
}

const PREFAB_KIND: Record<string, string> = {
  ev: "bina",
  harabe: "bina",
  col: "bina",
  lamba: "bina",
  sandik: "bina",
  cali: "ağaç",
  kaya: "ağaç",
  agac: "ağaç",
};

const PREFAB_LABEL: Record<string, string> = {
  ev: "Köy evi",
  harabe: "Harabe",
  col: "Çöl evi",
  lamba: "Sokak lambası",
  sandik: "Sandık",
  cali: "Çalı",
  kaya: "Kaya",
  agac: "Ağaç",
};

function placeStamp(stamp: Stamp, parent: THREE.Group) {
  const mesh = stampMesh(stamp.prefab);
  mesh.position.set(stamp.x, stamp.y, stamp.z);
  mesh.rotation.y = stamp.yaw;
  mesh.scale.setScalar(stamp.scale);
  parent.add(mesh);
  trackProp({
    id: stamp.id,
    label: PREFAB_LABEL[stamp.prefab] ?? stamp.prefab,
    kind: PREFAB_KIND[stamp.prefab] ?? "bina",
    object: mesh,
    base: { x: stamp.x, y: stamp.y, z: stamp.z, yaw: stamp.yaw },
    solid: stamp.prefab === "ev" || stamp.prefab === "harabe" || stamp.prefab === "col" ? { hw: 3.3, hd: 2.4 } : undefined,
  });
}

function rebuildVisuals() {
  if (!visuals) return;
  visuals.clear();
  for (const stamp of doc.stamps) placeStamp(stamp, visuals);
  const waterMat = (kind: Water["kind"]) =>
    new THREE.MeshStandardMaterial({
      color: kind === "lav" ? "#ff5a1f" : kind === "batak" ? "#3d4a32" : kind === "nehir" ? "#2f7f86" : "#1a6e78",
      transparent: true,
      opacity: kind === "batak" ? 0.78 : 0.88,
      roughness: 0.2,
      emissive: kind === "lav" ? "#ff3b00" : "#000000",
      emissiveIntensity: kind === "lav" ? 0.6 : 0,
    });
  for (const water of doc.waters) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(water.r, 28), waterMat(water.kind));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(water.x, sampleHeight(water.x, water.z) + (water.kind === "nehir" ? 0.08 : 0.12), water.z);
    mesh.userData.editId = water.id;
    visuals.add(mesh);
    trackProp({
      id: water.id,
      label: water.kind === "gol" ? "Göl" : water.kind === "nehir" ? "Nehir" : water.kind === "batak" ? "Bataklık" : "Lav",
      kind: "bina",
      object: mesh,
      base: { x: water.x, y: mesh.position.y, z: water.z, yaw: 0 },
    });
  }
  const zoneColor: Record<Zone["kind"], string> = { guvenli: "#7dcea0", pvp: "#e07474", seviye: "#e6c36a", sehir: "#8eb4e6" };
  for (const zone of doc.zones) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.4, zone.r - 0.35), zone.r, 40),
      new THREE.MeshBasicMaterial({ color: zoneColor[zone.kind], transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(zone.x, sampleHeight(zone.x, zone.z) + 0.2, zone.z);
    visuals.add(ring);
  }
  for (const sp of doc.spawners) {
    const pin = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: "#e07070" }));
    pin.position.set(sp.x, sampleHeight(sp.x, sp.z) + 1.2, sp.z);
    visuals.add(pin);
  }
  for (const node of doc.gathers) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: node.kind === "sandik" ? "#c9a15b" : node.kind === "bitki" ? "#7eb06a" : node.kind === "gorev" ? "#d0d6de" : "#8a7048" }));
    pin.position.set(node.x, sampleHeight(node.x, node.z) + 0.35, node.z);
    visuals.add(pin);
  }
  for (const marker of doc.markers) {
    const pin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 6), new THREE.MeshBasicMaterial({ color: marker.kind === "mezar" ? "#9aa0a8" : marker.kind === "taksi" ? "#7aa0d4" : "#f2f0ea" }));
    pin.position.set(marker.x, sampleHeight(marker.x, marker.z) + 0.7, marker.z);
    visuals.add(pin);
  }
  for (const biome of doc.biomes) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.4, biome.r - 0.4), biome.r, 36),
      new THREE.MeshBasicMaterial({ color: biome.fog, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(biome.x, sampleHeight(biome.x, biome.z) + 0.25, biome.z);
    visuals.add(ring);
  }
}

function sculpted() {
  for (let i = 0; i < heights.length; i++) if ((heights[i] ?? 0) !== 0 || (paints[i] ?? 0) !== 0) return true;
  return false;
}

export function studioWet(x: number, z: number, radius = 0) {
  return doc.waters.some((water) => water.kind !== "lav" && Math.hypot(x - water.x, z - water.z) < water.r + radius);
}

export function mountStudio(scene: THREE.Scene) {
  sceneRef = scene;
  if (terrain) return;
  const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, N, N);
  geo.rotateX(-Math.PI / 2);
  const count = geo.attributes.position.count;
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  terrain = new THREE.Mesh(geo, mat);
  terrain.name = "studio-terrain";
  terrain.receiveShadow = true;
  scene.add(terrain);
  visuals = new THREE.Group();
  visuals.name = "studio-visuals";
  scene.add(visuals);
  bindGroundHeight(sampleHeight);
  bindExtraWater(studioWet);
  syncTerrain();
  rebuildVisuals();
  const navGeo = new THREE.PlaneGeometry(3.2, 3.2);
  navGeo.rotateX(-Math.PI / 2);
  nav = new THREE.InstancedMesh(navGeo, new THREE.MeshBasicMaterial({ color: "#7dcea0", transparent: true, opacity: 0.28, depthWrite: false }), 64);
  nav.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3), 3);
  nav.visible = false;
  scene.add(nav);
  hitLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#ff5577" }));
  hitLines.visible = false;
  scene.add(hitLines);
  mannequin = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 4, 8), new THREE.MeshStandardMaterial({ color: "#d7c4a4" }));
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: "#e6d2b8" }));
  head.position.y = 1.72;
  mannequin.add(body, head);
  mannequin.visible = false;
  scene.add(mannequin);
  measureLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: "#ffe08a" }));
  measureLine.visible = false;
  scene.add(measureLine);
}

export function unmountStudio() {
  bindGroundHeight(null);
  bindExtraWater(null);
  if (sceneRef) {
    const ground = sceneRef.getObjectByName("season-ground");
    if (ground) ground.visible = true;
    for (const obj of [terrain, visuals, nav, hitLines, mannequin, measureLine]) {
      if (obj) sceneRef.remove(obj);
    }
  }
  terrain = null;
  visuals = null;
  nav = null;
  hitLines = null;
  mannequin = null;
  measureLine = null;
  sceneRef = null;
}

function brushAt(x: number, z: number) {
  const radius = brush;
  const minX = Math.max(0, Math.floor(((x - radius + HALF) / (HALF * 2)) * N));
  const maxX = Math.min(N, Math.ceil(((x + radius + HALF) / (HALF * 2)) * N));
  const minZ = Math.max(0, Math.floor(((z - radius + HALF) / (HALF * 2)) * N));
  const maxZ = Math.min(N, Math.ceil(((z + radius + HALF) / (HALF * 2)) * N));
  const center = tool === "duz" ? sampleHeight(x, z) : 0;
  for (let iz = minZ; iz <= maxZ; iz++) {
    for (let ix = minX; ix <= maxX; ix++) {
      const wx = (ix / N) * HALF * 2 - HALF;
      const wz = (iz / N) * HALF * 2 - HALF;
      const d = Math.hypot(wx - x, wz - z);
      if (d > radius) continue;
      const fall = 1 - d / radius;
      const at = cellIndex(ix, iz);
      if (tool === "boya") {
        paints[at] = paintId;
        continue;
      }
      let h = heights[at] ?? 0;
      if (tool === "yukselt") h += power * fall;
      else if (tool === "alcalt") h -= power * fall;
      else if (tool === "duz") h += (center - h) * 0.45 * fall;
      else if (tool === "yumusat") {
        let acc = 0;
        let n = 0;
        for (let oz = -1; oz <= 1; oz++) {
          for (let ox = -1; ox <= 1; ox++) {
            const jx = ix + ox;
            const jz = iz + oz;
            if (jx < 0 || jz < 0 || jx > N || jz > N) continue;
            acc += heights[cellIndex(jx, jz)] ?? 0;
            n += 1;
          }
        }
        h += ((acc / Math.max(1, n)) - h) * 0.55 * fall;
      } else if (tool === "noise") h += (Math.sin(wx * 0.7 + wz * 0.5) * 0.5 + (Math.random() - 0.5)) * power * fall;
      heights[at] = Math.max(-12, Math.min(48, h));
    }
  }
  syncTerrain();
}

function scatterAt(x: number, z: number) {
  pushUndo();
  const count = 4 + Math.floor(brush / 6);
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * brush;
    const px = x + Math.cos(ang) * dist;
    const pz = z + Math.sin(ang) * dist;
    doc.stamps.push({
      id: `pf-${uid()}`,
      prefab: scatter,
      x: px,
      y: sampleHeight(px, pz),
      z: pz,
      yaw: Math.random() * Math.PI * 2,
      scale: 0.75 + Math.random() * 0.7,
    });
  }
  rebuildVisuals();
  saveLocal();
  bump();
}

export function studioCapturesLeft() {
  return tool !== "sec";
}

export function studioPointer(x: number, y: number, phase: "down" | "move" | "up") {
  paintPoint = { x, y, active: phase !== "up" };
  if (phase === "down") {
    painting = true;
    if (tool !== "serp" && tool !== "olc") pushUndo();
  }
  if (phase === "up") {
    painting = false;
    saveLocal();
  }
}

export function studioRay(raycaster: THREE.Raycaster) {
  if (!painting || !terrain) return;
  const hits = raycaster.intersectObject(terrain, false);
  const hit = hits[0]?.point;
  if (!hit) return;
  if (tool === "olc") {
    if (paintPoint.active) {
      measure = [...measure, { x: hit.x, z: hit.z }].slice(-2);
      painting = false;
      if (measureLine && measure.length === 2) {
        const a = measure[0]!;
        const b = measure[1]!;
        measureLine.geometry.dispose();
        measureLine.geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(a.x, sampleHeight(a.x, a.z) + 0.4, a.z),
          new THREE.Vector3(b.x, sampleHeight(b.x, b.z) + 0.4, b.z),
        ]);
        measureLine.visible = true;
        note = `${Math.hypot(a.x - b.x, a.z - b.z).toFixed(2)} m`;
      }
      bump();
    }
    return;
  }
  if (tool === "serp") {
    if (paintPoint.active) {
      scatterAt(hit.x, hit.z);
      painting = false;
    }
    return;
  }
  brushAt(hit.x, hit.z);
}

export function studioPaintPoint() {
  return paintPoint;
}

export function studioPainting() {
  return painting;
}

export function eraseStudio(id: string) {
  const next = {
    stamps: doc.stamps.filter((row) => row.id !== id),
    waters: doc.waters.filter((row) => row.id !== id),
    zones: doc.zones.filter((row) => row.id !== id),
    spawners: doc.spawners.filter((row) => row.id !== id),
    gathers: doc.gathers.filter((row) => row.id !== id),
    biomes: doc.biomes.filter((row) => row.id !== id),
    markers: doc.markers.filter((row) => row.id !== id),
  };
  const changed =
    next.stamps.length !== doc.stamps.length ||
    next.waters.length !== doc.waters.length ||
    next.zones.length !== doc.zones.length ||
    next.spawners.length !== doc.spawners.length ||
    next.gathers.length !== doc.gathers.length ||
    next.biomes.length !== doc.biomes.length ||
    next.markers.length !== doc.markers.length;
  if (!changed) return false;
  pushUndo();
  doc = { ...doc, ...next };
  rebuildVisuals();
  saveLocal();
  note = "Silindi";
  bump();
  return true;
}

export function studioTool() {
  return tool;
}

export function setStudioTool(next: string) {
  tool = next;
  note = "";
  bump();
}

export function setBrush(next: number) {
  brush = next;
  bump();
}

export function setPower(next: number) {
  power = next;
  bump();
}

export function setPaintId(next: number) {
  paintId = next;
  tool = "boya";
  bump();
}

export function setScatter(next: string) {
  scatter = next;
  tool = "serp";
  bump();
}

function here() {
  const sim = readSim();
  return { x: sim.x, z: sim.z, y: groundY(sim.x, sim.z) };
}

export function placePrefab(prefab: string) {
  pushUndo();
  const spot = here();
  const yaw = readSim().yaw;
  doc.stamps.push({
    id: `pf-${uid()}`,
    prefab,
    x: spot.x + Math.sin(yaw) * 3,
    y: spot.y,
    z: spot.z + Math.cos(yaw) * 3,
    yaw,
    scale: 1,
  });
  rebuildVisuals();
  saveLocal();
  note = `${PREFAB_LABEL[prefab] ?? prefab} kondu`;
  bump();
}

export function placeWater() {
  pushUndo();
  const spot = here();
  doc.waters.push({ id: `wt-${uid()}`, kind: waterKind, x: spot.x, z: spot.z, r: waterR });
  rebuildVisuals();
  saveLocal();
  bump();
}

export function setWaterKind(kind: Water["kind"]) {
  waterKind = kind;
  bump();
}

export function setWaterR(r: number) {
  waterR = r;
  bump();
}

export function placeZone(name: string) {
  pushUndo();
  const spot = here();
  doc.zones.push({ id: `zn-${uid()}`, kind: zoneKind, x: spot.x, z: spot.z, r: zoneR, level: zoneLevel, name: name || "Bölge" });
  rebuildVisuals();
  saveLocal();
  bump();
}

export function setZoneKind(kind: Zone["kind"]) {
  zoneKind = kind;
  bump();
}

export function setZoneR(r: number) {
  zoneR = r;
  bump();
}

export function setZoneLevel(level: number) {
  zoneLevel = level;
  bump();
}

export function placeSpawner(spec: string) {
  pushUndo();
  const spot = here();
  doc.spawners.push({ id: uid(), spec, x: spot.x, z: spot.z, roam: 18, aggro: 8, respawn: 25, count: 3, patrol: [] });
  rebuildVisuals();
  saveLocal();
  bump();
}

export function patchSpawner(id: string, patch: Partial<Spawner>) {
  const row = doc.spawners.find((item) => item.id === id);
  if (!row) return;
  Object.assign(row, patch);
  saveLocal();
  bump();
}

export function addPatrolPoint(id: string) {
  const row = doc.spawners.find((item) => item.id === id);
  if (!row) return;
  const spot = here();
  row.patrol = [...row.patrol, { x: spot.x, z: spot.z }];
  saveLocal();
  bump();
}

export function placeGather(kind: Gather["kind"]) {
  pushUndo();
  const spot = here();
  const name = kind === "maden" ? "Maden" : kind === "bitki" ? "Bitki" : kind === "sandik" ? "Sandık" : "Görev";
  doc.gathers.push({ id: `ga-${uid()}`, kind, x: spot.x, z: spot.z, name });
  rebuildVisuals();
  saveLocal();
  bump();
}

export function placeMarker(kind: Marker["kind"]) {
  pushUndo();
  const spot = here();
  doc.markers.push({ id: `mk-${uid()}`, kind, x: spot.x, z: spot.z, name: kind });
  rebuildVisuals();
  saveLocal();
  bump();
}

export function placeBiome(name: string, fog: string) {
  pushUndo();
  const spot = here();
  doc.biomes.push({ id: `bi-${uid()}`, x: spot.x, z: spot.z, r: 36, fog, name: name || "Biyom" });
  rebuildVisuals();
  saveLocal();
  bump();
}

export function saveBlueprint(name: string) {
  const spot = here();
  const parts = doc.stamps
    .filter((stamp) => Math.hypot(stamp.x - spot.x, stamp.z - spot.z) < 18)
    .map((stamp) => ({ prefab: stamp.prefab, dx: stamp.x - spot.x, dy: stamp.y - spot.y, dz: stamp.z - spot.z, yaw: stamp.yaw, scale: stamp.scale }));
  if (!parts.length) {
    note = "Yakında kayıtlı obje yok";
    bump();
    return;
  }
  doc.blueprints.push({ id: uid(), name: name || "Şablon", theme: "Köy", parts });
  saveLocal();
  note = `${parts.length} parça şablon oldu`;
  bump();
}

export function placeBlueprint(id: string) {
  const print = doc.blueprints.find((item) => item.id === id);
  if (!print) return;
  pushUndo();
  const spot = here();
  for (const part of print.parts) {
    doc.stamps.push({
      id: `pf-${uid()}`,
      prefab: part.prefab,
      x: spot.x + part.dx,
      y: spot.y + part.dy,
      z: spot.z + part.dz,
      yaw: part.yaw,
      scale: part.scale,
    });
  }
  rebuildVisuals();
  saveLocal();
  bump();
}

export function forgetBlueprint(id: string) {
  doc.blueprints = doc.blueprints.filter((item) => item.id !== id);
  saveLocal();
  bump();
}

export function setHour(hour: number | null) {
  doc.hour = hour;
  saveLocal();
  bump();
}

export function rememberPrice(id: string, price: number) {
  doc.prices[id] = price;
  saveLocal();
  bump();
}

export function priceOf(id: string, fallback: number) {
  const value = doc.prices[id];
  return typeof value === "number" ? value : fallback;
}

export function studioSafe(x: number, z: number) {
  return doc.zones.some((zone) => zone.kind === "guvenli" && Math.hypot(x - zone.x, z - zone.z) < zone.r);
}

export function studioZoneName(x: number, z: number) {
  const zone = doc.zones.find((item) => Math.hypot(x - item.x, z - item.z) < item.r);
  if (!zone) return "";
  if (zone.kind === "pvp") return "PvP";
  if (zone.kind === "guvenli") return "Güvenli";
  if (zone.kind === "sehir") return zone.name || "Şehir";
  return `${zone.name || "Seviye"} ${zone.level}+`;
}

export function studioLevelBlock(x: number, z: number, level: number) {
  const zone = doc.zones.find((item) => item.kind === "seviye" && Math.hypot(x - item.x, z - item.z) < item.r);
  if (!zone || level >= zone.level) return "";
  return `${zone.name}: seviye ${zone.level} gerekir`;
}

export function studioGrave(x: number, z: number) {
  let best: Marker | null = null;
  let bestD = 220;
  for (const marker of doc.markers) {
    if (marker.kind !== "mezar") continue;
    const d = Math.hypot(marker.x - x, marker.z - z);
    if (d < bestD) {
      bestD = d;
      best = marker;
    }
  }
  return best ? { x: best.x, z: best.z } : null;
}

export function studioClimate() {
  const spot = here();
  const biome = doc.biomes.find((item) => Math.hypot(spot.x - item.x, spot.z - item.z) < item.r);
  return { hour: doc.hour, fog: biome?.fog ?? null, name: biome?.name ?? "" };
}

export function studioSpawners() {
  return doc.spawners;
}

export function studioGathers() {
  return doc.gathers;
}

export function setPlaytest(next: boolean) {
  playtest = next;
  bump();
}

export function studioPlaytest() {
  return playtest;
}

let hop = 0;
let vy = 0;
export function studioHop(dt: number, jump: boolean) {
  if (!playtest) {
    hop = 0;
    vy = 0;
    return 0;
  }
  if (jump && hop <= 0.04) vy = 6.4;
  vy -= 18 * dt;
  hop = Math.max(0, hop + vy * dt);
  if (hop === 0) vy = 0;
  return hop;
}

export function toggleNav(next: boolean) {
  showNav = next;
  if (nav) nav.visible = next;
  bump();
}

export function toggleHit(next: boolean) {
  showHit = next;
  if (hitLines) hitLines.visible = next;
  bump();
}

export function pinMannequin() {
  const spot = here();
  manX = spot.x;
  manZ = spot.z;
  showMan = true;
  if (mannequin) mannequin.visible = true;
  bump();
}

export function toggleMan(next: boolean) {
  showMan = next;
  if (mannequin) mannequin.visible = next;
  bump();
}

let navTick = 0;
export function tickStudio(dt: number, x: number, z: number) {
  const shaped = sculpted();
  if (terrain) terrain.visible = shaped;
  const ground = sceneRef?.getObjectByName("season-ground");
  if (ground) ground.visible = !shaped;
  if (showMan && mannequin) mannequin.position.set(manX, sampleHeight(manX, manZ), manZ);
  navTick -= dt;
  if (showNav && nav && navTick <= 0) {
    navTick = 0.45;
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    let n = 0;
    for (let iz = -4; iz <= 4; iz++) {
      for (let ix = -4; ix <= 4 && n < 64; ix++) {
        const px = x + ix * 6;
        const pz = z + iz * 6;
        const bad = blocked(px, pz, 0.4);
        dummy.position.set(px, sampleHeight(px, pz) + 0.15, pz);
        dummy.scale.setScalar(bad ? 0.35 : 1);
        dummy.updateMatrix();
        nav.setMatrixAt(n, dummy.matrix);
        nav.setColorAt(n, tint.set(bad ? "#e07474" : "#7dcea0"));
        n += 1;
      }
    }
    nav.count = n;
    nav.instanceMatrix.needsUpdate = true;
    if (nav.instanceColor) nav.instanceColor.needsUpdate = true;
  }
  if (showHit && hitLines) {
    const pts: number[] = [];
    eachSolid((solid) => {
      const hw = solid.hw;
      const hd = solid.hd;
      const c = solid.c;
      const s = solid.s;
      const corners = [
        [-hw, -hd],
        [hw, -hd],
        [hw, hd],
        [-hw, hd],
      ];
      const world = corners.map(([lx, lz]) => [solid.x + lx * c + lz * s, solid.z - lx * s + lz * c]);
      for (let i = 0; i < 4; i++) {
        const a = world[i]!;
        const b = world[(i + 1) % 4]!;
        pts.push(a[0]!, 0.4, a[1]!, b[0]!, 0.4, b[1]!);
      }
    });
    hitLines.geometry.dispose();
    hitLines.geometry = new THREE.BufferGeometry();
    hitLines.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  }
}

export function subscribeStudio(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function studioVersion() {
  return version;
}

export function studioView() {
  const dist = measure.length === 2 ? Math.hypot(measure[0]!.x - measure[1]!.x, measure[0]!.z - measure[1]!.z) : 0;
  return {
    tool,
    brush,
    power,
    paintId,
    scatter,
    waterKind,
    waterR,
    zoneKind,
    zoneR,
    zoneLevel,
    showNav,
    showHit,
    showMan,
    playtest,
    hour: doc.hour,
    note,
    dist,
    blueprints: doc.blueprints,
    spawners: doc.spawners,
    zones: doc.zones,
    prices: doc.prices,
    prefabs: Object.keys(PREFAB_LABEL),
  };
}

export const PREFAB_THEMES: Record<string, string> = {
  ev: "Köy",
  lamba: "Köy",
  sandik: "Köy",
  harabe: "Harabe",
  col: "Çöl",
  agac: "Doğa",
  cali: "Doğa",
  kaya: "Doğa",
};
