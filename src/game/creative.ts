import * as THREE from "three";
import { getWorldLayout, saveWorldLayout, CREATIVE_EMAIL, CREATIVE_NAME } from "@/game/creativeAccount";
import { setFencePose, setHousePose, setHutPose, setLakePose, setPierPose, setRealmCenter, setTreePose, setVeinPose, setWellPose, moveMark, setExtraSolid, removeExtraSolid, groundY } from "@/game/world";

export type Pose = { x: number; y: number; z: number; yaw: number };

type Entry = {
  id: string;
  label: string;
  kind: string;
  object: THREE.Object3D;
  base: Pose;
  houseId?: string;
  hut?: boolean;
  lake?: boolean;
  pier?: { len: number; half: number };
  treeIndex?: number;
  veinIndex?: number;
  well?: boolean;
  fence?: boolean;
  realmId?: string;
  realmAt?: { x: number; z: number };
  mark?: string;
  solid?: { hw: number; hd: number };
};

const KEY = "abis-layout-v1";
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let overrides: Record<string, Pose> = {};
let dirty = false;
let selected = "";
let moveStep = 0.01;
let rotStep = 0.1;
let armed = false;
let note = "";
let version = 0;
let helper: THREE.BoxHelper | null = null;
let helperScene: THREE.Scene | null = null;
let mask = "hepsi";
const hidden = new Set<string>();
const scales = new Map<string, number>();

function bump() {
  version += 1;
  for (const fn of listeners) fn();
}

function writeLocal() {
  try {
    const scaleObj: Record<string, number> = {};
    for (const [id, value] of scales) scaleObj[id] = value;
    localStorage.setItem(KEY, JSON.stringify({ poses: overrides, dirty, hidden: [...hidden], scales: scaleObj }));
  } catch {
    /* private mode */
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as { poses?: Record<string, Pose>; dirty?: boolean; hidden?: string[]; scales?: Record<string, number> };
    if (data.poses && typeof data.poses === "object") overrides = data.poses;
    dirty = Boolean(data.dirty);
    for (const id of data.hidden ?? []) hidden.add(id);
    for (const [id, value] of Object.entries(data.scales ?? {})) {
      if (typeof value === "number") scales.set(id, value);
    }
  } catch {
    /* ignore */
  }
}

if (typeof localStorage !== "undefined") loadLocal();

function paint(entry: Entry, pose: Pose) {
  entry.object.position.set(pose.x, pose.y, pose.z);
  entry.object.rotation.y = pose.yaw;
  if (entry.houseId) setHousePose(entry.houseId, pose.x, pose.z, pose.yaw);
  if (entry.hut) setHutPose(pose.x, pose.z, pose.yaw);
  if (entry.lake) setLakePose(pose.x, pose.z);
  if (entry.pier) setPierPose(pose.x, pose.z, pose.yaw, pose.y, entry.pier.len, entry.pier.half);
  if (entry.treeIndex != null && entry.treeIndex >= 0) setTreePose(entry.treeIndex, pose.x, pose.z);
  if (entry.veinIndex != null) setVeinPose(entry.veinIndex, pose.x, pose.z);
  if (entry.well) setWellPose(pose.x, pose.z);
  if (entry.fence) setFencePose(pose.x, pose.z, pose.yaw);
  if (entry.realmId && entry.realmAt) setRealmCenter(entry.realmId, entry.realmAt.x + pose.x, entry.realmAt.z + pose.z);
  if (entry.mark) moveMark(entry.mark, pose.x, pose.z);
  if (entry.solid) setExtraSolid(entry.id, pose.x, pose.z, pose.yaw, entry.solid.hw * (scales.get(entry.id) ?? 1), entry.solid.hd * (scales.get(entry.id) ?? 1));
  const scale = scales.get(entry.id);
  if (scale) entry.object.scale.setScalar(scale);
  entry.object.visible = !hidden.has(entry.id);
}

function applyAll() {
  for (const entry of entries.values()) {
    const pose = overrides[entry.id];
    if (pose) paint(entry, pose);
  }
}

export function trackProp(spec: Entry) {
  entries.set(spec.id, spec);
  const pose = overrides[spec.id] ?? spec.base;
  paint(spec, pose);
  spec.object.traverse((obj) => {
    obj.userData.editId = spec.id;
  });
  bump();
}

export function clearEditables() {
  entries.clear();
  selected = "";
  if (helper && helperScene) helperScene.remove(helper);
  helper = null;
  bump();
}

export function bindCreativeScene(scene: THREE.Scene) {
  helperScene = scene;
}

export function tickCreative() {
  const entry = entries.get(selected);
  if (!helperScene || !entry) {
    if (helper) helper.visible = false;
    return;
  }
  if (!helper) {
    helper = new THREE.BoxHelper(entry.object, 0xffcc66);
    helperScene.add(helper);
  }
  helper.setFromObject(entry.object);
  helper.visible = armed;
}

export function pickEditable(raycaster: THREE.Raycaster) {
  const roots = [...entries.values()].map((entry) => entry.object);
  const hits = raycaster.intersectObjects(roots, true);
  for (const hit of hits) {
    let obj: THREE.Object3D | null = hit.object;
    while (obj) {
      const id = obj.userData.editId;
      if (typeof id === "string" && entries.has(id) && !hidden.has(id)) {
        const kind = entries.get(id)?.kind ?? "";
        if (mask === "hepsi" || kind === mask || (mask === "kopya" && id.startsWith("copy-"))) return id;
      }
      obj = obj.parent;
    }
  }
  return null;
}

export function selectEditable(id: string) {
  if (!entries.has(id)) return;
  selected = id;
  note = "";
  bump();
}

export function editArmed() {
  return armed;
}

export function setEditArmed(next: boolean) {
  armed = next;
  note = next ? "Ok taşır, Q/E döndürür, R/F yükseltir. J zıplar (test). WASD yürür." : "";
  bump();
}

export function setEditMask(next: string) {
  mask = next;
  bump();
}

export function copySelected() {
  const entry = entries.get(selected);
  if (!entry || !helperScene || hidden.has(entry.id)) return;
  const clone = entry.object.clone(true);
  clone.position.x += 3;
  clone.traverse((obj) => {
    delete obj.userData.editId;
  });
  helperScene.add(clone);
  const id = `copy-${Date.now().toString(36)}`;
  const pose = poseOf(entry);
  trackProp({
    id,
    label: `${entry.label} kopya`,
    kind: entry.kind,
    object: clone,
    base: { x: pose.x + 3, y: pose.y, z: pose.z, yaw: pose.yaw },
    solid: entry.solid ? { ...entry.solid } : entry.kind === "bina" ? { hw: 3.2, hd: 2.4 } : undefined,
  });
  selectEditable(id);
}

export function forgetEditable(id: string) {
  const entry = entries.get(id);
  if (!entry) return;
  removeExtraSolid(id);
  entry.object.parent?.remove(entry.object);
  entries.delete(id);
  hidden.delete(id);
  if (selected === id) selected = "";
  bump();
}

export function deleteSelected() {
  const entry = entries.get(selected);
  if (!entry) return;
  hidden.add(entry.id);
  removeExtraSolid(entry.id);
  if (entry.houseId) setHousePose(entry.houseId, 9000, 9000, 0);
  if (entry.hut) setHutPose(9000, 9000, 0);
  entry.object.visible = false;
  dirty = true;
  writeLocal();
  note = `${entry.label} silindi`;
  bump();
}

export function restoreSelected() {
  const entry = entries.get(selected);
  if (!entry) return;
  hidden.delete(entry.id);
  entry.object.visible = true;
  paint(entry, overrides[entry.id] ?? entry.base);
  dirty = true;
  writeLocal();
  bump();
}

export function scaleSelected(factor: number) {
  const entry = entries.get(selected);
  if (!entry) return;
  const next = Math.max(0.2, Math.min(8, (scales.get(entry.id) ?? entry.object.scale.x ?? 1) * factor));
  scales.set(entry.id, next);
  entry.object.scale.setScalar(next);
  if (entry.solid) setExtraSolid(entry.id, entry.object.position.x, entry.object.position.z, entry.object.rotation.y, entry.solid.hw * next, entry.solid.hd * next);
  dirty = true;
  writeLocal();
  bump();
}

export function snapSelectedGround() {
  const entry = entries.get(selected);
  if (!entry) return;
  const pose = poseOf(entry);
  commit(entry, { ...pose, y: groundY(pose.x, pose.z) });
}

function poseOf(entry: Entry): Pose {
  return {
    x: entry.object.position.x,
    y: entry.object.position.y,
    z: entry.object.position.z,
    yaw: entry.object.rotation.y,
  };
}

function commit(entry: Entry, pose: Pose) {
  overrides[entry.id] = {
    x: Math.round(pose.x * 1000) / 1000,
    y: Math.round(pose.y * 1000) / 1000,
    z: Math.round(pose.z * 1000) / 1000,
    yaw: pose.yaw,
  };
  dirty = true;
  paint(entry, overrides[entry.id]!);
  writeLocal();
  bump();
}

export function nudgeSelected(dx: number, dy: number, dz: number, yawDeg: number) {
  const entry = entries.get(selected);
  if (!entry) return;
  const pose = poseOf(entry);
  commit(entry, {
    x: pose.x + dx,
    y: pose.y + dy,
    z: pose.z + dz,
    yaw: pose.yaw + (yawDeg * Math.PI) / 180,
  });
}

export function setSelectedNumbers(x: number, y: number, z: number, yawDeg: number) {
  const entry = entries.get(selected);
  if (!entry) return;
  commit(entry, { x, y, z, yaw: (yawDeg * Math.PI) / 180 });
}

export function setMoveStep(step: number) {
  moveStep = step;
  bump();
}

export function setRotStep(step: number) {
  rotStep = step;
  bump();
}

export function resetSelected() {
  const entry = entries.get(selected);
  if (!entry) return;
  delete overrides[entry.id];
  hidden.delete(entry.id);
  scales.delete(entry.id);
  entry.object.scale.setScalar(1);
  dirty = true;
  paint(entry, entry.base);
  writeLocal();
  bump();
}

export function resetAllLayout() {
  overrides = {};
  dirty = true;
  for (const entry of entries.values()) paint(entry, entry.base);
  writeLocal();
  bump();
}

export function nudgeByKey(code: string) {
  if (!armed || !selected) return false;
  if (code === "ArrowLeft") nudgeSelected(-moveStep, 0, 0, 0);
  else if (code === "ArrowRight") nudgeSelected(moveStep, 0, 0, 0);
  else if (code === "ArrowUp") nudgeSelected(0, 0, -moveStep, 0);
  else if (code === "ArrowDown") nudgeSelected(0, 0, moveStep, 0);
  else if (code === "KeyQ") nudgeSelected(0, 0, 0, -rotStep);
  else if (code === "KeyE") nudgeSelected(0, 0, 0, rotStep);
  else if (code === "KeyR") nudgeSelected(0, moveStep, 0, 0);
  else if (code === "KeyF") nudgeSelected(0, -moveStep, 0, 0);
  else return false;
  return true;
}

export async function publishLayout() {
  try {
    const res = await saveWorldLayout({ data: overrides });
    if (!res.ok) {
      note = "Kayıt olmadı. Bu hesapla gir.";
      bump();
      return false;
    }
    dirty = false;
    writeLocal();
    note = "Kaydedildi. Diğerleri yeniden girince görür.";
    bump();
    return true;
  } catch {
    note = "Kayıt olmadı.";
    bump();
    return false;
  }
}

async function pullLayout() {
  try {
    const remote = await getWorldLayout();
    if (dirty || !remote.poses) return;
    overrides = remote.poses;
    writeLocal();
    applyAll();
    bump();
  } catch {
    /* layout is optional */
  }
}

let boot: Promise<void> | null = null;
export function hydrateLayout() {
  if (!boot) boot = pullLayout();
  return boot;
}

if (typeof window !== "undefined") void hydrateLayout();

export function subscribeEdit(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function editVersion() {
  return version;
}

export function editView() {
  const list = [...entries.values()]
    .map((entry) => ({ id: entry.id, label: entry.label, kind: entry.kind, hidden: hidden.has(entry.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));
  const entry = entries.get(selected);
  const pose = entry ? poseOf(entry) : null;
  return { list, selected, pose, moveStep, rotStep, armed, dirty, note, label: entry?.label ?? "", mask, hidden: entry ? hidden.has(entry.id) : false };
}

export function isCreativeUser(user: { primaryEmail?: string | null; displayName?: string | null } | null) {
  if (!user) return false;
  const email = (user.primaryEmail ?? "").toLowerCase();
  const name = (user.displayName ?? "").toLowerCase();
  return email === CREATIVE_EMAIL || name === CREATIVE_NAME;
}
