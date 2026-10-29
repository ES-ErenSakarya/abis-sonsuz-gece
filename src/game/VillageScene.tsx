import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { adoptDummy, createBeast, createClassAvatar, createHorse, createMentor, createTownsman, createVendor, hitBeast, hitDummy, mitigate, mobBite, mobXp, RANGED_HIT, SPECIES, stickGear, syncBow, syncGear, tickBeast, tickDummy, tickVendor, weaponMesh, type Beast, type Dummy, type Mentor, type Vendor } from "@/game/actors";
import { createCombat, type ShotTarget } from "@/game/combat";
import { chatBubbles, systemSay } from "@/game/chat";
import { amHost, broadcastStall, chestView, closeChest, emitHit, expireLoot, fieldLoot, fieldMobs, marketBoards, openChest, openStallView, placeChest, placeLoot, pushMobState, sendReward, setLootHint, shareXp, syncStallMarket, takePendingDrops, takeRemoteHits } from "@/game/field";
import { useHud } from "@/game/hudStore";
import { viewport } from "@/game/viewport";
import { axes, held, input, releaseMoveKeys, sim, takeHop } from "@/game/input";
import { BOSSES, MENTORS, bossChestItem, commitSkill, meteorLoot, questGuide, questNpcMarks, rankOf, refundSkill, rollKillLoot, takeCast, takeLevelPing, takeMountKick, tryReceiveItem, useRpg, weaponStyleOf, enchantView, type Item, type NearKind, type WeaponStyle } from "@/game/rpg";
import { arenaFloor, beginRun, bindDungeonEnter, dungeonNow, endRun } from "@/game/dungeon";
import { playAttack, syncRealmMusic } from "@/game/audio";
import { effectiveGfx, loadGfx, subscribeGfx } from "@/game/settings";
import { buildVillage, composeGround, createWeather, disposeScenery, tickGrass, tickSmoke, type SmokePuff } from "@/game/scenery";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { advanceSwing, captureRest, createSwingFx, poseFighter, punchArc, punchExtend, type RestPose, type SwingFx } from "@/game/warrior";
import { presence, remotes, type RemoteBody } from "@/game/online";
import { readTarget, sendDuelHit, setMobCard, setSelection, takePick, type Sel } from "@/game/target";
import { bindCreativeScene, clearEditables, editArmed, pickEditable, selectEditable, tickCreative, trackProp } from "@/game/creative";
import { mountStudio, studioHop, studioLevelBlock, studioPaintPoint, studioPainting, studioRay, studioSpawners, studioZoneName, tickStudio, unmountStudio } from "@/game/studio";
import { blocked, bridgeName, campSpawns, dryLand, faceYaw, FISHER_STAND, FENCE_R, DUNGEON_BOUND, groundY, inWater, LAKE, liveVeins, meteorOutside, meteorSpots, placeMeteor, onPier, PLAYER_R, REALMS, realmAt, realmGate, realmHerald, slide, WELL, zoneName } from "@/game/world";

const WALK_REF = 1.67;
const ARENA_R = 22;
const ARENA_WALK = 20.2;
const METEOR_WAVES = [
  { pct: 0.9, n: 3 },
  { pct: 0.7, n: 3 },
  { pct: 0.5, n: 6 },
  { pct: 0.3, n: 6 },
  { pct: 0.2, n: 8 },
] as const;
function meteorMaxHp(level: number) {
  return Math.round(1100 + level * level * 7);
}
const _look = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _cam = new THREE.Vector3(8, 7, 16);
const _plate = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _picker = new THREE.Raycaster();

function makeChest() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#6d4124", roughness: 0.74, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: "#3c2618", roughness: 0.8 });
  const brass = new THREE.MeshStandardMaterial({ color: "#d4b36a", roughness: 0.32, metalness: 0.62 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.4), wood);
  body.position.y = 0.2;
  body.castShadow = true;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.045, 0.43), brass);
  band.position.y = 0.28;
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.36, -0.18);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.42), dark);
  lid.position.set(0, 0.05, 0.18);
  lid.castShadow = true;
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.04), brass);
  lock.position.set(0, 0.02, 0.38);
  lidPivot.add(lid, lock);
  group.add(body, band, lidPivot);
  group.userData.lid = lidPivot;
  return group;
}

function disposeTree(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((item) => item.dispose());
    else mat?.dispose();
  });
}

type ViewSlot = { root: THREE.Group; key: string };

const _viewEuler = new THREE.Euler();
const _viewQuat = new THREE.Quaternion();

function showViewMesh(root: THREE.Object3D) {
  root.traverse((child) => {
    child.frustumCulled = false;
    child.renderOrder = 50;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of list) {
      if (!mat) continue;
      mat.depthTest = false;
      mat.depthWrite = false;
      (mat as THREE.MeshLambertMaterial).fog = false;
    }
  });
}

function syncViewmodel(
  camera: THREE.Camera,
  scene: THREE.Scene,
  show: boolean,
  style: WeaponStyle,
  swing: number,
  moving: boolean,
  phase: number,
  time: number,
  mining: boolean,
  biting: boolean,
  slotRef: { current: ViewSlot | null },
) {
  let slot = slotRef.current;
  if (!slot) {
    const root = new THREE.Group();
    root.name = "fp-weapon";
    root.frustumCulled = false;
    root.renderOrder = 50;
    scene.add(root);
    slot = { root, key: "" };
    slotRef.current = slot;
  }
  const root = slot.root;
  if (!show || style === "fist") {
    root.visible = false;
    return;
  }
  if (slot.key !== style) {
    for (const child of [...root.children]) {
      root.remove(child);
      disposeTree(child);
    }
    const mesh = weaponMesh(style) as THREE.Object3D;
    const scale = style === "pala" || style === "staff" ? 0.92 : style === "olta" ? 1.05 : style === "bow" ? 1.05 : 1.2;
    mesh.scale.setScalar(scale);
    showViewMesh(mesh);
    root.add(mesh);
    if (style === "dagger") {
      const off = weaponMesh("dagger") as THREE.Object3D;
      off.position.set(-0.42, 0.02, 0.04);
      off.rotation.set(0.2, 0.25, 0.4);
      showViewMesh(off);
      root.add(off);
    }
    slot.key = style;
  }
  root.visible = true;
  const bob = moving ? Math.sin(phase * 2) * 0.015 : Math.sin(time * 1.6) * 0.006;
  const ext = punchExtend(swing);
  const chop = mining ? Math.max(0, Math.sin(time * 8.5)) : 0;
  const bite = biting ? Math.sin(time * 26) * 0.06 : 0;
  const pose: Record<WeaponStyle, [number, number, number, number, number, number]> = {
    fist: [0, 0, 0, 0, 0, 0],
    sword: [0.22, -0.16, -0.78, -0.45, -0.35, -0.2],
    pala: [0.24, -0.14, -0.82, -0.4, -0.28, -0.08],
    dagger: [0.2, -0.14, -0.7, -0.3, -0.3, -0.45],
    bow: [0.34, -0.32, -0.52, 1.15, 0.12, 0.28],
    staff: [0.2, -0.16, -0.78, -0.3, -0.22, 0.06],
    kazma: [0.22, -0.12, -0.74, -0.65, -0.12, -0.35],
    olta: [0.18, -0.08, -0.76, -0.85, -0.18, 0.12],
  };
  const p = pose[style];
  const pull = style === "bow" ? ext : 0;
  const slash = style === "sword" || style === "pala" || style === "dagger";
  root.position.copy(camera.position);
  root.quaternion.copy(camera.quaternion);
  root.translateX(p[0]);
  root.translateY(p[1] + bob + (slash ? ext * 0.03 : 0));
  root.translateZ(p[2] - pull * 0.06);
  _viewEuler.set(
    p[3] + (style === "kazma" ? -chop * 0.85 : style === "olta" ? bite : style === "bow" ? -pull * 1.35 : slash ? ext * 0.4 : style === "staff" ? ext * 0.35 : 0),
    p[4] + (slash ? ext * 0.3 : 0),
    p[5] + (slash ? -ext * 0.95 : style === "kazma" ? chop * 0.15 : 0),
  );
  _viewQuat.setFromEuler(_viewEuler);
  root.quaternion.multiply(_viewQuat);
}

function cylinderT(ray: THREE.Ray, cx: number, cz: number, radius: number, y0: number, y1: number) {
  const ox = ray.origin.x - cx;
  const oz = ray.origin.z - cz;
  const dx = ray.direction.x;
  const dz = ray.direction.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-6) {
    if (ox * ox + oz * oz > radius * radius) return null;
    const dy = ray.direction.y;
    if (Math.abs(dy) < 1e-6) return null;
    const ta = (y0 - ray.origin.y) / dy;
    const tb = (y1 - ray.origin.y) / dy;
    const near = Math.min(ta, tb);
    const far = Math.max(ta, tb);
    if (far < 0.08) return null;
    return near > 0.08 ? near : far;
  }
  const b = 2 * (ox * dx + oz * dz);
  const c = ox * ox + oz * oz - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const inv = 1 / (2 * a);
  const ta = (-b - s) * inv;
  const tb = (-b + s) * inv;
  const inside = (t: number) => {
    if (t < 0.08) return false;
    const y = ray.origin.y + ray.direction.y * t;
    return y >= y0 && y <= y1;
  };
  if (inside(ta)) return ta;
  if (inside(tb)) return tb;
  return null;
}

function groundHit(ray: THREE.Ray) {
  const origin = ray.origin;
  const dir = ray.direction;
  let prevT = 0;
  let prevAbove = origin.y - groundY(origin.x, origin.z, true);
  for (let t = 0.35; t < 96; t += 0.35) {
    const x = origin.x + dir.x * t;
    const y = origin.y + dir.y * t;
    const z = origin.z + dir.z * t;
    const above = y - groundY(x, z, true);
    if (prevAbove > 0 && above <= 0) {
      const span = prevAbove - above;
      const k = span > 1e-4 ? prevAbove / span : 1;
      const hitT = prevT + (t - prevT) * k;
      return { x: origin.x + dir.x * hitT, z: origin.z + dir.z * hitT };
    }
    prevT = t;
    prevAbove = above;
  }
  return null;
}

type RemoteAvatar = {
  root: THREE.Group;
  model: THREE.Object3D;
  rest: RestPose;
  tag: THREE.Sprite;
  label: string;
  gear: string;
  phase: number;
  prevX: number;
  prevZ: number;
  face: number;
};

function remoteLabel(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(28,25,22,0.75)";
    ctx.fillRect(24, 8, 208, 48);
    ctx.fillStyle = "#f3efe8";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, 128, 40);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
  sprite.scale.set(1.35, 0.34, 1);
  sprite.position.y = 2.08;
  sprite.userData.canvas = canvas;
  return sprite;
}

function paintLabel(sprite: THREE.Sprite, text: string) {
  const canvas = sprite.userData.canvas as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  const mat = sprite.material as THREE.SpriteMaterial;
  if (!ctx || !mat.map) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(28,25,22,0.75)";
  ctx.fillRect(24, 8, 208, 48);
  ctx.fillStyle = "#f3efe8";
  ctx.font = "24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, 128, 40);
  mat.map.needsUpdate = true;
}

function spawnRemote(template: THREE.Object3D) {
  const model = cloneSkeleton(template);
  model.rotation.y = Math.PI;
  model.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
  mesh.frustumCulled = false;
    }
  });
  const root = new THREE.Group();
  root.add(model);
  model.updateMatrixWorld(true);
  const rest = captureRest(model);
  const tag = remoteLabel("");
  root.add(tag);
  return { root, model, rest, tag, label: "", gear: "", phase: 0, prevX: 0, prevZ: 0, face: Math.PI } satisfies RemoteAvatar;
}

function alignRemote(av: RemoteAvatar, dx: number, dz: number) {
  if (dx * dx + dz * dz < 1e-6) {
    av.model.rotation.y = av.face;
    return;
  }
  const score = (extra: number) => {
    av.model.rotation.y = Math.PI + extra;
    av.model.updateMatrixWorld(true);
    const e = av.model.matrixWorld.elements;
    return e[8]! * dx + e[10]! * dz;
  };
  const keep = score(0);
  const flip = score(Math.PI);
  av.face = Math.PI + (flip > keep ? Math.PI : 0);
  av.model.rotation.y = av.face;
}

function syncRemoteGear(model: THREE.Object3D, body: RemoteBody) {
  const style = body.style || "sword";
  syncGear(model, {
    weapon: body.weapon ? { id: style === "fist" ? "" : `starter-${style === "sword" ? "sword" : style}` } : null,
    helmet: body.helmet ? 1 : null,
    armor: body.armor ? 1 : null,
    boots: body.boots ? 1 : null,
    earring: null,
    necklace: null,
    bracelet: null,
    ring: null,
    gloves: null,
    belt: null,
  });
}

function plant(clip: THREE.AnimationClip) {
  const next = clip.clone();
  for (const track of next.tracks) {
    if (!track.name.endsWith("Hips.position")) continue;
    const values = track.values;
    const x0 = values[0] ?? 0;
    const z0 = values[2] ?? 0;
    for (let i = 0; i < values.length; i += 3) {
      values[i] = x0;
      values[i + 2] = z0;
    }
  }
  return next;
}

const TANK = "#d9d1c3";
const TANK_DIRT = "#b7ad9c";
const SKIN = "#c48b6a";
const SCAR = "#9a4d45";
const SHORTS = "#1a1c18";
const BOOT = "#4e382c";
const WRAP = "#6d5344";

function dominantBone(geo: THREE.BufferGeometry, bones: THREE.Bone[], index: number) {
  const skinIndex = geo.attributes.skinIndex;
  const skinWeight = geo.attributes.skinWeight;
  if (!skinIndex || !skinWeight) return "";
  let best = 0;
  let bone = 0;
  for (let k = 0; k < 4; k++) {
    const weight = skinWeight.getComponent(index, k);
    if (weight > best) {
      best = weight;
      bone = skinIndex.getComponent(index, k);
    }
  }
  return bones[bone]?.name ?? "";
}

function dress(model: THREE.Object3D) {
  const mesh = model.getObjectByProperty("isMesh", true) as THREE.SkinnedMesh | undefined;
  const material = mesh?.material as THREE.MeshStandardMaterial | undefined;
  const map = material?.map;
  const image = map?.image as CanvasImageSource | undefined;
  const geo = mesh?.geometry;
  const bones = mesh?.skeleton?.bones;
  if (!mesh || !material || !map || !image || !geo?.index || !geo.attributes.uv || !bones) return;

  const width = (image as HTMLImageElement).width || (image as ImageBitmap).width;
  const height = (image as HTMLImageElement).height || (image as ImageBitmap).height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx || !width || !height) return;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;

  const sample = (vertex: number) => {
    const x = Math.min(width - 1, Math.max(0, Math.floor(uv.getX(vertex) * (width - 1))));
    const y = Math.min(height - 1, Math.max(0, Math.floor(uv.getY(vertex) * (height - 1))));
    const offset = (y * width + x) * 4;
    return [pixels[offset] ?? 0, pixels[offset + 1] ?? 0, pixels[offset + 2] ?? 0];
  };
  const isSkin = (vertex: number) => {
    const [r, g, b] = sample(vertex);
    return r > 135 && r > g + 18 && r > b + 18;
  };

  const kind = new Uint8Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const name = dominantBone(geo, bones, i);
    const y = pos.getY(i);
    if (/Foot|Toe/.test(name)) kind[i] = 4;
    else if (name === "LeftLeg" || name === "RightLeg") kind[i] = 5;
    else if ((name === "LeftUpLeg" || name === "RightUpLeg") && y < 0.78) kind[i] = 5;
    else if (/Hips|UpLeg/.test(name)) kind[i] = 2;
    else if (/ForeArm/.test(name) && !isSkin(i)) kind[i] = 6;
    else if ((name === "LeftArm" || name === "RightArm") && !isSkin(i)) kind[i] = 3;
    else if (/Spine|Shoulder/.test(name)) kind[i] = 1;
  }

  const paint = (color: string, a: number, b: number, c: number) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(uv.getX(a) * (width - 1), uv.getY(a) * (height - 1));
    ctx.lineTo(uv.getX(b) * (width - 1), uv.getY(b) * (height - 1));
    ctx.lineTo(uv.getX(c) * (width - 1), uv.getY(c) * (height - 1));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  const src = geo.index;
  for (let t = 0; t < src.count; t += 3) {
    const a = src.getX(t);
    const b = src.getX(t + 1);
    const c = src.getX(t + 2);
    const votes = [kind[a], kind[b], kind[c]];
    const majority = (id: number) => votes.filter((item) => item === id).length >= 2;
    if (!votes.some((item) => item > 0)) continue;
    if (majority(1) || majority(3) || majority(4) || majority(5) || majority(6)) paint(SKIN, a, b, c);
    else if (majority(2)) paint(SHORTS, a, b, c);
  }

  const next = new THREE.CanvasTexture(canvas);
  next.flipY = map.flipY;
  next.colorSpace = THREE.SRGBColorSpace;
  next.anisotropy = 2;
  next.wrapS = map.wrapS;
  next.wrapT = map.wrapT;
  next.needsUpdate = true;
  mesh.material = new THREE.MeshLambertMaterial({ map: next });
}

function equip(model: THREE.Object3D) {
  const cloth = new THREE.MeshStandardMaterial({
    color: "#7c2430",
    roughness: 0.82,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const hair = new THREE.MeshStandardMaterial({ color: "#241c18", roughness: 0.9, metalness: 0 });

  const spine = model.getObjectByName("Spine2");
  if (spine) {
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.05, 3, 5), cloth);
    const p = cape.geometry.attributes.position;
    if (p) {
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        p.setZ(i, Math.abs(x) * 0.22 - y * 0.04);
      }
      cape.geometry.computeVertexNormals();
    }
    cape.position.set(0, -0.15, -0.08);
    cape.castShadow = true;
    spine.add(cape);
  }

  const head = model.getObjectByName("Head");
  if (head) {
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), hair);
    beard.scale.set(0.85, 0.55, 0.5);
    beard.position.set(0, -0.045, 0.07);
    head.add(beard);
  }
}

type Pose = {
  hips: THREE.Bone;
  spine: THREE.Bone;
  lUp: THREE.Bone;
  rUp: THREE.Bone;
  lLeg: THREE.Bone;
  rLeg: THREE.Bone;
  lArm: THREE.Bone;
  rArm: THREE.Bone;
  lFore: THREE.Bone;
  rFore: THREE.Bone;
};

function tone(x: number, y: number, z: number): [number, number, number] {
  if (y < -0.36) return [0.32, 0.2, 0.14];
  if (y < -0.22 && Math.abs(x) < 0.2) return [0.68, 0.45, 0.34];
  if (y < -0.05 && Math.abs(x) < 0.18) return [0.1, 0.11, 0.09];
  if (z < -0.03 && y > -0.25 && Math.abs(x) < 0.32) return [0.42, 0.1, 0.13];
  if (y > 0.34) return z > 0.015 ? [0.7, 0.46, 0.36] : [0.1, 0.08, 0.07];
  if (Math.abs(x) > 0.16 && y > -0.02 && y < 0.34) return y < 0.1 ? [0.38, 0.28, 0.22] : [0.7, 0.46, 0.36];
  if (y > 0.0 && y < 0.34 && Math.abs(x) < 0.16 && z > -0.08) return [0.86, 0.82, 0.74];
  return [0.7, 0.46, 0.36];
}

function paintColors(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const [r, g, b] = tone(pos.getX(i), pos.getY(i), pos.getZ(i));
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function takeSword(source: THREE.BufferGeometry) {
  const geo = source.clone();
  const pos = geo.getAttribute("position");
  const gripAt: [number, number, number] = [0.186, 0.05, 0.055];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (x > 0.292 && y < 0.2 && y > -0.46 && z < 0.05) {
      pos.setXYZ(i, gripAt[0], gripAt[1] - 0.02, gripAt[2]);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  paintColors(geo);

  const leather = new THREE.MeshStandardMaterial({ color: "#5a3d2c", roughness: 0.72, metalness: 0.05 });
  const metal = new THREE.MeshStandardMaterial({ color: "#c5c8cc", roughness: 0.28, metalness: 0.85 });
  const grip = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.12, 7), leather);
  handle.position.y = -0.03;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.014, 0.022), metal);
  guard.position.y = -0.09;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.008), metal);
  blade.position.y = -0.35;
  grip.add(handle, guard, blade);
  grip.position.set(gripAt[0], gripAt[1], gripAt[2]);
  grip.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) mesh.castShadow = true;
  });
  return { bodyGeo: geo, grip };
}

function rigWarrior(source: THREE.BufferGeometry, material: THREE.Material) {
  const geo = source.clone();
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (!box) return null;
  const y0 = box.min.y;
  const h = Math.max(0.01, box.max.y - y0);
  const hip = y0 + h * 0.52;
  const knee = y0 + h * 0.28;
  const ankle = y0 + h * 0.05;
  const chest = y0 + h * 0.7;
  const shoulder = y0 + h * 0.78;
  const neck = y0 + h * 0.86;
  const crown = y0 + h * 0.96;
  const legX = h * 0.09;
  const armX = h * 0.17;
  const elbow = shoulder - h * 0.15;
  const wrist = shoulder - h * 0.3;

  const made: { bone: THREE.Bone; x: number; y: number; z: number }[] = [];
  const add = (name: string, parent: number, x: number, y: number, z: number) => {
    const bone = new THREE.Bone();
    bone.name = name;
    const index = made.length;
    if (parent >= 0) {
      const p = made[parent]!;
      p.bone.add(bone);
      bone.position.set(x - p.x, y - p.y, z - p.z);
    } else bone.position.set(x, y, z);
    made.push({ bone, x, y, z });
    return index;
  };

  const iHips = add("Hips", -1, 0, hip, 0);
  const iSpine = add("Spine", iHips, 0, hip + (chest - hip) * 0.48, 0);
  const iChest = add("Chest", iSpine, 0, chest, 0);
  const iNeck = add("Neck", iChest, 0, neck, 0);
  add("Head", iNeck, 0, crown, 0);
  const iLU = add("LeftUpLeg", iHips, legX, hip, 0);
  const iLL = add("LeftLeg", iLU, legX, knee, 0);
  add("LeftFoot", iLL, legX, ankle, 0);
  const iRU = add("RightUpLeg", iHips, -legX, hip, 0);
  const iRL = add("RightLeg", iRU, -legX, knee, 0);
  add("RightFoot", iRL, -legX, ankle, 0);
  const iLA = add("LeftArm", iChest, armX, shoulder, 0);
  const iLF = add("LeftForeArm", iLA, armX * 1.08, elbow, 0.02);
  const iLH = add("LeftHand", iLF, armX * 1.12, wrist, 0.05);
  const iRA = add("RightArm", iChest, -armX, shoulder, 0);
  const iRF = add("RightForeArm", iRA, -armX * 1.08, elbow, 0.02);
  const iRH = add("RightHand", iRF, -armX * 1.12, wrist, 0.05);

  const segments = made.map((node, index) => {
    const child = made.find((item) => item.bone.parent === node.bone);
    return {
      index,
      name: node.bone.name,
      ax: node.x,
      ay: node.y,
      az: node.z,
      bx: child?.x ?? node.x,
      by: child?.y ?? node.y - h * 0.04,
      bz: child?.z ?? node.z,
    };
  });

  const pos = geo.attributes.position;
  if (!pos) return null;
  const indexAttr = new Uint16Array(pos.count * 4);
  const weightAttr = new Float32Array(pos.count * 4);
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v);
    const y = pos.getY(v);
    const z = pos.getZ(v);
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s]!;
      const abx = seg.bx - seg.ax;
      const aby = seg.by - seg.ay;
      const abz = seg.bz - seg.az;
      const ab2 = abx * abx + aby * aby + abz * abz || 1e-6;
      let t = ((x - seg.ax) * abx + (y - seg.ay) * aby + (z - seg.az) * abz) / ab2;
      t = Math.max(0, Math.min(1, t));
      const dx = x - (seg.ax + abx * t);
      const dy = y - (seg.ay + aby * t);
      const dz = z - (seg.az + abz * t);
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    const segName = segments[best]!.name;
    if (/Leg|Foot|UpLeg/.test(segName) && (Math.abs(x - segments[best]!.ax) > h * 0.07 || z > h * 0.2)) {
      best = x <= 0 ? iRH : iLH;
    }
    const o = v * 4;
    indexAttr[o] = best;
    weightAttr[o] = 1;
  }
  geo.computeVertexNormals();
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indexAttr, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weightAttr, 4));

  const bones = made.map((item) => item.bone);
  const mat = material.clone();
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.add(bones[0]!);
  mesh.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  mesh.normalizeSkinWeights();
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  geo.computeBoundingSphere();
  mesh.skeleton.update();
  const pose: Pose = {
    hips: made[iHips]!.bone,
    spine: made[iSpine]!.bone,
    lUp: made[iLU]!.bone,
    rUp: made[iRU]!.bone,
    lLeg: made[iLL]!.bone,
    rLeg: made[iRL]!.bone,
    lArm: made[iLA]!.bone,
    rArm: made[iRA]!.bone,
    lFore: made[iLF]!.bone,
    rFore: made[iRF]!.bone,
  };
  return { mesh, pose };
}

function stepPose(pose: Pose, phase: number, moving: boolean) {
  const swing = Math.sin(phase * 3.4);
  const amp = moving ? 0.42 : 0.04;
  pose.lUp.rotation.x = swing * amp;
  pose.rUp.rotation.x = -swing * amp;
  pose.lLeg.rotation.x = Math.max(0, -swing) * (moving ? 0.7 : 0.04);
  pose.rLeg.rotation.x = Math.max(0, swing) * (moving ? 0.7 : 0.04);
  pose.lArm.rotation.x = 0;
  pose.rArm.rotation.x = 0;
  pose.lFore.rotation.x = 0;
  pose.rFore.rotation.x = 0;
  pose.spine.rotation.x = (moving ? 0.08 : 0) + Math.sin(phase * 1.4) * 0.03;
  pose.hips.position.y = pose.hips.userData.baseY + (moving ? Math.abs(Math.cos(phase * 3.4)) * 0.012 : 0);
}

function setClassBone(model: THREE.Object3D, name: string, x: number, y = 0, z = 0) {
  const bone = model.getObjectByName(name) as THREE.Bone | undefined;
  if (!bone?.isBone) return;
  bone.rotation.set(x, y, z);
}

function stepClassPose(model: THREE.Object3D, moving: boolean, cycle: number, swing: number, run: number) {
  const stride = Math.sin(cycle);
  const gait = moving ? 0.34 + run * 0.12 : 0;
  const lift = moving ? 0.42 : 0;
  const atk = swing > 0 ? Math.sin(Math.min(1, swing) * Math.PI) : 0;
  const arm = moving ? -stride * gait * 0.55 : 0;
  setClassBone(model, "Hips", 0, 0, 0);
  setClassBone(model, "Spine", moving ? 0.04 : 0, 0, 0);
  setClassBone(model, "Chest", 0, 0, 0);
  setClassBone(model, "Neck", -atk * 0.06, 0, 0);
  setClassBone(model, "Head", 0, 0, 0);
  setClassBone(model, "LeftUpLeg", stride * gait, 0, 0);
  setClassBone(model, "RightUpLeg", -stride * gait, 0, 0);
  setClassBone(model, "LeftLeg", Math.max(0, -stride) * lift, 0, 0);
  setClassBone(model, "RightLeg", Math.max(0, stride) * lift, 0, 0);
  setClassBone(model, "LeftFoot", 0, 0, 0);
  setClassBone(model, "RightFoot", 0, 0, 0);
  setClassBone(model, "LeftArm", arm, 0, 0);
  setClassBone(model, "RightArm", -arm - atk * 0.9, 0, 0);
  setClassBone(model, "LeftForeArm", 0, 0, 0);
  setClassBone(model, "RightForeArm", atk * 0.25, 0, 0);
  setClassBone(model, "LeftHand", 0, 0, 0);
  setClassBone(model, "RightHand", 0, 0, 0);
  model.updateMatrixWorld(true);
  model.traverse((obj) => {
    const skin = obj as THREE.SkinnedMesh;
    if (skin.isSkinnedMesh) skin.skeleton.update();
  });
}

function poseActor(
  model: THREE.Object3D,
  rest: RestPose,
  moving: boolean,
  run: number,
  cycle: number,
  time: number,
  swing: number,
  side: number,
  armed: boolean,
  style: WeaponStyle,
  combo = 1,
  mounted = false,
) {
  poseFighter(model, rest, { moving, run, cycle, time, swing, side, armed, style, combo, mounted });
}

type Puppet = {
  kind: "alice" | "dragon";
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  rests: Map<string, THREE.Quaternion>;
  bones: Record<string, THREE.Object3D | null | undefined>;
  jawHold?: THREE.Quaternion;
  neckHold?: THREE.Quaternion;
};

const _eul = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _fit = new THREE.Vector3();

function boneNamed(model: THREE.Object3D, name: string) {
  return model.getObjectByName(name);
}

function rememberRests(model: THREE.Object3D) {
  const rests = new Map<string, THREE.Quaternion>();
  model.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (!bone.isBone) return;
    rests.set(bone.name, bone.quaternion.clone());
  });
  return rests;
}

function setBone(rests: Map<string, THREE.Quaternion>, bone: THREE.Object3D | null | undefined, x: number, y: number, z: number) {
  if (!bone) return;
  const rest = rests.get(bone.name);
  if (!rest) return;
  bone.quaternion.copy(rest).multiply(_quat.setFromEuler(_eul.set(x, y, z)));
}

function prepMeshes(model: THREE.Object3D) {
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.frustumCulled = false;
  });
}

function fitModel(model: THREE.Object3D, longest: number) {
  model.position.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  box.getSize(_fit);
  const span = Math.max(_fit.x, _fit.y, _fit.z, 0.001);
  model.scale.setScalar(longest / span);
  model.updateMatrixWorld(true);
  const planted = new THREE.Box3().setFromObject(model);
  const center = planted.getCenter(_fit);
  model.position.set(-center.x, -planted.min.y, -center.z);
}

function stepPuppet(beast: Beast, dt: number) {
  const puppet = beast.root.userData.puppet as Puppet | undefined;
  if (!puppet || !beast.alive) return;
  const atk = Number(beast.root.userData.atk) || 0;
  if (puppet.kind === "dragon") {
    if (puppet.mixer) puppet.mixer.update(dt);
    const jaw = puppet.bones.jaw;
    const neck = puppet.bones.neck;
    if (atk < 0.02) {
      if (jaw) puppet.jawHold = jaw.quaternion.clone();
      if (neck) puppet.neckHold = neck.quaternion.clone();
    } else {
      if (jaw && puppet.jawHold) jaw.quaternion.copy(puppet.jawHold).multiply(_quat.setFromEuler(_eul.set(atk * 0.4, 0, 0)));
      if (neck && puppet.neckHold) neck.quaternion.copy(puppet.neckHold).multiply(_quat.setFromEuler(_eul.set(-atk * 0.22, 0, 0)));
    }
    return;
  }
  const amp = beast.anger ? 0.2 : 0.08;
  const swing = Math.sin(beast.phase * 6.2);
  setBone(puppet.rests, puppet.bones.hipL, swing * amp, 0, 0);
  setBone(puppet.rests, puppet.bones.kneeL, Math.max(0, -swing) * amp * 0.7, 0, 0);
  setBone(puppet.rests, puppet.bones.hipR, -swing * amp, 0, 0);
  setBone(puppet.rests, puppet.bones.kneeR, Math.max(0, swing) * amp * 0.7, 0, 0);
  setBone(puppet.rests, puppet.bones.armL, -swing * amp * 0.3, 0, atk * 0.12);
  setBone(puppet.rests, puppet.bones.armR, swing * amp * 0.3, 0, -atk * 0.12);
  setBone(puppet.rests, puppet.bones.torso, atk * 0.06, swing * 0.02, 0);
  setBone(puppet.rests, puppet.bones.tail, 0, Math.sin(beast.phase * 2.4) * 0.1, 0);
  setBone(puppet.rests, puppet.bones.jaw, atk * 0.28, 0, 0);
  setBone(puppet.rests, puppet.bones.neck, -atk * 0.16, 0, 0);
}

function paintMob(
  camera: THREE.Camera,
  id: string,
  title: string,
  hp: number,
  hpMax: number,
  x: number,
  y: number,
  z: number,
  show: boolean,
) {
  const host = document.getElementById("mob-bars");
  if (!host) return;
  let el = document.getElementById(id) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.style.cssText = "position:absolute;transform:translate(-50%,-120%);width:11rem;pointer-events:none;background:rgba(20,17,14,0.88);border:1px solid #3f3830;border-radius:8px;padding:4px 8px 5px";
    el.innerHTML =
      '<p style="margin:0 0 3px;text-align:center;font-size:13px;color:#c9a15b;text-shadow:0 1px 2px #1c1916"></p><div style="height:10px;border:1px solid #3f3830;background:#1c1916;border-radius:3px;overflow:hidden"><span style="display:block;height:100%;background:#b5443c;width:100%"></span></div><p style="margin:3px 0 0;text-align:center;font-size:12px;color:#f3efe8"></p>';
    host.appendChild(el);
  }
  if (!show || !viewport.placeWorld(el, camera, x, y, z)) {
    el.style.display = "none";
    return;
  }
  const name = el.children[0] as HTMLElement;
  const bar = el.children[1] as HTMLElement;
  const fill = el.querySelector("span") as HTMLElement;
  const num = el.children[2] as HTMLElement;
  const bare = id === "mob-meteor";
  bar.style.display = bare ? "none" : "block";
  num.style.display = bare ? "none" : "block";
  if (name.textContent !== title) name.textContent = title;
  if (bare) return;
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, hpMax)));
  fill.style.width = `${ratio * 100}%`;
  const label = `${Math.ceil(Math.max(0, hp))} / ${Math.ceil(hpMax)}`;
  if (num.textContent !== label) num.textContent = label;
}

function dampAngle(current: number, target: number, lambda: number, dt: number) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * (1 - Math.exp(-lambda * dt));
}

function makeFlatMark(url: string, size: number) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.06;
  mesh.renderOrder = 3;
  group.add(mesh);
  new THREE.TextureLoader().load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    mat.needsUpdate = true;
  });
  return group;
}

function makeIconSprite(url: string, w: number, h: number) {
  const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(w, h, 1);
  sprite.renderOrder = 4;
  new THREE.TextureLoader().load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    mat.needsUpdate = true;
  });
  return sprite;
}

const levelArt = new Image();
levelArt.src = "/ui/level-up.png";

function makeLevelBadge(level: number) {
  const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.55, 1.55, 1);
  sprite.renderOrder = 5;
  const paint = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 512, 512);
    ctx.drawImage(levelArt, 0, 0, 512, 512);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 16;
    ctx.strokeStyle = "rgba(18, 8, 28, 0.9)";
    ctx.font = "700 150px Georgia, serif";
    ctx.strokeText(String(level), 256, 262);
    ctx.fillStyle = "#f6f1ff";
    ctx.fillText(String(level), 256, 262);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    mat.needsUpdate = true;
  };
  if (levelArt.complete && levelArt.naturalWidth > 0) paint();
  else levelArt.addEventListener("load", paint, { once: true });
  return sprite;
}

function makeSelectRing() {
  const ring = makeFlatMark("/ui/isaretci.png", 1.45);
  ring.name = "select-ring";
  return ring;
}

function makeQuestGuide() {
  const arrow = new THREE.Group();
  arrow.name = "quest-arrow";
  arrow.add(makeIconSprite("/ui/npc-ok.png", 0.62, 0.84));
  const beacon = makeFlatMark("/ui/isaretci.png", 1.35);
  beacon.name = "quest-beacon";
  return { arrow, beacon };
}

function mobCamps() {
  return campSpawns().flatMap((spot) => {
    const spec = SPECIES.find((item) => item.id === spot.specId);
    if (!spec) return [];
    return [{ spec: { ...spec, level: spot.level }, x: spot.x, z: spot.z, id: spot.id, pack: spot.pack }];
  });
}

function angerPack(list: Beast[], pack: number) {
  for (const beast of list) if (beast.pack === pack) beast.anger = true;
}

type Gait = "idle" | "walk" | "back" | "left" | "right";

let worldFrame: ((dt: number) => void) | null = null;
let bgTimer = 0;
let keepCtx: AudioContext | null = null;
let keepGain: GainNode | null = null;

function startKeepAlive() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!keepCtx) {
    keepCtx = new Ctx();
    const osc = keepCtx.createOscillator();
    keepGain = keepCtx.createGain();
    keepGain.gain.value = 0.00001;
    osc.frequency.value = 180;
    osc.connect(keepGain);
    keepGain.connect(keepCtx.destination);
    osc.start();
  }
  if (keepGain) keepGain.gain.value = 0.00001;
  void keepCtx.resume();
}

function stopKeepAlive() {
  if (keepGain) keepGain.gain.value = 0;
  void keepCtx?.suspend();
}

function onHiddenChange() {
  if (document.hidden) {
    startKeepAlive();
    if (!bgTimer) {
      let last = performance.now();
      bgTimer = window.setInterval(() => {
        if (!document.hidden || !worldFrame) return;
        const now = performance.now();
        let gap = Math.min(2, Math.max(0, (now - last) / 1000));
        last = now;
        while (gap > 0.0001) {
          const step = Math.min(0.05, gap);
          worldFrame(step);
          gap -= step;
        }
      }, 50);
    }
    return;
  }
  if (bgTimer) {
    window.clearInterval(bgTimer);
    bgTimer = 0;
  }
  stopKeepAlive();
}

if (typeof document !== "undefined") document.addEventListener("visibilitychange", onHiddenChange);

function floatSprite(kind: "star" | "vial", text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    if (kind === "star") {
      ctx.save();
      ctx.translate(128, 118);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? 108 : 46;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = "#e2b45a";
      ctx.shadowColor = "#fff1c2";
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#1c1408";
      ctx.font = "bold 78px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 128, 128);
    } else {
      ctx.beginPath();
      ctx.arc(128, 128, 78, 0, Math.PI * 2);
      ctx.fillStyle = "#e2b45a";
      ctx.shadowColor = "#fff1c2";
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.fillStyle = "#1c1408";
      ctx.font = "bold 92px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", 128, 138);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(kind === "star" ? 1.25 : 0.7, kind === "star" ? 1.25 : 0.7, 1);
  sprite.renderOrder = 24;
  return sprite;
}

function World() {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    loadGfx();
    let grass: THREE.InstancedMesh | null = null;
    let timer = 0;
    const apply = () => {
      const g = effectiveGfx();
      const cap = g.fps <= 30 ? 0.85 : 1;
      gl.setPixelRatio(Math.max(0.55, Math.min(1.25, g.scale * cap)));
      if (!grass) grass = scene.getObjectByName("season-grass") as THREE.InstancedMesh | null;
      if (!grass) return;
      const full = Number(grass.userData.fullCount) || grass.count;
      if (!grass.userData.fullCount) grass.userData.fullCount = full;
      grass.visible = g.grass > 0;
      grass.count = g.grass >= 2 ? full : Math.max(80, Math.floor(full * 0.28));
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    };
    apply();
    const unsub = subscribeGfx(apply);
    timer = window.setInterval(apply, 1200);
    return () => {
      unsub();
      if (timer) window.clearInterval(timer);
    };
  }, [gl, scene]);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const rigRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actRef = useRef<Partial<Record<Gait, THREE.AnimationAction>>>({});
  const modeRef = useRef<Gait>("idle");
  const gaitRef = useRef<Gait>("walk");
  const puffsRef = useRef<SmokePuff[]>([]);
  const wasPlaying = useRef(false);
  const dustRef = useRef<{ sprite: THREE.Sprite; life: number; vy: number }[]>([]);
  const dummyRef = useRef<Dummy | null>(null);
  const beastsRef = useRef<Beast[]>([]);
  const horseKick = useRef(0);
  const portalLock = useRef(0);
  const arenaRef = useRef<Map<string, THREE.Group>>(new Map());
  type MeteorRock = {
    id: string;
    name: string;
    level: number;
    realm: string;
    x: number;
    z: number;
    hp: number;
    hpMax: number;
    mesh: THREE.Object3D;
    broken: boolean;
    respawn: number;
    wave: number;
    pack: number;
  };
  const meteorRef = useRef<MeteorRock[]>([]);
  const engageRef = useRef<
    | { kind: "fight"; id: string; what: "mob" | "meteor" }
    | { kind: "use"; role: NearKind; mentor: string | null; x: number; z: number }
    | { kind: "go"; x: number; z: number; stuck: number; prev: number }
    | null
  >(null);
  const chipMeteor = useRef<(rock: MeteorRock, dmg: number) => void>(() => undefined);
  const bossLeave = useRef(0);
  const shopAnchor = useRef({ key: "", x: 0, z: 0 });
  const dropEnter = useRef<() => void>(() => undefined);
  const dungeonApi = useRef<{ spawn: (boss: (typeof BOSSES)[number], wave: number) => void; clear: (pack: number) => void }>({
    spawn: () => undefined,
    clear: () => undefined,
  });
  const mentorsRef = useRef<Mentor[]>([]);
  const lootRoot = useRef<THREE.Group | null>(null);
  const lootMeshes = useRef<Map<string, THREE.Object3D>>(new Map());
  const packLeft = useRef(Array.from({ length: 24 }, () => 0));
  const mobClock = useRef(0);
  const landRef = useRef<(beast: Beast, dmg: number, crit: boolean) => void>(() => undefined);
  const wellRef = useRef<Vendor | null>(null);
  const smithRef = useRef<Vendor | null>(null);
  const townsRef = useRef<{ root: THREE.Group; hips: THREE.Object3D; role: NearKind; map?: string }[]>([]);
  const horseRef = useRef<{ root: THREE.Group; head: THREE.Object3D; tail: THREE.Object3D } | null>(null);
  const mountHorseRef = useRef<THREE.Group | null>(null);
  const levelRingRef = useRef<THREE.Mesh | null>(null);
  const floatRootRef = useRef<THREE.Group | null>(null);
  const floatMarks = useRef<{ sprite: THREE.Sprite; life: number; rise: number }[]>([]);
  const vialsSeen = useRef<number | null>(null);
  const levelFx = useRef<{ sprite: THREE.Sprite; life: number } | null>(null);
  const maxBadge = useRef<THREE.Sprite | null>(null);
  const stallClock = useRef(0);
  const guestStalls = useRef<Map<string, THREE.Group>>(new Map());
  const gearRev = useRef(-1);
  const fpRef = useRef<ViewSlot | null>(null);
  const hitLatch = useRef(false);
  const fist = useRef(new THREE.Vector3());
  const stepRef = useRef(0);
  const footRef = useRef(1);
  const fighterRef = useRef<SwingFx | null>(null);
  const armRef = useRef<import("@/game/warrior").Arms | null>(null);
  const restRef = useRef<RestPose | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const mountRef = useRef<((classId: string) => void) | null>(null);
  const classLoaded = useRef("");
  const classWanted = useRef("");
  const mountGen = useRef(0);
  const templateRef = useRef<THREE.Object3D | null>(null);
  const remoteRootRef = useRef<THREE.Group | null>(null);
  const remoteAvatars = useRef<Map<string, RemoteAvatar>>(new Map());
  const armBlend = useRef(1);
  const runBlend = useRef(0);
  const lifeRef = useRef(0);
  const weatherRef = useRef<ReturnType<typeof createWeather> | null>(null);
  const combatRef = useRef<ReturnType<typeof createCombat> | null>(null);
  const shotLatch = useRef(false);
  const spaceWas = useRef(false);
  const ringRef = useRef<THREE.Group | null>(null);
  const guideRef = useRef<{ arrow: THREE.Group; beacon: THREE.Group } | null>(null);
  const npcArrowRef = useRef<THREE.Object3D[]>([]);
  const wasDown = useRef(false);
  const hostRef = useRef<THREE.Group | null>(null);
  const spawnClock = useRef<Record<string, number>>({});
  const zoneNote = useRef("");
  const fieldSide = useRef("");
  const stallRef = useRef<THREE.Group | null>(null);
  const splashRef = useRef<THREE.Mesh | null>(null);
  const splashLife = useRef(1);
  const wasFish = useRef(false);

    useLayoutEffect(() => {
    let dead = false;
    bindCreativeScene(scene);
    mountStudio(scene);
    const group = new THREE.Group();
    hostRef.current = group;
    scene.add(group);
    weatherRef.current = createWeather(scene);
    combatRef.current = createCombat(scene);
    const ring = makeSelectRing();
    ring.visible = false;
    group.add(ring);
    ringRef.current = ring;
    const guide = makeQuestGuide();
    guide.arrow.visible = false;
    guide.beacon.visible = false;
    group.add(guide.arrow, guide.beacon);
    guideRef.current = guide;
    const npcArrows: THREE.Object3D[] = [];
    for (let i = 0; i < 8; i++) {
      const arrow = makeIconSprite("/ui/npc-ok.png", 0.62, 0.84);
      arrow.visible = false;
      group.add(arrow);
      npcArrows.push(arrow);
    }
    npcArrowRef.current = npcArrows;
    const holder = new THREE.Group();
    holder.position.set(sim.x, 0, sim.z);
    group.add(holder);
    rigRef.current = holder;
    const remoteRoot = new THREE.Group();
    group.add(remoteRoot);
    remoteRootRef.current = remoteRoot;
    const smithNpc = createVendor("smith", -15.05, 18.35, Math.atan2(0 - -15.05, 8 - 18.35));
    const beasts: Beast[] = [];
    for (const spot of mobCamps()) {
      const beast = createBeast(spot.x, spot.z, spot.id, spot.pack, spot.spec);
      beast.roam = 0.28;
      beasts.push(beast);
      group.add(beast.root);
    }
    const makeArena = (x: number, z: number) => {
      const g = new THREE.Group();
      g.visible = false;
      const floorMat = new THREE.MeshStandardMaterial({ color: "#1a1614", roughness: 0.94, metalness: 0.04 });
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R, ARENA_R + 0.4, 0.5, 48), floorMat);
      disk.position.set(x, 23.68, z);
      const inlay = new THREE.Mesh(
        new THREE.RingGeometry(ARENA_R - 1.4, ARENA_R - 0.55, 48),
        new THREE.MeshStandardMaterial({ color: "#3a241c", roughness: 0.8, metalness: 0.12 }),
      );
      inlay.rotation.x = -Math.PI / 2;
      inlay.position.set(x, 24.01, z);
      const wallMat = new THREE.MeshStandardMaterial({ color: "#241e1b", roughness: 0.92, side: THREE.BackSide });
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R - 0.15, ARENA_R - 0.15, 18, 40, 1, true), wallMat);
      wall.position.set(x, 33, z);
      const ceil = new THREE.Mesh(
        new THREE.CylinderGeometry(ARENA_R + 0.2, ARENA_R + 0.2, 0.7, 40),
        new THREE.MeshStandardMaterial({ color: "#100c0a", roughness: 1, side: THREE.BackSide }),
      );
      ceil.position.set(x, 41.4, z);
      const pillarMat = new THREE.MeshStandardMaterial({ color: "#3a332c", roughness: 0.88 });
      const pillarGeo = new THREE.CylinderGeometry(0.55, 0.7, 8.5, 8);
      const fireMat = new THREE.MeshBasicMaterial({ color: "#ff7a2a" });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const px = x + Math.cos(a) * 15.2;
        const pz = z + Math.sin(a) * 15.2;
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(px, 28.2, pz);
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.2, 8), pillarMat);
        bowl.position.set(px, 24.7, pz);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), fireMat);
        flame.position.set(px, 24.95, pz);
        const torch = new THREE.PointLight("#ff7a3a", 6, 11, 2);
        torch.position.set(px, 25.4, pz);
        g.add(pillar, bowl, flame, torch);
      }
      const glow = new THREE.PointLight("#6a3a28", 4, 18, 2);
      glow.position.set(x, 28, z);
      g.add(disk, inlay, wall, ceil, glow);
      return g;
    };
    const makeDoor = (x: number, z: number, yaw: number) => {
      const g = new THREE.Group();
      const stone = new THREE.MeshStandardMaterial({ color: "#6a6258", roughness: 0.82 });
      const wood = new THREE.MeshStandardMaterial({ color: "#3a2418", roughness: 0.78 });
      const glow = new THREE.MeshStandardMaterial({ color: "#9fd0ff", emissive: "#3d7ed4", emissiveIntensity: 0.75, roughness: 0.3 });
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.6, 0.4), stone);
      left.position.set(-1.05, 1.3, 0);
      const right = left.clone();
      right.position.x = 1.05;
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.35, 0.45), stone);
      lintel.position.y = 2.55;
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.15, 0.12), wood);
      door.position.y = 1.1;
      const mark = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), glow);
      mark.position.set(0, 1.7, 0.08);
      g.add(left, right, lintel, door, mark);
      g.position.set(x, groundY(x, z), z);
      g.rotation.y = yaw;
      return g;
    };
    for (const realm of REALMS) {
      const radius = realm.id === "koy" ? 210 : 190;
      const sky =
        realm.id === "kanli"
          ? { color: "#4a1824", opacity: 0.7 }
          : realm.id === "kiyamet"
            ? { color: "#2a140c", opacity: 0.74 }
            : realm.id === "abis"
              ? { color: "#1a1030", opacity: 0.7 }
              : realm.id === "ay"
                ? { color: "#221a36", opacity: 0.62 }
                : realm.id === "dolunay"
                  ? { color: "#243044", opacity: 0.4 }
                  : realm.id === "koy2"
                    ? { color: "#7f9aaf", opacity: 0.34 }
                    : { color: "#9ec0dc", opacity: 0.34 };
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2.05),
        new THREE.MeshBasicMaterial({
          color: sky.color,
          side: THREE.BackSide,
          transparent: true,
          opacity: sky.opacity,
          depthWrite: false,
        }),
      );
      dome.position.set(realm.x, -4, realm.z);
      group.add(dome);
    }
    const arenas = new Map<string, THREE.Group>();
    const bossDoors: { name: string; id: string; x: number; z: number; yaw: number }[] = [];
    for (const row of BOSSES) {
      const arena = makeArena(row.x, row.z);
      arenas.set(row.id, arena);
      group.add(arena);
      const home = REALMS.find((item) => item.id === row.realm) ?? REALMS[0];
      let ang = Math.atan2(row.z - home.z, row.x - home.x);
      const rad = row.realm === "koy" ? FENCE_R - 1.15 : DUNGEON_BOUND - 2.2;
      if (row.realm === "koy" && Math.min(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang))) < 0.22) ang += 0.46;
      const dx = Math.cos(ang);
      const dz = Math.sin(ang);
      const x = home.x + dx * rad;
      const z = home.z + dz * rad;
      const yaw = Math.atan2(-dx, -dz);
      group.add(makeDoor(x, z, yaw));
      bossDoors.push({ name: row.name, id: row.id, x: x - dx * 2.8, z: z - dz * 2.8, yaw });
    }
    arenaRef.current = arenas;
    const meteors: MeteorRock[] = [];
    for (const spot of meteorSpots()) {
      const host = new THREE.Group();
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.15, 0),
        new THREE.MeshStandardMaterial({ color: "#4e3d58", emissive: "#6a3a88", emissiveIntensity: 0.28, roughness: 0.58, metalness: 0.2 }),
      );
      rock.position.y = 0.72;
      rock.castShadow = true;
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.36, 0),
        new THREE.MeshStandardMaterial({ color: "#e4c8ff", emissive: "#b060ee", emissiveIntensity: 0.85, roughness: 0.2 }),
      );
      crystal.position.y = 1.5;
      host.add(rock, crystal);
      host.position.set(spot.x, groundY(spot.x, spot.z), spot.z);
      group.add(host);
      const hp = meteorMaxHp(spot.level);
      const pack = 700 + meteors.length;
      meteors.push({ id: spot.id, name: spot.name, level: spot.level, realm: spot.realm, x: spot.x, z: spot.z, hp, hpMax: hp, mesh: host, broken: false, respawn: 0, wave: 0, pack });
    }
    meteorRef.current = meteors;
    const summonMeteor = (rock: (typeof meteors)[number], count: number) => {
      const spec = SPECIES.slice().sort((a, b) => Math.abs(a.level - rock.level) - Math.abs(b.level - rock.level))[0] ?? SPECIES[0];
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + rock.wave * 0.4;
        const rad = 2.8 + (i % 3) * 0.85;
        const x = rock.x + Math.cos(ang) * rad;
        const z = rock.z + Math.sin(ang) * rad;
        const beast = createBeast(x, z, `met-${rock.id}-${rock.wave}-${i}`, rock.pack, {
          ...spec,
          level: rock.level,
          name: spec.name,
        });
        beast.anger = true;
        beast.boss = false;
        beast.roam = 0.55;
        beast.root.position.y = groundY(x, z);
        beastsRef.current.push(beast);
        group.add(beast.root);
      }
    };
    const reapMeteor = (rock: (typeof meteors)[number]) => {
      const playerLevel = useRpg.getState().level;
      let xp = 0;
      let gold = 0;
      for (const beast of beastsRef.current) {
        if (beast.pack !== rock.pack || !beast.alive) continue;
        beast.alive = false;
        beast.root.visible = false;
        xp += mobXp(beast.level, false, playerLevel);
        gold += 4 + beast.level;
        useRpg.getState().noteKill(beast.specId, beast.level);
      }
      if (xp) shareXp(xp);
      if (gold) useRpg.getState().addGold(gold);
      if (xp || gold) floatAt(rock.x, 2.8, rock.z, `+${xp} XP · +${gold} altın`, false);
    };
    chipMeteor.current = (rock, dmg) => {
      if (rock.broken || dmg <= 0) return;
      const dealt = mitigate(rock.level, useRpg.getState().level, dmg);
      rock.hp = Math.max(0, rock.hp - dealt);
      floatAt(rock.x, 2.3, rock.z, `${dealt}`, false);
      if (rock.hp > 0) {
        const ratio = rock.hp / rock.hpMax;
        while (rock.wave < METEOR_WAVES.length && ratio <= METEOR_WAVES[rock.wave]!.pct) {
          summonMeteor(rock, METEOR_WAVES[rock.wave]!.n);
          rock.wave += 1;
        }
        return;
      }
      reapMeteor(rock);
      rock.broken = true;
      rock.mesh.visible = false;
      rock.respawn = 15;
      const dropX = rock.x;
      const dropZ = rock.z;
      const realm = REALMS.find((row) => row.id === rock.realm) ?? REALMS[0];
      for (let n = 0; n < 48; n++) {
        const ang = Math.random() * Math.PI * 2;
        const minR = realm.id === "koy" ? FENCE_R + 18 : 44;
        const span = realm.id === "koy" ? 130 : 70;
        const rad = minR + Math.random() * span;
        const nx = realm.x + Math.cos(ang) * rad;
        const nz = realm.z + Math.sin(ang) * rad;
        if (!meteorOutside(realm.id, nx, nz)) continue;
        if (meteorRef.current.some((row) => row !== rock && Math.hypot(row.x - nx, row.z - nz) < 16)) continue;
        rock.x = nx;
        rock.z = nz;
        rock.mesh.position.set(nx, groundY(nx, nz), nz);
        placeMeteor(rock.id, nx, nz, false);
        break;
      }
      if (meteorSpots().find((row) => row.id === rock.id)?.live !== false) placeMeteor(rock.id, rock.x, rock.z, false);
      const drops = meteorLoot(rock.level, useRpg.getState().level, rock.realm);
      useRpg.getState().noteMeteor(rock.id);
      let stored = 0;
      for (const item of drops) {
        if (tryReceiveItem(item)) stored += 1;
        else placeChest([item as Item], dropX + 0.5, dropZ + 0.3);
      }
      systemSay(stored ? `${rock.name} kırıldı · ${stored} eşya` : `${rock.name} kırıldı, çanta dolu`);
    };
    const spawnDungeon = (boss: (typeof BOSSES)[number], wave: number) => {
      const spec = SPECIES.find((item) => item.id === boss.spec);
      if (!spec) return;
      const counts = [3, 3, 3, 4, 1];
      const n = counts[wave - 1] ?? 1;
      const bossWave = wave === 5;
      const level = bossWave ? boss.level : Math.max(1, boss.level - (5 - wave) * 3);
      const pack = 900 + BOSSES.findIndex((item) => item.id === boss.id);
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / Math.max(1, n);
        const rad = bossWave ? 0 : 11;
        const x = boss.x + Math.cos(ang) * rad;
        const z = boss.z + Math.sin(ang) * rad;
        const beast = createBeast(x, z, `dun-${boss.id}-w${wave}-${i}`, pack, {
          ...spec,
          id: bossWave ? boss.id : spec.id,
          name: bossWave ? boss.name : spec.name,
          level,
          scale: spec.scale * (bossWave ? 1.45 : 1.05),
        });
        beast.anger = true;
        beast.roam = 1.2;
        beast.boss = bossWave;
        const mul = bossWave ? 8 : 0.5 + wave * 0.2;
        beast.hp = beast.hpMax = Math.round(beast.hpMax * mul);
        beast.root.position.y = groundY(x, z, true);
        beastsRef.current.push(beast);
        group.add(beast.root);
      }
    };
    dungeonApi.current.spawn = spawnDungeon;
    dungeonApi.current.clear = (pack) => {
      for (const beast of beastsRef.current) {
        if (beast.pack === pack) beast.root.removeFromParent();
      }
      beastsRef.current = beastsRef.current.filter((beast) => beast.pack !== pack);
    };
    dropEnter.current();
    dropEnter.current = bindDungeonEnter((id) => {
      const boss = BOSSES.find((item) => item.id === id);
      if (!boss || dungeonNow() || useRpg.getState().down) return;
      beginRun({ bossId: boss.id, wave: 1, name: boss.name }, { x: boss.x, z: boss.z, y: 24, r: ARENA_WALK });
      sim.x = boss.x;
      sim.z = boss.z;
      dungeonApi.current.spawn(boss, 1);
      useRpg.setState({ bossPrompt: null, toast: `${boss.name} zindanı. Dalga 1` });
    });
    const mentors = MENTORS.map((row) => {
      const mentor = createMentor(row.name, row.x, row.z, faceYaw(row.x, row.z), row.cls);
      const arrow = makeIconSprite("/ui/npc-ok.png", 0.62, 0.84);
      arrow.name = "skill-arrow";
      arrow.position.y = 2.2;
      arrow.visible = false;
      mentor.root.add(arrow);
      group.add(mentor.root);
      trackProp({
        id: `mentor-${row.id}`,
        label: row.name,
        kind: "npc",
        object: mentor.root,
        base: { x: row.x, y: 0, z: row.z, yaw: mentor.root.rotation.y },
        mark: row.name,
      });
      return mentor;
    });
    const lootHost = new THREE.Group();
    group.add(lootHost);
    lootRoot.current = lootHost;
    const townDefs: { role: NearKind; name: string; x: number; z: number; cloth: string; spear?: boolean; yaw?: number; map?: string }[] = [
      { role: "guard", name: "Köy Muhafızı", x: 2.2, z: 2.5, cloth: "#3a4634", spear: true, yaw: Math.atan2(0 - 2.2, 54 - 2.5) },
      { role: "armor", name: "Zırhçı", x: -24, z: -10, cloth: "#4a4036" },
      { role: "weapon", name: "Silahçı", x: 24, z: -10, cloth: "#4a3434" },
      { role: "market", name: "Satıcı", x: -12.95, z: 19.85, cloth: "#314438" },
      { role: "depot", name: "Depo", x: 11.2, z: 24.2, cloth: "#343844" },
      { role: "stable", name: "Seyis", x: 16.6, z: 16.4, cloth: "#5a4630" },
      { role: "fisher", name: "Balıkçı", x: FISHER_STAND.x, z: FISHER_STAND.z, cloth: "#2c4550" },
      { role: "miner", name: "Madenci", x: 70, z: 10, cloth: "#4a4034" },
      { role: "craft", name: "Üretimci", x: -18, z: 8, cloth: "#3c3428" },
      { role: "gate", name: "Işınlayıcı", x: realmGate("koy").x, z: realmGate("koy").z, cloth: "#24343c" },
    ];
    for (const realm of REALMS) {
      if (realm.id === "koy") continue;
      const herald = realmHerald(realm.id);
      const gate = realmGate(realm.id);
      townDefs.push({ role: "herald", name: "Görevli", x: herald.x, z: herald.z, cloth: "#3a3428", map: realm.id });
      townDefs.push({ role: "gate", name: "Işınlayıcı", x: gate.x, z: gate.z, cloth: "#24343c" });
      townDefs.push({ role: "market", name: "Satıcı", x: realm.x + 6.4, z: realm.z - 3.4, cloth: "#314438" });
      townDefs.push({ role: "smith", name: "Demirci", x: realm.x - 6.4, z: realm.z - 3.4, cloth: "#5a3030" });
    }
    townsRef.current = townDefs.map((row, index) => {
      const npc = createTownsman(row.name, row.x, row.z, row.yaw ?? faceYaw(row.x, row.z), row.cloth, Boolean(row.spear));
      npc.root.position.y = groundY(row.x, row.z);
      group.add(npc.root);
      trackProp({
        id: `npc-${row.role}-${index}`,
        label: row.map ? `${row.name} (${row.map})` : row.name,
        kind: "npc",
        object: npc.root,
        base: { x: npc.root.position.x, y: npc.root.position.y, z: npc.root.position.z, yaw: npc.root.rotation.y },
        mark: row.name,
      });
      return { root: npc.root, hips: npc.hips, role: row.role, map: row.map };
    });
    for (const door of bossDoors) {
      const npc = createTownsman(door.name, door.x, door.z, door.yaw, "#3a2430", true);
      npc.root.position.y = groundY(door.x, door.z);
      group.add(npc.root);
      townsRef.current.push({ root: npc.root, hips: npc.hips, role: "boss", map: door.id });
    }
    const stableTown = townsRef.current.find((row) => row.role === "stable");
    if (stableTown) {
      const horse = createHorse();
      const yaw = stableTown.root.rotation.y;
      const side = 2.35;
      const hx = stableTown.root.position.x + Math.cos(yaw) * side;
      const hz = stableTown.root.position.z - Math.sin(yaw) * side;
      horse.root.position.set(hx, groundY(hx, hz), hz);
      horse.root.rotation.y = yaw + Math.PI / 2;
      group.add(horse.root);
      horseRef.current = horse;
    }
    const mountHorse = createHorse(null, { hitched: false });
    mountHorse.root.visible = false;
    group.add(mountHorse.root);
    mountHorseRef.current = mountHorse.root;
    const ringMat = new THREE.MeshBasicMaterial({ color: "#e2b45a", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const levelRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 28), ringMat);
    levelRing.rotation.x = -Math.PI / 2;
    levelRing.visible = false;
    group.add(levelRing);
    levelRingRef.current = levelRing;
    const capBadge = makeIconSprite("/ui/max-level.png", 0.46, 0.46);
    capBadge.visible = false;
    group.add(capBadge);
    maxBadge.current = capBadge;
    const floatRoot = new THREE.Group();
    group.add(floatRoot);
    floatRootRef.current = floatRoot;
    smithNpc.root.position.y = groundY(smithNpc.root.position.x, smithNpc.root.position.z);
    group.add(smithNpc.root);
    trackProp({
      id: "npc-smith",
      label: "Demirci",
      kind: "npc",
      object: smithNpc.root,
      base: { x: smithNpc.root.position.x, y: smithNpc.root.position.y, z: smithNpc.root.position.z, yaw: smithNpc.root.rotation.y },
      mark: "Demirci",
    });
    wellRef.current = null;
    smithRef.current = smithNpc;
    const stall = new THREE.Group();
    stall.name = "stall-table";
    const wood = new THREE.MeshStandardMaterial({ color: "#6a4428", roughness: 0.72 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.72), wood);
    top.position.y = 0.62;
    top.castShadow = true;
    const legGeo = new THREE.BoxGeometry(0.06, 0.58, 0.06);
    for (const [lx, lz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]] as const) {
      const leg = new THREE.Mesh(legGeo, wood);
      leg.position.set(lx, 0.29, lz);
      stall.add(leg);
    }
    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.02, 0.62),
      new THREE.MeshStandardMaterial({ color: "#8a3038", roughness: 0.84 }),
    );
    cloth.position.y = 0.67;
    stall.add(top, cloth);
    stall.visible = false;
    group.add(stall);
    stallRef.current = stall;
    const splash = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.42, 22),
      new THREE.MeshBasicMaterial({ color: "#d7e7ef", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    splash.rotation.x = -Math.PI / 2;
    splash.visible = false;
    group.add(splash);
    splashRef.current = splash;
    beastsRef.current = beasts;
    mentorsRef.current = mentors;

    const dustCanvas = document.createElement("canvas");
    dustCanvas.width = 64;
    dustCanvas.height = 64;
    const dustCtx = dustCanvas.getContext("2d");
    if (dustCtx) {
      const grd = dustCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grd.addColorStop(0, "rgba(214,204,186,0.95)");
      grd.addColorStop(1, "rgba(170,150,120,0)");
      dustCtx.fillStyle = grd;
      dustCtx.fillRect(0, 0, 64, 64);
    }
    const dustMap = new THREE.CanvasTexture(dustCanvas);
    dustMap.colorSpace = THREE.SRGBColorSpace;
    dustRef.current = Array.from({ length: 14 }, () => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: dustMap,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      sprite.visible = false;
      sprite.scale.set(0.3, 0.3, 0.3);
      group.add(sprite);
      return { sprite, life: 1, vy: 0.4 };
    });

    const fx = createSwingFx();
    group.add(fx.root);
    fighterRef.current = fx;
    const mountPlayer = (classId: string) => {
      const mine = ++mountGen.current;
      classWanted.current = classId;
      const holder = rigRef.current;
      if (!holder || dead) return;
      const model = createClassAvatar(classId);
      if (mine !== mountGen.current) return;
      for (const child of [...holder.children]) {
        holder.remove(child);
        disposeTree(child);
      }
      const remoteHost = remoteRootRef.current;
      if (remoteHost) {
        for (const av of remoteAvatars.current.values()) remoteHost.remove(av.root);
        remoteAvatars.current.clear();
      }
      holder.add(model);
      holder.updateMatrixWorld(true);
      modelRef.current = model;
      model.updateMatrixWorld(true);
      restRef.current = captureRest(model);
      templateRef.current = cloneSkeleton(model);
      gearRev.current = -1;
      const pick = (name: string) => model.getObjectByName(name) as THREE.Bone | undefined;
      const need = (name: string) => {
        const bone = pick(name);
        if (!bone) throw new Error(`missing bone ${name}`);
        return bone;
      };
      armRef.current = {
        left: need("LeftArm"),
        right: need("RightArm"),
        lFore: need("LeftForeArm"),
        rFore: need("RightForeArm"),
        lHand: pick("LeftHand") ?? null,
        rHand: pick("RightHand") ?? null,
        lShoulder: pick("LeftShoulder") ?? null,
        rShoulder: pick("RightShoulder") ?? null,
        spine: pick("Spine") ?? pick("Spine1") ?? null,
      };
      classLoaded.current = classId;
    };
    mountRef.current = mountPlayer;
    const firstClass = useRpg.getState().classId || "savasci";
    classWanted.current = firstClass;
    mountPlayer(firstClass);

    const temp = new THREE.Mesh(
      new THREE.CircleGeometry(28, 24),
      new THREE.MeshStandardMaterial({ color: "#4d5a3e", roughness: 1 }),
    );
    temp.rotation.x = -Math.PI / 2;
    temp.receiveShadow = true;
    group.add(temp);

    const light = lightRef.current;
    if (light) scene.add(light.target);

    const loader = new THREE.TextureLoader();
    const load = (url: string) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });

    let sky: THREE.Object3D | null = null;
    void (async () => {
      try {
        const [stone, wood, thatch, skyTex] = await Promise.all([
          load("/textures/stone.jpg"),
          load("/textures/wood.jpg"),
          load("/textures/thatch.jpg"),
          load("/textures/sky.jpg"),
        ]);
        if (dead) return;
        const ground = await composeGround();
        if (dead) return;
        group.remove(temp);
        temp.geometry.dispose();
        (temp.material as THREE.Material).dispose();
        const built = buildVillage({ stone, wood, thatch, ground });
        group.add(built.root);
        puffsRef.current = built.puffs;
        if (built.dummy) dummyRef.current = adoptDummy(built.dummy as THREE.Group);

        skyTex.colorSpace = THREE.SRGBColorSpace;
        sky = new THREE.Mesh(
          new THREE.SphereGeometry(520, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
          new THREE.MeshBasicMaterial({
            map: skyTex,
            side: THREE.BackSide,
            fog: false,
            depthWrite: false,
          }),
        );
        sky.position.y = -18;
        scene.add(sky);

        const pmrem = new THREE.PMREMGenerator(gl);
        const envSrc = skyTex.clone();
        envSrc.mapping = THREE.EquirectangularReflectionMapping;
        envSrc.needsUpdate = true;
        scene.environment = pmrem.fromEquirectangular(envSrc).texture;
        scene.environmentIntensity = 0.16;
        pmrem.dispose();
        useHud.getState().setReady(true);
      } catch (error) {
        console.error(error);
        if (!dead) useHud.getState().setReady(true);
      }
    })();

    return () => {
      dead = true;
      weatherRef.current?.dispose();
      weatherRef.current = null;
      combatRef.current?.dispose();
      combatRef.current = null;
      const ring = ringRef.current;
      if (ring) {
        ring.parent?.remove(ring);
        ring.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((item) => item.dispose());
          else mat.dispose();
        });
      }
      ringRef.current = null;
      const guide = guideRef.current;
      if (guide) {
        guide.arrow.parent?.remove(guide.arrow);
        guide.beacon.parent?.remove(guide.beacon);
        disposeTree(guide.arrow);
        disposeTree(guide.beacon);
        guideRef.current = null;
      }
      for (const arrow of npcArrowRef.current) {
        arrow.parent?.remove(arrow);
        const sprite = arrow as THREE.Sprite;
        const mat = sprite.material;
        if (mat && !Array.isArray(mat)) {
          mat.map?.dispose();
          mat.dispose();
        }
      }
      npcArrowRef.current = [];
      worldFrame = null;
      scene.remove(group);
      if (sky) scene.remove(sky);
      if (light) scene.remove(light.target);
      disposeScenery();
      clearEditables();
      unmountStudio();
      hostRef.current = null;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      actRef.current = {};
      rigRef.current = null;
      const fp = fpRef.current;
      if (fp) {
        fp.root.parent?.remove(fp.root);
        disposeTree(fp.root);
        fpRef.current = null;
      }
      puffsRef.current = [];
      dustRef.current = [];
      fighterRef.current = null;
      restRef.current = null;
      modelRef.current = null;
      templateRef.current = null;
      remoteRootRef.current = null;
      remoteAvatars.current.clear();
      dummyRef.current = null;
      beastsRef.current = [];
      endRun();
      dropEnter.current();
      meteorRef.current = [];
      arenaRef.current = new Map();
      mentorsRef.current = [];
      townsRef.current = [];
      horseRef.current = null;
      lootMeshes.current.clear();
      lootRoot.current = null;
      wellRef.current = null;
      smithRef.current = null;
    };
  }, [gl, scene]);

  const floatAt = (x: number, y: number, z: number, text: string, crit: boolean) => {
    const host = document.getElementById("combat-floats");
    if (!host) return;
    const el = document.createElement("div");
    el.textContent = text;
    el.className = crit
      ? "pointer-events-none absolute text-lg font-semibold text-gold"
      : "pointer-events-none absolute text-base font-semibold text-fg";
    host.appendChild(el);
    if (!viewport.placeWorld(el, camera, x, y, z)) {
      el.remove();
      return;
    }
    const born = performance.now();
    const step = () => {
      const k = (performance.now() - born) / 800;
      el.style.opacity = String(Math.max(0, 1 - k));
      el.style.transform = `translate(-50%, ${-k * 36}px)`;
      if (k < 1) requestAnimationFrame(step);
      else el.remove();
    };
    requestAnimationFrame(step);
  };

  const resolveHits = () => {
    const fx = fighterRef.current;
    const arms = armRef.current;
    if (!fx || !arms) return;
    const style = weaponStyleOf(useRpg.getState().equipped.weapon?.id);
    if (style === "kazma" || style === "olta" || style === "bow" || style === "staff") {
      if (fx.swing < 0.12) hitLatch.current = false;
      return;
    }
    if (fx.swing < 0.42 || fx.swing > 0.62) {
      if (fx.swing < 0.2) hitLatch.current = false;
      return;
    }
    if (hitLatch.current) return;
    const handBone = fx.side > 0 ? arms.rHand : arms.lHand;
    const hand = handBone;
    if (!hand) return;
    hand.getWorldPosition(fist.current);
    const reachDist = style === "pala" ? 2.7 : style === "dagger" ? 2.05 : 2.35;
    const cone = (tx: number, tz: number) => {
      const dx = tx - sim.x;
      const dz = tz - sim.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= reachDist || dist < 0.05) return false;
      const fx = -Math.sin(sim.yaw);
      const fz = -Math.cos(sim.yaw);
      return (dx * fx + dz * fz) / dist > 0.5;
    };
    const { duel } = readTarget();
    const leash = style === "dagger" ? 3.3 : 3.6;
    if (duel.phase === "live") {
      const foe = remotes.get(duel.id);
      if (foe && Math.hypot(foe.x - sim.x, foe.z - sim.z) < leash) {
        hitLatch.current = true;
        const hit = useRpg.getState().punch();
        sendDuelHit(hit.dmg, hit.crit);
        floatAt(foe.x, 1.6, foe.z, `${hit.crit ? "KRİT " : ""}${hit.dmg}`, hit.crit);
        return;
      }
    }
    const selNow = readTarget().sel;
    const herd = beastsRef.current;
    const dummy = dummyRef.current;
    const aoe = style === "sword" || style === "dagger";
    const lockedMelee =
      selNow?.kind === "mob" && selNow.id !== "dummy"
        ? herd.find((beast) => beast.id === selNow.id && beast.alive && Math.hypot(beast.root.position.x - sim.x, beast.root.position.z - sim.z) < leash)
        : null;
    const beasts = herd.filter((beast) => beast.alive && cone(beast.root.position.x, beast.root.position.z));
    const cut = lockedMelee ? [lockedMelee] : aoe ? beasts : beasts.slice(0, 1);
    const dummyHit = Boolean(dummy?.alive && cone(dummy.root.position.x, dummy.root.position.z));
    const lockedMeteor =
      selNow?.kind === "meteor"
        ? meteorRef.current.find((row) => !row.broken && row.id === selNow.id && Math.hypot(row.x - sim.x, row.z - sim.z) < 3.5)
        : null;
    const rock = lockedMeteor ?? meteorRef.current.find((row) => !row.broken && cone(row.x, row.z));
    if (!cut.length && !dummyHit && !rock) return;
    hitLatch.current = true;
    const hit = useRpg.getState().punch();
    if (rock) chipMeteor.current(rock, hit.dmg);
    if (dummyHit && dummy) {
      hitDummy(dummy, hit.dmg);
      floatAt(dummy.root.position.x, 1.7, dummy.root.position.z, `${hit.crit ? "KRİT " : ""}${hit.dmg}`, hit.crit);
    }
    for (const beast of cut) landRef.current(beast, hit.dmg, hit.crit);
  };

  useFrame((_, delta) => {
    const run = (dt: number) => {
    viewport.sync();
    let autoHit = false;
    tickCreative();
    tickStudio(dt, sim.x, sim.z);
    if (studioPainting()) {
      const rect = gl.domElement.getBoundingClientRect();
      const point = studioPaintPoint();
      if (rect.width > 2 && rect.height > 2) {
        _ndc.set(((point.x - rect.left) / rect.width) * 2 - 1, -((point.y - rect.top) / rect.height) * 2 + 1);
        _picker.setFromCamera(_ndc, camera);
        studioRay(_picker);
      }
    }
    const playing = useHud.getState().playing;
    const click = takePick();
    if (click && playing) {
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width > 2 && rect.height > 2) {
        _ndc.set(((click.x - rect.left) / rect.width) * 2 - 1, -((click.y - rect.top) / rect.height) * 2 + 1);
        _picker.setFromCamera(_ndc, camera);
        if (editArmed()) {
          const editId = pickEditable(_picker);
          if (editId) selectEditable(editId);
        } else {
        let bestT = 40;
        const hit: { best: Sel | null; talk: { role: NearKind; mentor: string | null } | null; x: number; z: number } = {
          best: null,
          talk: null,
          x: 0,
          z: 0,
        };
        const consider = (t: number | null, next: Sel | null, npc?: { role: NearKind; mentor: string | null }, x = 0, z = 0) => {
          if (t != null && t < bestT) {
            bestT = t;
            hit.best = next;
            hit.talk = npc ?? null;
            hit.x = x;
            hit.z = z;
          }
        };
        const dummyHit = dummyRef.current;
        if (dummyHit?.alive) {
          consider(cylinderT(_picker.ray, dummyHit.root.position.x, dummyHit.root.position.z, 0.72, 0, 2.5), {
            kind: "mob",
            id: "dummy",
            name: "Talim Kuklası",
          });
        }
        for (const beast of beastsRef.current) {
          if (!beast.alive || !beast.root.visible) continue;
          const by = beast.root.position.y;
          consider(cylinderT(_picker.ray, beast.root.position.x, beast.root.position.z, 0.85, by, by + 2.05), {
            kind: "mob",
            id: beast.id,
            name: beast.name,
          });
        }
        for (const rock of meteorRef.current) {
          if (rock.broken || !rock.mesh.visible) continue;
          const by = rock.mesh.position.y;
          consider(cylinderT(_picker.ray, rock.x, rock.z, 1.35, by, by + 2.35), {
            kind: "meteor",
            id: rock.id,
            name: rock.name,
            level: rock.level,
          });
        }
        for (const [id, body] of remotes) {
          consider(cylinderT(_picker.ray, body.x, body.z, 0.58, 0, 2.05), {
            kind: "player",
            id,
            nick: body.nick,
            level: body.level,
          });
        }
        for (const town of townsRef.current) {
          consider(cylinderT(_picker.ray, town.root.position.x, town.root.position.z, 0.55, 0, 2.05), null, {
            role: town.role,
            mentor: town.map ?? null,
          }, town.root.position.x, town.root.position.z);
        }
        for (const mentor of mentorsRef.current) {
          const row = MENTORS.find((item) => item.name === mentor.name);
          consider(cylinderT(_picker.ray, mentor.root.position.x, mentor.root.position.z, 0.55, 0, 2.05), null, {
            role: "mentor",
            mentor: row?.id ?? null,
          }, mentor.root.position.x, mentor.root.position.z);
        }
        const smith = smithRef.current;
        if (smith) {
          consider(cylinderT(_picker.ray, smith.root.position.x, smith.root.position.z, 0.6, 0, 2.1), null, {
            role: "smith",
            mentor: null,
          }, smith.root.position.x, smith.root.position.z);
        }
        consider(cylinderT(_picker.ray, WELL.x, WELL.z, 0.7, 0, 1.3), null, { role: "well", mentor: null }, WELL.x, WELL.z);
        for (const vein of liveVeins()) {
          consider(cylinderT(_picker.ray, vein.x, vein.z, 0.7, 0, 1.2), null, { role: "vein", mentor: null }, vein.x, vein.z);
        }
        const table = stallRef.current;
        if (table?.visible) {
          consider(cylinderT(_picker.ray, table.position.x, table.position.z, 0.9, 0, 1.1), null, { role: "stall", mentor: null }, table.position.x, table.position.z);
        }
        for (const [id, mesh] of guestStalls.current) {
          if (!mesh.visible) continue;
          consider(cylinderT(_picker.ray, mesh.position.x, mesh.position.z, 0.9, 0, 1.1), null, { role: "stall", mentor: id }, mesh.position.x, mesh.position.z);
        }
        const engageClick = Boolean(click.engage);
        const useNpc = (talk: { role: NearKind; mentor: string | null }, x: number, z: number) => {
          if (talk.role === "vein") useRpg.getState().selectVein(x, z);
          else if (talk.role === "stall") openStallView(talk.mentor || "mine");
          else {
            useRpg.getState().setNear(talk.role, talk.mentor);
            useRpg.getState().interact();
          }
        };
        if (hit.talk) {
          const reach = hit.talk.role === "smith" || hit.talk.role === "boss" ? 2.8 : hit.talk.role === "well" ? 1.7 : hit.talk.role === "vein" ? 1.9 : hit.talk.role === "mentor" ? 2 : hit.talk.role === "stall" ? 3.2 : 2.2;
          const close = Math.hypot(sim.x - hit.x, sim.z - hit.z) <= reach;
          if (engageClick && !close) {
            engageRef.current = { kind: "use", role: hit.talk.role, mentor: hit.talk.mentor, x: hit.x, z: hit.z };
          } else if (close) {
            engageRef.current = null;
            useNpc(hit.talk, hit.x, hit.z);
          } else engageRef.current = null;
        } else if (hit.best && (hit.best.kind === "mob" || hit.best.kind === "meteor")) {
          setSelection(hit.best);
          engageRef.current = engageClick ? { kind: "fight", id: hit.best.id, what: hit.best.kind } : null;
        } else if (hit.best) {
          setSelection(hit.best);
          engageRef.current = null;
        } else {
          if (engageClick) engageRef.current = null;
          let dropId = "";
          let dropT = 12;
          for (const row of fieldLoot()) {
            const t = cylinderT(_picker.ray, row.x, row.z, 0.55, 0, 0.7);
            if (t != null && t < dropT && Math.hypot(row.x - sim.x, row.z - sim.z) < 2.4) {
              dropT = t;
              dropId = row.id;
            }
          }
          if (dropId) openChest(dropId);
          else if (engageClick) {
            const spot = groundHit(_picker.ray);
            if (spot && Math.hypot(spot.x - sim.x, spot.z - sim.z) > 0.45) {
              setSelection(null);
              engageRef.current = { kind: "go", x: spot.x, z: spot.z, stuck: 0, prev: 1e9 };
            } else engageRef.current = null;
          } else setSelection(null);
        }
        }
      }
    }
    const snap = playing && !wasPlaying.current;
    wasPlaying.current = playing;
    const hop = takeHop();
    if (hop && playing) {
      sim.x = hop.x;
      sim.z = hop.z;
      sim.speed = 0;
      engageRef.current = null;
    }

    let sprinting = false;
    const downNow = Boolean(playing && useRpg.getState().down);
    if (downNow && !wasDown.current) {
      engageRef.current = null;
      setSelection(null);
      releaseMoveKeys();
    }
    if (downNow) engageRef.current = null;
    wasDown.current = downNow;
    if (!playing) {
      sim.speed = 0;
      sim.menuAngle += dt * 0.07;
    } else if (useRpg.getState().down) {
      sim.speed = 0;
      sim.yaw = input.orbit;
    } else if (useRpg.getState().mapLoad) {
      sim.speed = 0;
    } else {
      const styleChase = weaponStyleOf(useRpg.getState().equipped.weapon?.id);
      const reachChase = styleChase === "bow" || styleChase === "staff" ? RANGED_HIT : styleChase === "dagger" ? 2.35 : 2.2;
      let closing = false;
      if (held("Space") && !useRpg.getState().chore && !useRpg.getState().down) {
        const sel = readTarget().sel;
        if (sel && (sel.kind === "mob" || sel.kind === "meteor")) {
          let dist = 99;
          let live = false;
          if (sel.kind === "meteor") {
            const rock = meteorRef.current.find((row) => row.id === sel.id && !row.broken);
            if (rock) {
              live = true;
              dist = Math.hypot(rock.x - sim.x, rock.z - sim.z);
            }
          } else {
            const mob = sel.id === "dummy" ? dummyRef.current : beastsRef.current.find((beast) => beast.id === sel.id && beast.alive) ?? null;
            if (mob?.alive) {
              live = true;
              dist = Math.hypot(mob.root.position.x - sim.x, mob.root.position.z - sim.z);
            }
          }
          if (live && dist > reachChase) {
            closing = true;
            engageRef.current = { kind: "fight", id: sel.id, what: sel.kind === "meteor" ? "meteor" : "mob" };
          }
        }
      }
      const { fwd, str } = axes();
      const camYaw = input.orbit;
      sim.cameraYaw = camYaw;
      const fx = -Math.sin(camYaw);
      const fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw);
      const rz = -Math.sin(camYaw);
      let mx = fx * fwd + rx * str;
      let mz = fz * fwd + rz * str;
      let len = Math.hypot(mx, mz);
      const order = engageRef.current;
      if (!closing && (len > 0.12 || useRpg.getState().down)) {
        if (len > 0.12) engageRef.current = null;
      } else if (order) {
        let tx = 0;
        let tz = 0;
        let ok = false;
        if (order.kind === "fight") {
          if (order.what === "meteor") {
            const rock = meteorRef.current.find((row) => row.id === order.id && !row.broken);
            if (rock) {
              tx = rock.x;
              tz = rock.z;
              ok = true;
            }
          } else {
            const mob = order.id === "dummy" ? dummyRef.current : beastsRef.current.find((beast) => beast.id === order.id && beast.alive) ?? null;
            if (mob?.alive) {
              tx = mob.root.position.x;
              tz = mob.root.position.z;
              ok = true;
            }
          }
          if (!ok) engageRef.current = null;
        } else if (order.kind === "go") {
          tx = order.x;
          tz = order.z;
          ok = true;
        } else {
          tx = order.x;
          tz = order.z;
          ok = true;
        }
        if (ok) {
          const dx = tx - sim.x;
          const dz = tz - sim.z;
          const dist = Math.hypot(dx, dz) || 0.0001;
          const styleNow = weaponStyleOf(useRpg.getState().equipped.weapon?.id);
          const stop =
            order.kind === "go"
              ? 0.42
              : order.kind === "use"
              ? order.role === "smith" || order.role === "boss"
                ? 2.15
                : order.role === "stall"
                  ? 2.3
                  : order.role === "well"
                    ? 1.3
                    : order.role === "vein"
                      ? 1.4
                      : order.role === "mentor"
                        ? 1.45
                        : 1.65
              : styleNow === "bow" || styleNow === "staff"
                ? RANGED_HIT - 0.35
                : 2.15;
          if (dist > stop) {
            mx = dx / dist;
            mz = dz / dist;
            len = 1;
            if (order.kind === "go") {
              if (dist > order.prev - 0.03) order.stuck += dt;
              else order.stuck = 0;
              order.prev = dist;
              if (order.stuck > 0.45) engageRef.current = null;
            }
          } else if (order.kind === "go") {
            engageRef.current = null;
          } else if (order.kind === "fight") {
            autoHit = styleNow !== "kazma" && styleNow !== "olta";
            const face = Math.atan2(-dx / dist, -dz / dist);
            const diff = Math.atan2(Math.sin(face - sim.yaw), Math.cos(face - sim.yaw));
            sim.yaw += diff * (1 - Math.exp(-10 * dt));
          } else {
            const role = order.role;
            const mentor = order.mentor;
            const ax = order.x;
            const az = order.z;
            engageRef.current = null;
            if (role === "vein") useRpg.getState().selectVein(ax, az);
            else if (role === "stall") openStallView(mentor || "mine");
            else {
              useRpg.getState().setNear(role, mentor);
              useRpg.getState().interact();
            }
          }
        }
      }
      const movingNow = len > 0.08;
      const chasing = Boolean(order);
      const sprintHeld = held("ShiftLeft") || held("ShiftRight") || input.sprint || input.joyY > 0.82 || chasing;
      sprinting = movingNow && sprintHeld && useRpg.getState().sta > 4;
      const swinging = (fighterRef.current?.swing ?? 0) > 0.04;
      const pace = useRpg.getState().moveSpeed(sprinting) * (swinging ? 0.22 : 1);
      const target = movingNow ? pace * Math.min(1, len) : 0;
      const rate = movingNow ? 22 : 30;
      sim.speed += (target - sim.speed) * (1 - Math.exp(-rate * dt));
      if (!movingNow && sim.speed < 0.04) sim.speed = 0;
      if (movingNow) {
        const tx = mx / len;
        const tz = mz / len;
        const turn = 1 - Math.exp(-16 * dt);
        sim.wishX += (tx - sim.wishX) * turn;
        sim.wishZ += (tz - sim.wishZ) * turn;
      } else {
        const fade = Math.exp(-14 * dt);
        sim.wishX *= fade;
        sim.wishZ *= fade;
      }
      const wlen = Math.hypot(sim.wishX, sim.wishZ);
      let moveX = 0;
      let moveZ = 0;
      if (wlen > 0.05) {
        moveX = sim.wishX / wlen;
        moveZ = sim.wishZ / wlen;
        const nx = sim.x + moveX * sim.speed * dt;
        const nz = sim.z + moveZ * sim.speed * dt;
        const next = slide(sim.x, sim.z, nx, nz, PLAYER_R);
        sim.x = next.x;
        sim.z = next.z;
        sim.phase += dt * (sprinting ? 10.4 : 6.6);
      } else {
        sim.phase += dt * 1.3;
      }
      if (inWater(sim.x, sim.z, 0)) {
        const dry = dryLand(sim.x, sim.z, PLAYER_R);
        if (dry) {
          sim.x = dry.x;
          sim.z = dry.z;
        }
      }
      if (wlen > 0.05 && sim.speed > 0.12) {
        const face = Math.atan2(-moveX, -moveZ);
        const diff = Math.atan2(Math.sin(face - sim.yaw), Math.cos(face - sim.yaw));
        sim.yaw += diff * (1 - Math.exp(-8 * dt));
      }
      const weaponNow = weaponStyleOf(useRpg.getState().equipped.weapon?.id);
      const lunge = fighterRef.current;
      if (weaponNow === "dagger" && lunge && lunge.swing > 0.22 && lunge.swing < 0.52) {
        const lx = -Math.sin(sim.yaw);
        const lz = -Math.cos(sim.yaw);
        const stepped = slide(sim.x, sim.z, sim.x + lx * 3.2 * dt, sim.z + lz * 3.2 * dt, PLAYER_R);
        sim.x = stepped.x;
        sim.z = stepped.z;
      }
      const extra = studioZoneName(sim.x, sim.z);
      const block = studioLevelBlock(sim.x, sim.z, useRpg.getState().level);
      const zone = extra ? `${zoneName(sim.x, sim.z)} · ${extra}` : zoneName(sim.x, sim.z);
      if (zone !== useHud.getState().zone) useHud.getState().setZone(zone);
      if (block && block !== zoneNote.current) {
        zoneNote.current = block;
        useRpg.setState({ toast: block });
      } else if (!block) zoneNote.current = "";
      const span = bridgeName(sim.x, sim.z);
      if (span) useRpg.getState().notePlace(span);
      if (!dungeonNow()) {
        const realmNow = realmAt(sim.x, sim.z);
        if (realmNow.id !== "koy") {
          const hub = 34;
          const outDist = Math.hypot(sim.x - realmNow.x, sim.z - realmNow.z);
          const outside = outDist > hub + 4;
          if (!fieldSide.current) fieldSide.current = outside ? "out" : "in";
          else if (fieldSide.current === "in" && outside) {
            fieldSide.current = "out";
            useRpg.getState().loadMap(`${realmNow.name} av sahası`);
          } else if (!outside && outDist < hub - 6) fieldSide.current = "in";
        }
      }
    }

    const rig = rigRef.current;
    if (rig) {
      const riding = Boolean(useRpg.getState().riding && useRpg.getState().steed);
      rig.position.set(sim.x, groundY(sim.x, sim.z, true) + (riding ? 0.2 : 0), sim.z);
      rig.rotation.y = sim.yaw;
      rig.visible = true;
    }
    const guide = guideRef.current;
    if (guide) {
      const mark = playing ? questGuide(sim.x, sim.z) : null;
      const tx = mark?.x ?? 0;
      const tz = mark?.z ?? 0;
      const showAt = (x: number, z: number, y: number) => {
        guide.arrow.visible = true;
        guide.arrow.position.set(x, y + Math.sin(lifeRef.current * 3.2) * 0.16, z);
        guide.arrow.rotation.set(0, 0, 0);
        guide.beacon.visible = true;
        guide.beacon.position.set(x, groundY(x, z) + 0.02, z);
        guide.beacon.scale.setScalar(0.9 + Math.sin(lifeRef.current * 5) * 0.12);
      };
      const hideGuide = () => {
        guide.arrow.visible = false;
        guide.beacon.visible = false;
      };
      if (!mark) hideGuide();
      else if (mark.kind === "mob") {
        const quest = useRpg.getState().quests.find((row) => !row.claimed && !row.done && row.mob);
        let best: Beast | null = null;
        let bestD = Infinity;
        if (quest?.mob) {
          for (const beast of beastsRef.current) {
            if (!beast.alive) continue;
            const hit = beast.specId === quest.mob || beast.id === quest.mob || beast.id.startsWith(`${quest.mob}-`);
            if (!hit) continue;
            const d = (beast.root.position.x - sim.x) ** 2 + (beast.root.position.z - sim.z) ** 2;
            if (d < bestD) {
              bestD = d;
              best = beast;
            }
          }
        }
        if (!best) hideGuide();
        else showAt(best.root.position.x, best.root.position.z, best.root.position.y + 1.55);
      } else {
        const role = (mark as { role?: string }).role;
        let host: THREE.Object3D | null = null;
        if (role === "smith" && smithRef.current) host = smithRef.current.root;
        else if (role) {
          let bestD = role === "herald" || role === "gate" ? 40 : 6;
          for (const town of townsRef.current) {
            if (town.role !== role) continue;
            const d = Math.hypot(town.root.position.x - tx, town.root.position.z - tz);
            if (d < bestD) {
              bestD = d;
              host = town.root;
            }
          }
        }
        const x = host ? host.position.x : tx;
        const z = host ? host.position.z : tz;
        const y = (host ? host.position.y : groundY(tx, tz)) + 2.05;
        showAt(x, z, y);
      }
    }
    const arrows = npcArrowRef.current;
    const marks = playing ? questNpcMarks() : [];
    for (let i = 0; i < arrows.length; i++) {
      const arrow = arrows[i];
      const mark = marks[i] as { x: number; z: number; role?: string } | undefined;
      if (!arrow) continue;
      if (!mark) {
        arrow.visible = false;
        continue;
      }
      const role = mark.role;
      let host: THREE.Object3D | null = null;
      if (role === "smith" && smithRef.current) host = smithRef.current.root;
      else if (role) {
        let bestD = role === "herald" ? 80 : 8;
        for (const town of townsRef.current) {
          if (town.role !== role) continue;
          const d = Math.hypot(town.root.position.x - mark.x, town.root.position.z - mark.z);
          if (d < bestD) {
            bestD = d;
            host = town.root;
          }
        }
      }
      const x = host ? host.position.x : mark.x;
      const z = host ? host.position.z : mark.z;
      const y = (host ? host.position.y : groundY(x, z)) + 2.35;
      const guideArrow = guideRef.current?.arrow;
      if (guideArrow?.visible && Math.hypot(guideArrow.position.x - x, guideArrow.position.z - z) < 1.2) {
        arrow.visible = false;
        continue;
      }
      arrow.visible = true;
      arrow.position.set(x, y + Math.sin(lifeRef.current * 3.2) * 0.12, z);
    }
    if (playing && hostRef.current) {
      for (const sp of studioSpawners()) {
        let pack = 0;
        for (let i = 0; i < sp.id.length; i++) pack = (pack * 33 + sp.id.charCodeAt(i)) % 5000;
        pack += 400;
        const alive = beastsRef.current.filter((beast) => beast.pack === pack && beast.alive).length;
        if (alive >= Math.max(1, sp.count)) {
          spawnClock.current[sp.id] = 0;
          continue;
        }
        spawnClock.current[sp.id] = (spawnClock.current[sp.id] ?? sp.respawn) + dt;
        if ((spawnClock.current[sp.id] ?? 0) < Math.max(3, sp.respawn)) continue;
        spawnClock.current[sp.id] = 0;
        const spec = SPECIES.find((item) => item.id === sp.spec);
        if (!spec) continue;
        const beast = createBeast(sp.x, sp.z, `st-${sp.id}-${alive}`, pack, spec);
        const mob = beast as typeof beast & { aggro: number; patrol: { x: number; z: number }[] };
        mob.roam = sp.roam;
        mob.aggro = sp.aggro;
        mob.patrol = sp.patrol;
        hostRef.current.add(mob.root);
        beastsRef.current.push(beast);
      }
    }
    const moving = playing && sim.speed > 0.2;
    lifeRef.current += dt;
    const rpg = useRpg.getState();
    const style: WeaponStyle = weaponStyleOf(rpg.equipped.weapon?.id);
    const tooling = style === "kazma" || style === "olta" || rpg.chore != null;
    const ranged = style === "bow" || style === "staff";
    const selNow = readTarget().sel;
    let huntDist = 99;
    if (ranged && selNow?.kind === "meteor") {
      const rock = meteorRef.current.find((row) => row.id === selNow.id && !row.broken);
      huntDist = rock ? Math.hypot(rock.x - sim.x, rock.z - sim.z) : 99;
    } else if (ranged && selNow?.kind === "mob") {
      const mob = selNow.id === "dummy" ? dummyRef.current : beastsRef.current.find((beast) => beast.id === selNow.id && beast.alive) ?? null;
      huntDist = mob?.alive ? Math.hypot(mob.root.position.x - sim.x, mob.root.position.z - sim.z) : 99;
    }
    const marked = selNow?.kind === "mob" || selNow?.kind === "meteor";
    const tooFar = ranged && marked && huntDist > RANGED_HIT;
    const spaceDown = playing && (held("Space") || autoHit) && !tooling && !rpg.down && (!ranged || (marked && !tooFar));
    const pressed = spaceDown && !spaceWas.current;
    spaceWas.current = spaceDown;
    const runTarget = sprinting ? 1 : 0;
    runBlend.current += (runTarget - runBlend.current) * (1 - Math.exp(-6 * dt));
    const fx = fighterRef.current;
    if (tooFar && fx) {
      fx.swing = 0;
      fx.queue = 0;
      shotLatch.current = false;
    }
    const cid = rpg.classId || "savasci";
    if (mountRef.current && cid !== classLoaded.current && cid !== classWanted.current) {
      void mountRef.current(cid);
    }
    const cap = style === "sword" || style === "pala" || style === "staff" ? 3 : style === "dagger" ? 2 : 1;
    if (fx) advanceSwing(fx, false, dt, rpg.attackGap(), { pressed, held: spaceDown, now: performance.now(), cap });
    if (pressed && cid !== "okcu") playAttack(cid);
    if (fx) fx.side = style === "dagger" && fx.combo === 2 ? -1 : 1;
    const armed = style !== "fist";
    const chore = rpg.chore;
    const toolSwing =
      chore?.kind === "mine"
        ? Math.sin(lifeRef.current * 8.5) * 0.5 + 0.5
        : chore?.kind === "fish"
          ? 0.45
          : (fx?.swing ?? 0);
    if (fx && (style === "sword" || style === "staff" || style === "pala" || style === "dagger")) fx.side = style === "dagger" && fx.combo === 2 ? -1 : 1;
    if (modelRef.current && restRef.current) {
      try {
        poseActor(
          modelRef.current,
          restRef.current,
          moving,
          runBlend.current,
          sim.phase,
          lifeRef.current,
          toolSwing,
          style === "dagger" || !armed ? (fx?.side ?? 1) : 1,
          armed,
          style,
          fx?.combo || 1,
          Boolean(useRpg.getState().riding),
        );
        syncBow(modelRef.current, style === "bow" ? punchExtend(fx?.swing ?? 0) : 0);
      } catch (error) {
        console.error(error);
      }
    }
    if (fx) {
      const hand = style === "bow" || fx.side > 0 ? armRef.current?.rHand : armRef.current?.lHand;
      if (hand) hand.getWorldPosition(fist.current);
      punchArc(fx, fist.current, dt);
      if (fx.swing < 0.12) shotLatch.current = false;
      const release = style === "bow" ? fx.swing > 0.58 && fx.swing < 0.76 : style === "staff" && fx.swing > 0.3 && fx.swing < 0.48;
      if (release && !shotLatch.current && modelRef.current && !tooFar) {
        shotLatch.current = true;
        const origin = _aim.copy(fist.current);
        if (origin.y < groundY(sim.x, sim.z, true) + 0.45) origin.set(sim.x, groundY(sim.x, sim.z, true) + 1.25, sim.z);
        const sel = readTarget().sel;
        const mark =
          sel?.kind === "mob" && sel.id !== "dummy"
            ? beastsRef.current.find((beast) => beast.id === sel.id && beast.alive)
            : sel?.kind === "mob" && dummyRef.current?.alive
              ? dummyRef.current
              : null;
        const fxw = -Math.sin(sim.yaw);
        const fzw = -Math.cos(sim.yaw);
        const shot = useRpg.getState().punch();
        const markDist = mark ? Math.hypot(mark.root.position.x - sim.x, mark.root.position.z - sim.z) : 99;
        const aimed = mark && markDist <= RANGED_HIT ? mark : null;
        const pickedMeteor =
          sel?.kind === "meteor"
            ? meteorRef.current.find((row) => !row.broken && row.id === sel.id && Math.hypot(row.x - sim.x, row.z - sim.z) <= RANGED_HIT)
            : null;
        const rock =
          pickedMeteor ??
          (aimed
            ? null
            : meteorRef.current.find((row) => {
                if (row.broken) return false;
                const dx = row.x - sim.x;
                const dz = row.z - sim.z;
                const dist = Math.hypot(dx, dz);
                if (dist > RANGED_HIT || dist < 0.4) return false;
                return (dx * fxw + dz * fzw) / dist > 0.72;
              }));
        if (aimed) {
          const p = aimed.root.position;
          _look.set(p.x - origin.x, p.y + 1.05 - origin.y, p.z - origin.z);
        } else if (rock) {
          _look.set(rock.x - origin.x, rock.mesh.position.y + 1.15 - origin.y, rock.z - origin.z);
        } else _look.set(fxw, 0.04, fzw);
        const home = aimed && "id" in aimed && typeof aimed.id === "string" ? aimed.id : aimed ? "dummy" : rock ? rock.id : "";
        if (style === "bow") combatRef.current?.fireArrow(origin, _look, shot.dmg, shot.crit, home);
        else if (style === "staff") combatRef.current?.fireBolt(origin, _look, shot.dmg, shot.crit, home);
      }
    }
    if (playing) {
      useRpg.getState().tick(dt, sprinting);
      const model = modelRef.current;
      if (model && useRpg.getState().gearRev !== gearRev.current) {
        gearRev.current = useRpg.getState().gearRev;
        syncGear(model, useRpg.getState().equipped);
      }
      if (model) stickGear(model);
      const host = amHost();
      landRef.current = (beast, dmg, crit) => {
        if (!beast.alive || useRpg.getState().down) return;
        const dealt = mitigate(beast.level, useRpg.getState().level, dmg);
        const mods = enchantView(useRpg.getState());
        const bonus = beast.boss ? (mods.bosses[beast.name] || 0) : mods.mob;
        const scaled = Math.max(1, Math.round(dealt * (1 + bonus / 100)));
        angerPack(beastsRef.current, beast.pack);
        if (host) {
          hitBeast(beast, scaled);
          useRpg.getState().noteDamage(scaled);
          floatAt(beast.root.position.x, beast.root.position.y + 1.55, beast.root.position.z, `${crit ? "KRİT " : ""}${scaled}`, crit);
          if (!beast.alive) {
            const xp = mobXp(beast.level, beast.boss, useRpg.getState().level);
            const gold = 4 + beast.level;
            shareXp(xp);
            useRpg.getState().addGold(gold);
            useRpg.getState().noteKill(beast.specId, beast.level);
            floatAt(beast.root.position.x, beast.root.position.y + 2.15, beast.root.position.z, `+${xp} XP · +${gold} altın`, false);
            const dungeonBoss = beast.boss && beast.pack >= 900;
            if (!dungeonBoss) {
              const drops = rollKillLoot(beast.level, beast.boss, useRpg.getState().level, realmAt(beast.root.position.x, beast.root.position.z).id);
              if (drops.length) placeChest(drops as Item[], beast.root.position.x + (Math.random() - 0.5) * 0.4, beast.root.position.z + (Math.random() - 0.5) * 0.4);
            }
          }
        } else {
          emitHit(beast.id, scaled);
          hitBeast(beast, scaled);
          useRpg.getState().noteDamage(scaled);
          floatAt(beast.root.position.x, 1.55, beast.root.position.z, `${crit ? "KRİT " : ""}${scaled}`, crit);
          if (!beast.alive) useRpg.getState().noteKill(beast.specId, beast.level);
        }
      };
      const riderNow = useRpg.getState();
      const cifte = riderNow.riding && riderNow.steed ? Math.max(0, Math.min(32, riderNow.mountSkills?.cifte || 0)) : 0;
      const canKick = Boolean(riderNow.riding && riderNow.steed && !riderNow.down && !riderNow.mapLoad);
      const forced = canKick ? takeMountKick() : null;
      if ((cifte > 0 || forced) && !riderNow.down && !riderNow.mapLoad) {
        if (forced) horseKick.current = 0;
        horseKick.current -= dt;
        if (horseKick.current <= 0) {
          const reach = forced ? 3.3 + (forced.rank || 0) * 0.04 : 2.4 + cifte * 0.03;
          let best: Beast | null = null;
          let bestD = reach;
          for (const beast of beastsRef.current) {
            if (!beast.alive) continue;
            const d = Math.hypot(beast.root.position.x - sim.x, beast.root.position.z - sim.z);
            if (d <= bestD) {
              best = beast;
              bestD = d;
            }
          }
          const rank = forced?.rank || cifte;
          if (best) {
            horseKick.current = Math.max(1.35, 2.8 - Math.max(cifte, rank) * 0.04);
            const dmg = forced ? Math.round(14 + rank * 2.4 + riderNow.level * 0.45) : Math.round(8 + cifte * 1.6 + riderNow.level * 0.35);
            landRef.current(best, dmg, false);
          } else horseKick.current = 0.35;
        }
      } else horseKick.current = 0;
      const cast = takeCast();
      if (cast) {
        const rpgNow = useRpg.getState();
        const miss = (note: string) => {
          refundSkill(cast.cost || 0);
          if (note) useRpg.setState({ toast: note });
        };
        if (rpgNow.down) miss("");
        else if (rpgNow.riding) miss("At üzerinde yetenek kullanılamaz");
        else {
        const classId = rpgNow.classId;
        const reach = classId === "okcu" || classId === "buyucu" ? RANGED_HIT : classId === "ninja" ? 4.2 : 4.4;
        const melee = classId === "savasci" || classId === "ninja";
        const { duel } = readTarget();
        const foe = duel.phase === "live" ? remotes.get(duel.id) : undefined;
        const foeDist = foe ? Math.hypot(foe.x - sim.x, foe.z - sim.z) : 99;
        const sel = readTarget().sel;
        const beast = sel?.kind === "mob" ? beastsRef.current.find((row) => row.id === sel.id && row.alive) ?? null : null;
        const rock = sel?.kind === "meteor" ? meteorRef.current.find((row) => row.id === sel.id && !row.broken) ?? null : null;
        const dist = beast ? Math.hypot(beast.root.position.x - sim.x, beast.root.position.z - sim.z) : 99;
        const rockDist = rock ? Math.hypot(rock.x - sim.x, rock.z - sim.z) : 99;
        const critRoll = cast.crit && Math.random() < 0.42;
        const dmg = critRoll ? Math.round(cast.dmg * 1.65) : cast.dmg;
        const stamp = (target: Beast) => {
          const dealt = mitigate(target.level, useRpg.getState().level, dmg);
          if (cast.slow) target.slow = 4;
          if (cast.dot) {
            target.poison = 5;
            target.poisonDps = Math.max(1, Math.round(dealt * 0.22));
          }
        };
        let landed = false;
        if (!cast.aoe && classId !== "savasci" && classId !== "ninja" && !beast && !foe && !rock) {
          miss("Önce bir hedef seç");
        } else if (foe && foeDist < reach) {
          landed = true;
          for (let n = 0; n < cast.hits; n++) sendDuelHit(n === 0 ? dmg : Math.max(1, Math.round(dmg * 0.7)), critRoll);
          floatAt(foe.x, 1.7, foe.z, `${critRoll ? "KRİT " : ""}${dmg}`, critRoll);
          if (melee) combatRef.current?.slash(sim.x, 1.15, sim.z, sim.yaw, false);
        } else if (cast.aoe) {
          if (cast.id === "ok6") combatRef.current?.rain(sim.x, sim.z);
          const limit = melee ? 4.2 : RANGED_HIT;
          for (const row of beastsRef.current) {
            if (!row.alive) continue;
            if (Math.hypot(row.root.position.x - sim.x, row.root.position.z - sim.z) >= limit) continue;
            landed = true;
            stamp(row);
            landRef.current(row, dmg, critRoll);
          }
          if (melee) combatRef.current?.slash(sim.x, 1.15, sim.z, sim.yaw, false);
          if (!landed) miss("Etrafta hedef yok");
        } else if (rock && rockDist < (melee ? 4.6 : reach)) {
          landed = true;
          for (let n = 0; n < cast.hits; n++) chipMeteor.current(rock, n === 0 ? dmg : Math.max(1, Math.round(dmg * 0.7)));
          if (melee) combatRef.current?.slash(sim.x, 1.15, sim.z, sim.yaw, false);
          else {
            const origin = _aim.set(sim.x, 1.35, sim.z);
            _look.set(rock.x - origin.x, rock.mesh.position.y + 1.15 - origin.y, rock.z - origin.z);
            if (classId === "okcu") combatRef.current?.fireArrow(origin, _look, 0, false, rock.id);
            else combatRef.current?.fireBolt(origin, _look, 0, false, rock.id);
          }
        } else if (beast && dist < reach) {
          landed = true;
          stamp(beast);
          for (let n = 0; n < cast.hits; n++) landRef.current(beast, n === 0 ? dmg : Math.max(1, Math.round(dmg * 0.7)), critRoll && n === 0);
          if (melee) combatRef.current?.slash(sim.x, 1.15, sim.z, sim.yaw, false);
          else {
            const origin = _aim.set(sim.x, 1.35, sim.z);
            _look.set(beast.root.position.x - origin.x, beast.root.position.y + 1.05 - origin.y, beast.root.position.z - origin.z);
            if (classId === "okcu") combatRef.current?.fireArrow(origin, _look, 0, false, beast.id);
            else combatRef.current?.fireBolt(origin, _look, 0, false, beast.id);
          }
        } else miss(beast || foe || rock ? "Hedef menzil dışında" : "Önce bir hedef seç");
        if (landed) commitSkill(cast.id);
        }
      }
      if (host) {
        for (const hit of takeRemoteHits()) {
          const beast = beastsRef.current.find((row) => row.id === hit.id && row.alive);
          if (!beast) continue;
          angerPack(beastsRef.current, beast.pack);
          hitBeast(beast, hit.dmg);
          floatAt(beast.root.position.x, 1.55, beast.root.position.z, `${hit.dmg}`, false);
          if (!beast.alive) sendReward(hit.from, mobXp(beast.level, beast.boss, remotes.get(hit.from)?.level || beast.level), 4 + beast.level);
        }
      } else takeRemoteHits();
      resolveHits();
      const dummy = dummyRef.current;
      const beasts = beastsRef.current;
      const well = wellRef.current;
      const smith = smithRef.current;
      if (dummy) tickDummy(dummy, dt, camera);
      if (well) tickVendor(well, lifeRef.current);
      if (smith) tickVendor(smith, lifeRef.current);
      for (const mentor of mentorsRef.current) mentor.hips.rotation.y = Math.sin(lifeRef.current * 0.7 + mentor.root.position.x) * 0.06;
      const rpgNow = useRpg.getState();
      const learned = Boolean(rpgNow.chosenTree) || Object.values(rpgNow.skills ?? {}).some((rank) => Number(rank) > 0);
      const skillQuest = rpgNow.quests.find((quest) => quest.id === "q-skills");
      const showSkillMarks = rpgNow.level >= 5 && !learned && !(skillQuest && (skillQuest.done || skillQuest.claimed));
      for (const mentor of mentorsRef.current) {
        const arrow = mentor.root.getObjectByName("skill-arrow");
        if (!arrow) continue;
        const row = MENTORS.find((item) => item.name === mentor.name);
        arrow.visible = Boolean(showSkillMarks && row && row.cls === rpgNow.classId);
        if (arrow.visible) arrow.position.y = 2.15 + Math.sin(lifeRef.current * 3.2 + mentor.root.position.x) * 0.16;
      }
      if (host) {
        const budget = effectiveGfx();
        const reach2 = budget.distance * budget.distance;
        const animReach = budget.mobs === 0 ? 26 : budget.mobs === 1 ? 54 : budget.distance;
        const anim2 = animReach * animReach;
        const hotPacks = new Set<number>();
        const inside = Boolean(dungeonNow());
        for (const beast of beasts) if (beast.alive && beast.anger) hotPacks.add(beast.pack);
        for (const beast of beasts) {
          if (beast.pack >= 900) continue;
          if (inside) {
            beast.root.visible = false;
            continue;
          }
          const dx = beast.root.position.x - sim.x;
          const dz = beast.root.position.z - sim.z;
          const near = beast.anger || hotPacks.has(beast.pack) || dx * dx + dz * dz <= reach2;
          if (beast.root.visible !== near) {
            beast.root.visible = near;
            if (near) beast.root.position.y = groundY(beast.root.position.x, beast.root.position.z);
          }
          if (beast.alive && hotPacks.has(beast.pack)) beast.anger = true;
        }
        for (const beast of beasts) {
          if (beast.pack >= 900) continue;
          if (!beast.alive || !beast.root.visible) continue;
          const dx0 = beast.root.position.x - sim.x;
          const dz0 = beast.root.position.z - sim.z;
          if (!beast.anger && dx0 * dx0 + dz0 * dz0 > anim2) continue;
          for (const other of beasts) {
            if (other === beast || !other.alive || other.pack !== beast.pack || !other.root.visible) continue;
            const dx = beast.root.position.x - other.root.position.x;
            const dz = beast.root.position.z - other.root.position.z;
            const dist = Math.hypot(dx, dz) || 0.001;
            if (dist < 1.15) {
              beast.root.position.x += (dx / dist) * (1.15 - dist) * 0.25;
              beast.root.position.z += (dz / dist) * (1.15 - dist) * 0.25;
            }
          }
        }
        for (const beast of beasts) {
          if (beast.pack >= 900) continue;
          const dx = beast.root.position.x - sim.x;
          const dz = beast.root.position.z - sim.z;
          const simulate = beast.root.visible && (beast.anger || !beast.alive || beast.poison > 0 || dx * dx + dz * dz <= anim2);
          if (!simulate) continue;
          if (beast.alive && beast.poison > 0) {
            beast.poison = Math.max(0, beast.poison - dt);
            beast.hp = Math.max(0, beast.hp - beast.poisonDps * dt);
            if (beast.hp <= 0) {
              beast.alive = false;
              beast.respawn = 10;
              const xp = mobXp(beast.level, beast.boss, useRpg.getState().level);
              const gold = 4 + beast.level;
              shareXp(xp);
              useRpg.getState().addGold(gold);
              useRpg.getState().noteKill(beast.specId, beast.level);
              floatAt(beast.root.position.x, 2.15, beast.root.position.z, `+${xp} XP · +${gold} altın`, false);
            }
          }
          const struck = tickBeast(beast, dt, sim.x, sim.z, camera, false);
          if (struck) {
            const bite = Math.atan2(-(sim.x - beast.root.position.x), -(sim.z - beast.root.position.z));
            combatRef.current?.slash(beast.root.position.x, 0.85, beast.root.position.z, bite, false);
            const me = useRpg.getState();
            const dmg = mobBite(beast.level, me.level);
            const dead = me.hurtPlayer(dmg);
            floatAt(sim.x, 1.5, sim.z, `-${dmg}`, false);
            if (dead) {
              for (const other of beasts) {
                if (other.pack === beast.pack && other.alive) {
                  other.hp = other.hpMax;
                  other.anger = false;
                }
              }
              useRpg.getState().knockDown();
            }
          }
          beast.root.position.y = groundY(beast.root.position.x, beast.root.position.z);
        }
        for (const beast of beasts) {
          if (beast.pack >= 700) continue;
          if (beast.alive) continue;
          if (beast.respawn <= 0) beast.respawn = 10;
          beast.respawn -= dt;
          if (beast.respawn > 0) continue;
          beast.alive = true;
          beast.hp = beast.hpMax;
          beast.anger = false;
          beast.poison = 0;
          beast.slow = 0;
          beast.root.rotation.x = 0;
          beast.root.position.set(beast.homeX, groundY(beast.homeX, beast.homeZ), beast.homeZ);
        }
        mobClock.current += dt;
        if (mobClock.current > 0.4) {
          mobClock.current = 0;
          const snaps = [];
          for (const beast of beasts) {
            if (beast.pack >= 900) continue;
            if (beast.alive && !beast.anger && !beast.root.visible) continue;
            snaps.push({
              id: beast.id,
              hp: beast.hp,
              alive: beast.alive,
              anger: beast.anger,
              x: beast.root.position.x,
              z: beast.root.position.z,
            });
          }
          pushMobState(snaps);
        }
      } else {
        const snaps = fieldMobs();
        const glide = 1 - Math.exp(-8 * dt);
        for (const snap of snaps) {
          const beast = beasts.find((row) => row.id === snap.id);
          if (!beast) continue;
          beast.hp = snap.hp;
          beast.alive = snap.alive;
          beast.anger = snap.anger;
          beast.root.position.x += (snap.x - beast.root.position.x) * glide;
          beast.root.position.z += (snap.z - beast.root.position.z) * glide;
          if (!snap.alive) beast.root.rotation.x = Math.min(1.2, beast.root.rotation.x + dt);
          else beast.root.rotation.x = 0;
          beast.root.position.y = groundY(beast.root.position.x, beast.root.position.z);
        }
        for (const beast of beasts) {
          if (beast.pack >= 900) continue;
          const dx = beast.root.position.x - sim.x;
          const dz = beast.root.position.z - sim.z;
          const near = dx * dx + dz * dz < 120 * 120;
          if (beast.root.visible !== near) beast.root.visible = near;
          if (near) tickBeast(beast, dt, sim.x, sim.z, camera, true);
        }
      }
      const run = dungeonNow();
      if (run) {
        const boss = BOSSES.find((row) => row.id === run.bossId);
        const pack = 900 + BOSSES.findIndex((row) => row.id === run.bossId);
        const members = beastsRef.current.filter((beast) => beast.pack === pack);
        const leave = (note: string) => {
          bossLeave.current = 0;
          dungeonApi.current.clear(pack);
          endRun();
          portalLock.current = performance.now() + 2800;
          if (boss) {
            const home = REALMS.find((item) => item.id === boss.realm) ?? REALMS[0];
            let ang = Math.atan2(boss.z - home.z, boss.x - home.x);
            const rad = boss.realm === "koy" ? FENCE_R - 1.15 : DUNGEON_BOUND - 2.2;
            if (boss.realm === "koy" && Math.min(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang))) < 0.22) ang += 0.46;
            const dx = Math.cos(ang);
            const dz = Math.sin(ang);
            sim.x = home.x + dx * rad - dx * 4.2;
            sim.z = home.z + dz * rad - dz * 4.2;
          }
          if (note) useRpg.setState({ toast: note });
        };
        if (useRpg.getState().down) leave("");
        else {
          for (const beast of members) {
            beast.root.visible = true;
            beast.anger = true;
            beast.returning = false;
            if (beast.alive && beast.poison > 0) {
              beast.poison = Math.max(0, beast.poison - dt);
              beast.hp = Math.max(0, beast.hp - beast.poisonDps * dt);
              if (beast.hp <= 0) {
                beast.alive = false;
                const xp = mobXp(beast.level, beast.boss, useRpg.getState().level);
                const gold = 4 + beast.level;
                shareXp(xp);
                useRpg.getState().addGold(gold);
                useRpg.getState().noteKill(beast.specId, beast.level);
              }
            }
            const struck = tickBeast(beast, dt, sim.x, sim.z, camera, false);
            beast.root.position.y = groundY(beast.root.position.x, beast.root.position.z, true);
            if (struck && !useRpg.getState().down) {
              const bite = Math.atan2(-(sim.x - beast.root.position.x), -(sim.z - beast.root.position.z));
              combatRef.current?.slash(beast.root.position.x, beast.root.position.y + 0.85, beast.root.position.z, bite, false);
              const me = useRpg.getState();
              const dmg = mobBite(beast.level, me.level);
              const dead = me.hurtPlayer(dmg);
              floatAt(sim.x, groundY(sim.x, sim.z, true) + 1.5, sim.z, `-${dmg}`, false);
              if (dead) useRpg.getState().knockDown();
            }
          }
          if (useRpg.getState().down) leave("");
          else if (members.length && members.every((beast) => !beast.alive)) {
            if (run.wave >= 5) {
              if (!bossLeave.current) {
                bossLeave.current = performance.now() + 10000;
                if (boss) tryReceiveItem(bossChestItem(boss.name, boss.level));
                useRpg.setState({ toast: "Sandık envanterinde. 10 saniye sonra kapıya döneceksin." });
              } else if (performance.now() >= bossLeave.current) {
                bossLeave.current = 0;
                leave("");
              }
            } else if (boss) {
              bossLeave.current = 0;
              dungeonApi.current.clear(pack);
              beginRun({ bossId: boss.id, wave: run.wave + 1, name: boss.name }, { x: boss.x, z: boss.z, y: 24, r: ARENA_WALK });
              dungeonApi.current.spawn(boss, run.wave + 1);
              useRpg.setState({ toast: run.wave + 1 === 5 ? `${boss.name} geliyor` : `Dalga ${run.wave + 1}` });
            }
          } else if (boss) {
            bossLeave.current = 0;
            const dx = sim.x - boss.x;
            const dz = sim.z - boss.z;
            const dist = Math.hypot(dx, dz) || 1;
            if (dist > ARENA_WALK) {
              sim.x = boss.x + (dx / dist) * ARENA_WALK;
              sim.z = boss.z + (dz / dist) * ARENA_WALK;
            }
          }
        }
      }
      for (const [id, mesh] of arenaRef.current) mesh.visible = dungeonNow()?.bossId === id;
      for (const rock of meteorRef.current) {
        if (!rock.broken) continue;
        rock.respawn -= dt;
        if (rock.respawn > 0) continue;
        for (const beast of beastsRef.current) {
          if (beast.pack !== rock.pack || !beast.alive) continue;
          beast.alive = false;
          beast.root.visible = false;
        }
        rock.broken = false;
        rock.hp = rock.hpMax;
        rock.wave = 0;
        rock.mesh.visible = true;
        placeMeteor(rock.id, rock.x, rock.z, true);
      }
      for (const beast of beastsRef.current) stepPuppet(beast, dt);
      let near: NearKind | null = null;
      let mentorId: string | null = null;
      for (const mentor of mentorsRef.current) {
        if (Math.hypot(sim.x - mentor.root.position.x, sim.z - mentor.root.position.z) < 1.8) {
          near = "mentor";
          mentorId = MENTORS.find((row) => row.name === mentor.name)?.id ?? null;
          break;
        }
      }
      if (!near) {
        for (const town of townsRef.current) {
          if (Math.hypot(sim.x - town.root.position.x, sim.z - town.root.position.z) < 2.15) {
            near = town.role;
            if (town.map) mentorId = town.map;
            break;
          }
        }
      }
      if (!near && smith && Math.hypot(sim.x - smith.root.position.x, sim.z - smith.root.position.z) < 2.6) near = "smith";
      if (!near && Math.hypot(sim.x - WELL.x, sim.z - WELL.z) < 1.55) near = "well";
      if (!near) {
        const lake = Math.hypot(sim.x - LAKE.x, sim.z - LAKE.z);
        if (onPier(sim.x, sim.z) || (lake < LAKE.r + 1.15 && lake > LAKE.r - 1.2)) near = "fish";
      }
      if (!near) {
        for (const vein of liveVeins()) {
          if (Math.hypot(sim.x - vein.x, sim.z - vein.z) < 1.8) {
            near = "vein";
            break;
          }
        }
      }
      const panel = useRpg.getState();
      const panelKey = `${panel.shop || ""}|${panel.bossPrompt || ""}|${panel.npcAsk || ""}|${panel.boardFor || ""}`;
      if (panelKey !== "|||") {
        if (shopAnchor.current.key !== panelKey) shopAnchor.current = { key: panelKey, x: sim.x, z: sim.z };
        else if (Math.hypot(sim.x - shopAnchor.current.x, sim.z - shopAnchor.current.z) > 7.6) {
          useRpg.setState({ shop: null, boardFor: null, boardMap: null, npcAsk: null, bossPrompt: null });
          shopAnchor.current.key = "";
        }
      } else shopAnchor.current.key = "";
      for (const town of townsRef.current) {
        town.root.position.y = groundY(town.root.position.x, town.root.position.z);
        town.hips.rotation.y = Math.sin(lifeRef.current * 0.6 + town.root.position.x) * 0.05;
      }
      const horse = horseRef.current;
      if (horse) {
        horse.root.position.y = groundY(horse.root.position.x, horse.root.position.z);
        horse.head.rotation.x = Math.sin(lifeRef.current * 0.7) * 0.08;
        horse.head.rotation.y = Math.sin(lifeRef.current * 0.35) * 0.1;
        horse.tail.rotation.z = Math.sin(lifeRef.current * 1.4) * 0.2;
      }
      const mount = mountHorseRef.current;
      const rider = useRpg.getState();
      if (mount) {
        const on = Boolean(playing && rider.riding && rider.steed);
        mount.visible = on;
        if (on) {
          mount.position.set(sim.x, groundY(sim.x, sim.z, true), sim.z);
          mount.rotation.y = sim.yaw + Math.PI;
        }
      }
      const seenVials = rider.vials;
      const pushMark = (kind: "star" | "vial", text: string) => {
        const root = floatRootRef.current;
        if (!root) return;
        const sprite = floatSprite(kind, text);
        root.add(sprite);
        floatMarks.current.push({ sprite, life: 1.8, rise: 0 });
      };
      if (vialsSeen.current == null) vialsSeen.current = seenVials;
      else if (seenVials > vialsSeen.current) pushMark("vial", "+");
      vialsSeen.current = seenVials;
      const ping = playing ? takeLevelPing() : 0;
      if (ping > 0) {
        const prev = levelFx.current;
        if (prev) {
          const old = prev.sprite.material as THREE.SpriteMaterial;
          prev.sprite.parent?.remove(prev.sprite);
          old.map?.dispose();
          old.dispose();
        }
        const sprite = makeLevelBadge(ping);
        hostRef.current?.add(sprite);
        levelFx.current = { sprite, life: 2.6 };
      }
      const badge = levelFx.current;
      const gy = groundY(sim.x, sim.z, true);
      if (badge) {
        badge.life -= dt;
        const sprite = badge.sprite;
        if (badge.life <= 0) {
          const old = sprite.material as THREE.SpriteMaterial;
          sprite.parent?.remove(sprite);
          old.map?.dispose();
          old.dispose();
          levelFx.current = null;
        } else {
          sprite.visible = true;
          sprite.position.set(sim.x, gy + 2.2, sim.z);
          const pop = badge.life > 2.25 ? (2.6 - badge.life) / 0.35 : 1;
          sprite.scale.setScalar(1.55 * Math.min(1, pop));
          (sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, badge.life);
        }
      }
      const cap = maxBadge.current;
      if (cap) {
        const showCap = playing && rider.level >= 99 && !levelFx.current;
        cap.visible = showCap;
        if (showCap) cap.position.set(sim.x, gy + 2.35 + Math.sin(lifeRef.current * 2.6) * 0.14, sim.z);
      }
      for (let i = floatMarks.current.length - 1; i >= 0; i--) {
        const mark = floatMarks.current[i]!;
        mark.life -= dt;
        mark.rise += dt * 0.42;
        mark.sprite.position.set(sim.x, gy + 2.15 + mark.rise, sim.z);
        const mat = mark.sprite.material as THREE.SpriteMaterial;
        mat.opacity = Math.max(0, mark.life / 1.8);
        if (mark.life <= 0) {
          mark.sprite.parent?.remove(mark.sprite);
          mat.map?.dispose();
          mat.dispose();
          floatMarks.current.splice(i, 1);
        }
      }
      if (smith) smith.root.position.y = groundY(smith.root.position.x, smith.root.position.z);
      for (const mentor of mentorsRef.current) {
        mentor.root.position.y = groundY(mentor.root.position.x, mentor.root.position.z);
      }
      const table = stallRef.current;
      const listed = useRpg.getState().stall;
      const spot = useRpg.getState().stallSpot;
      if (table) {
        const open = Array.isArray(listed) && spot;
        table.visible = Boolean(open && playing);
        if (open && spot) table.position.set(spot.x, groundY(spot.x, spot.z), spot.z);
      }
      stallClock.current += dt;
      if (stallClock.current > 1.2) {
        stallClock.current = 0;
        broadcastStall();
        if (playing) void syncStallMarket();
      }
      const guests = guestStalls.current;
      const boards = marketBoards();
      const seenBoards = new Set<string>();
      for (const board of boards) {
        seenBoards.add(board.id);
        let mesh = guests.get(board.id);
        if (!mesh && table) {
          mesh = table.clone();
          hostRef.current?.add(mesh);
          guests.set(board.id, mesh);
        }
        if (mesh) {
          mesh.visible = playing;
          mesh.position.set(board.x, groundY(board.x, board.z), board.z);
        }
      }
      for (const [id, mesh] of guests) {
        if (seenBoards.has(id)) continue;
        mesh.visible = false;
        guests.delete(id);
        mesh.removeFromParent();
      }
      const fishing = useRpg.getState().chore?.kind === "fish";
      const splash = splashRef.current;
      if (fishing && !wasFish.current && splash) {
        splashLife.current = 0.01;
        splash.visible = true;
        splash.position.set(sim.x, groundY(sim.x, sim.z) + 0.06, sim.z);
      }
      wasFish.current = Boolean(fishing);
      if (splash && splashLife.current < 1) {
        splashLife.current = Math.min(1, splashLife.current + dt * 1.35);
        splash.scale.setScalar(0.55 + splashLife.current * 2.6);
        (splash.material as THREE.MeshBasicMaterial).opacity = (1 - splashLife.current) * 0.8;
        if (splashLife.current >= 1) splash.visible = false;
      }
      useRpg.getState().setNear(near, mentorId);
      const { sel, duel } = readTarget();
      paintMob(camera, "mob-dummy", "", 0, 1, 0, 0, 0, false);
      paintMob(camera, "mob-beast", "", 0, 1, 0, 0, 0, false);
      let focus = false;
      let card: { name: string; hp: number; hpMax: number; level: number; drops: string[] } | null = null;
      if (sel?.kind === "mob" && sel.id === "dummy" && dummy?.alive) {
        card = { name: "Talim Kuklası", hp: dummy.hp, hpMax: dummy.hpMax, level: 1, drops: ["Talim, düşmez"] };
        focus = true;
      } else if (sel?.kind === "mob") {
        const picked = beasts.find((beast) => beast.id === sel.id && beast.alive);
        if (picked) {
          card = {
            name: picked.name,
            hp: picked.hp,
            hpMax: picked.hpMax,
            level: picked.level,
            drops: picked.boss ? ["Seyrek ekipman", "Yükseltme taşı", "Altın"] : ["Seyrek ekipman", "Yükseltme taşı"],
          };
          focus = true;
        }
      } else if (sel?.kind === "meteor") {
        const rock = meteorRef.current.find((row) => row.id === sel.id && !row.broken);
        if (rock) {
          card = {
            name: rock.name,
            hp: rock.hp,
            hpMax: rock.hpMax,
            level: rock.level,
            drops: ["Yükseltme taşı", "Güç Taşı", "Ekipman"],
          };
          focus = true;
          paintMob(
            camera,
            "mob-meteor",
            `${rock.name} · Sv.${rock.level}`,
            rock.hp,
            rock.hpMax,
            rock.x,
            rock.mesh.position.y + 2.7,
            rock.z,
            true,
          );
        }
      } else if (duel.phase === "live" && sel?.kind === "player" && sel.id === duel.id) {
        const foe = remotes.get(sel.id);
        if (foe) {
          card = { name: foe.nick, hp: foe.hp, hpMax: foe.hpMax, level: foe.level, drops: [] };
          focus = true;
        }
      }
      setMobCard(focus ? card : null);
      if (sel?.kind !== "meteor") paintMob(camera, "mob-meteor", "", 0, 1, 0, 0, 0, false);
      const targets: ShotTarget[] = [];
      if (dummy?.alive) targets.push({ id: "dummy", x: dummy.root.position.x, y: 1.25, z: dummy.root.position.z, alive: true });
      for (const beast of beasts) {
        if (beast.alive) targets.push({ id: beast.id, x: beast.root.position.x, y: beast.root.position.y + 1.05, z: beast.root.position.z, alive: true });
      }
      if (duel.phase === "live") {
        const foe = remotes.get(duel.id);
        if (foe) targets.push({ id: "duel", x: foe.x, y: 1.2, z: foe.z, alive: true });
      }
      for (const rock of meteorRef.current) {
        if (rock.broken) continue;
        targets.push({ id: rock.id, x: rock.x, y: rock.mesh.position.y + 1.15, z: rock.z, alive: true });
      }
      combatRef.current?.tick(dt, targets, (id, dmg, crit, x, y, z) => {
        if (dmg <= 0) return;
        if (id === "duel") {
          sendDuelHit(dmg, crit);
          floatAt(x, y, z, `${crit ? "KRİT " : ""}${dmg}`, crit);
          return;
        }
        if (id === "dummy" && dummy?.alive) {
          hitDummy(dummy, dmg);
          floatAt(x, y, z, `${crit ? "KRİT " : ""}${dmg}`, crit);
          return;
        }
        const rock = meteorRef.current.find((row) => row.id === id && !row.broken);
        if (rock) {
          chipMeteor.current(rock, dmg);
          return;
        }
        const beast = beasts.find((row) => row.id === id && row.alive);
        if (!beast) return;
        landRef.current(beast, dmg, crit);
      });
      for (const item of takePendingDrops()) placeLoot(item, sim.x + 0.35, sim.z + 0.15);
      const bagHost = lootRoot.current;
      if (bagHost) {
        expireLoot();
        const rows = fieldLoot();
        const ids = new Set(rows.map((row) => row.id));
        const opened = chestView()?.id ?? "";
        for (const [id, mesh] of lootMeshes.current) {
          if (!ids.has(id)) {
            bagHost.remove(mesh);
            lootMeshes.current.delete(id);
          }
        }
        for (const row of rows) {
          let mesh = lootMeshes.current.get(row.id);
          if (!mesh) {
            mesh = makeChest();
            mesh.castShadow = true;
            bagHost.add(mesh);
            lootMeshes.current.set(row.id, mesh);
          }
          mesh.position.set(row.x, groundY(row.x, row.z), row.z);
          mesh.rotation.y += dt * 0.35;
          const lid = mesh.userData.lid as THREE.Object3D | undefined;
          if (lid) {
            const want = row.id === opened ? -1.15 : 0;
            lid.rotation.x += (want - lid.rotation.x) * Math.min(1, dt * 8);
          }
        }
        const touching = rows.find((row) => Math.hypot(row.x - sim.x, row.z - sim.z) < 1.7);
        const openedNow = chestView();
        if (openedNow && Math.hypot(openedNow.x - sim.x, openedNow.z - sim.z) > 3.4) closeChest();
        setLootHint(touching ? "E — aç · EE — al · Z — yakındakiler" : "");
      }
      syncRealmMusic(realmAt(sim.x, sim.z).id, true);
      for (const vein of liveVeins()) {
        const mesh = scene.getObjectByName(`vein-rock-${vein.id}`);
        if (!mesh) continue;
        const y = groundY(vein.x, vein.z) + 0.28;
        if (Math.abs(mesh.position.x - vein.x) > 0.05 || Math.abs(mesh.position.z - vein.z) > 0.05) mesh.position.set(vein.x, y, vein.z);
      }
    } else {
      syncRealmMusic("", false);
      setLootHint("");
      paintMob(camera, "mob-dummy", "", 0, 1, 0, 0, 0, false);
      paintMob(camera, "mob-beast", "", 0, 1, 0, 0, 0, false);
      paintMob(camera, "mob-focus", "", 0, 1, 0, 0, 0, false);
      paintMob(camera, "mob-meteor", "", 0, 1, 0, 0, 0, false);
    }
    const showFx = effectiveGfx().effects;
    if (showFx) tickGrass(dt);
    if (showFx && moving) {
      stepRef.current += sim.speed * dt;
      if (stepRef.current > (runBlend.current > 0.45 ? 0.38 : 0.58)) {
        stepRef.current = 0;
        const pool = dustRef.current;
        const puff = pool.find((item) => item.life >= 1) ?? pool[0];
        if (puff) {
          const side = footRef.current;
          footRef.current = -side;
          const yaw = sim.yaw;
          puff.sprite.visible = true;
          puff.sprite.position.set(
            sim.x + Math.cos(yaw) * side * 0.16 + Math.sin(yaw) * 0.08,
            0.05,
            sim.z - Math.sin(yaw) * side * 0.16 + Math.cos(yaw) * 0.08,
          );
          puff.life = 0;
          puff.vy = 0.32 + Math.random() * 0.2;
        }
      }
    }
    for (const puff of dustRef.current) {
      if (puff.life >= 1) continue;
      puff.life += dt * 1.7;
      puff.sprite.position.y += puff.vy * dt;
      const mat = puff.sprite.material as THREE.SpriteMaterial;
      mat.opacity = Math.max(0, 0.42 * (1 - puff.life));
      const size = 0.2 + puff.life * 0.42;
      puff.sprite.scale.set(size, size, size);
      if (puff.life >= 1) puff.sprite.visible = false;
    }
    if (showFx) tickSmoke(puffsRef.current, dt);
    else {
      for (const puff of puffsRef.current) puff.sprite.visible = false;
    }
    weatherRef.current?.update(dt, lifeRef.current, playing ? sim.x : 0, playing ? sim.z : 0);

    const persp = camera as THREE.PerspectiveCamera;
    if (!playing) {
      const dist = 18;
      const pitch = 0.5;
      const ang = sim.menuAngle;
      _look.set(0, 1.4, -1.5);
      _desired.set(
        Math.sin(ang) * Math.cos(pitch) * dist,
        1.4 + Math.sin(pitch) * dist * 0.72,
        Math.cos(ang) * Math.cos(pitch) * dist,
      );
    } else {
      const pit = arenaFloor();
      const yaw = input.orbit;
      const pitch = Math.max(-0.45, Math.min(1.15, input.pitch));
      const dist = Math.max(3.4, Math.min(pit ? 6.4 : 11, input.dist || 5.6));
      const gy = groundY(sim.x, sim.z, true);
      const horiz = Math.cos(pitch);
      const lookY = gy + 1.35;
      let camY = lookY + Math.sin(pitch) * dist;
      if (camY < gy + 0.45) camY = gy + 0.45;
      _look.set(sim.x, lookY, sim.z);
      _desired.set(sim.x + Math.sin(yaw) * horiz * dist, camY, sim.z + Math.cos(yaw) * horiz * dist);
      if (pit) {
        const dx = _desired.x - pit.x;
        const dz = _desired.z - pit.z;
        const flat = Math.hypot(dx, dz) || 1;
        const maxR = Math.max(1.4, pit.r - 0.7);
        if (flat > maxR) {
          _desired.x = pit.x + (dx / flat) * maxR;
          _desired.z = pit.z + (dz / flat) * maxR;
        }
        const capY = pit.y + 12.2;
        if (_desired.y > capY) _desired.y = capY;
      }
    }
    const followK = playing ? 8 : 1.6;
    if (snap) _cam.copy(_desired);
    else _cam.lerp(_desired, 1 - Math.exp(-followK * dt));
    persp.position.copy(_cam);
    persp.lookAt(_look);
    syncViewmodel(camera, scene, false, style, fx?.swing ?? 0, moving, sim.phase, lifeRef.current, false, false, fpRef);

    const light = lightRef.current;
    const inside = Boolean(dungeonNow());
    const hemi = hemiRef.current;
    if (hemi) hemi.intensity = inside ? 0.05 : 0.55;
    if (inside) {
      if (!scene.fog) scene.fog = new THREE.Fog("#100c0a", 9, 30);
    } else if (scene.fog) scene.fog = null;
    if (light) {
      light.intensity = inside ? 0.16 : 1.15;
      const focusX = playing ? sim.x : 0;
      const focusZ = playing ? sim.z : 0;
      const gy = groundY(focusX, focusZ, true);
      light.position.set(focusX + 8, gy + 18, focusZ + 5);
      light.target.position.set(focusX, gy + 1, focusZ);
      light.target.updateMatrixWorld();
    }

    const who = useRpg.getState();
    presence.nick = who.nick;
    presence.level = who.level;
    presence.x = sim.x;
    presence.z = sim.z;
    presence.yaw = sim.yaw;
    presence.moving = moving;
    presence.run = runBlend.current;
    presence.swing = fx?.swing ?? 0;
    presence.weapon = Boolean(who.equipped.weapon);
    presence.style = weaponStyleOf(who.equipped.weapon?.id);
    presence.helmet = Boolean(who.equipped.helmet);
    presence.armor = Boolean(who.equipped.armor);
    presence.boots = Boolean(who.equipped.boots);
    presence.hp = who.hp;
    presence.hpMax = who.hpMax;
    presence.side = fx?.combo || 1;
    const host = remoteRootRef.current;
    if (host) host.visible = playing;
    const template = templateRef.current;
    if (host && template && playing) {
      const avatars = remoteAvatars.current;
      for (const [id, av] of avatars) {
        if (!remotes.has(id)) {
          host.remove(av.root);
          avatars.delete(id);
        }
      }
      for (const [id, body] of remotes) {
        let av = avatars.get(id);
        if (!av) {
          av = spawnRemote(template);
          avatars.set(id, av);
          host.add(av.root);
        }
        const k = 1 - Math.exp(-8 * dt);
        body.x += (body.tx - body.x) * k;
        body.z += (body.tz - body.z) * k;
        body.yaw += Math.atan2(Math.sin(body.tyaw - body.yaw), Math.cos(body.tyaw - body.yaw)) * k;
        const dx = body.x - av.prevX;
        const dz = body.z - av.prevZ;
        av.root.position.set(body.x, groundY(body.x, body.z), body.z);
        av.root.rotation.y = body.yaw;
        if (!av.model.userData.classMesh && body.moving) alignRemote(av, dx, dz);
        else if (!av.model.userData.classMesh) av.model.rotation.y = av.face;
        av.prevX = body.x;
        av.prevZ = body.z;
        av.phase += dt * (body.moving ? (body.run > 0.45 ? 10.2 : 6.4) : 1.2);
        const text = `Sv.${body.level}  ${body.nick}`;
        if (av.label !== text) {
          av.label = text;
          paintLabel(av.tag, text);
        }
        const gear = `${body.style}${Number(body.weapon)}${Number(body.helmet)}${Number(body.armor)}${Number(body.boots)}`;
        if (av.gear !== gear) {
          av.gear = gear;
          syncRemoteGear(av.model, body);
        }
        try {
          poseActor(
            av.model,
            av.rest,
            body.moving,
            body.run,
            av.phase,
            lifeRef.current,
            body.swing,
            body.side || 1,
            body.weapon,
            (body.style || (body.weapon ? "sword" : "fist")) as WeaponStyle,
            Math.max(1, body.side || 1),
          );
          stickGear(av.model);
          syncBow(av.model, body.style === "bow" ? punchExtend(body.swing) : 0);
        } catch (error) {
          console.error(error);
        }
      }
    }

    const plate = document.getElementById("nameplate");
    const head = playing ? modelRef.current?.getObjectByName("Head") : null;
    if (plate && head) {
      head.getWorldPosition(_plate);
      _plate.y += 0.36;
      if (!viewport.placeWorld(plate, camera, _plate.x, _plate.y, _plate.z)) plate.style.display = "none";
      else {
        const who = useRpg.getState();
        const title = rankOf(who.fame);
        const key = `${who.nick}|${who.level}|${title?.name || ""}|${title?.glow ? 1 : 0}`;
        if (plate.dataset.who !== key) {
          plate.dataset.who = key;
          plate.replaceChildren();
          const name = document.createElement("span");
          name.textContent = `Sv.${who.level}  ${who.nick}`;
          plate.appendChild(name);
          if (title) {
            const mark = document.createElement("span");
            mark.textContent = `  ${title.name}`;
            mark.style.color = title.color;
            if (title.glow) mark.className = "rank-name is-glow";
            plate.appendChild(mark);
          }
        }
      }
    } else if (plate) plate.style.display = "none";

    const bubbleHost = document.getElementById("chat-bubbles");
    if (bubbleHost) {
      const now = performance.now();
      const bubbles = chatBubbles(now);
      const seen = new Set<string>();
      for (const bubble of bubbles) {
        seen.add(bubble.key);
        let bx = 0;
        let by = 2.35;
        let bz = 0;
        let ok = false;
        if (bubble.key === "me" && playing) {
          bx = sim.x;
          bz = sim.z;
          const head = modelRef.current?.getObjectByName("Head");
          if (head) {
            head.getWorldPosition(_plate);
            bx = _plate.x;
            by = _plate.y + 0.42;
            bz = _plate.z;
          }
          ok = true;
        } else {
          const body = remotes.get(bubble.key);
          if (body) {
            bx = body.x;
            by = 2.35;
            bz = body.z;
            ok = true;
          }
        }
        let el = document.getElementById(`bubble-${bubble.key}`) as HTMLDivElement | null;
        if (!el) {
          el = document.createElement("div");
          el.id = `bubble-${bubble.key}`;
          el.style.cssText =
            "position:absolute;transform:translate(-50%,-140%);max-width:14rem;pointer-events:none;background:rgba(20,17,14,0.9);border:1px solid #3f3830;border-radius:8px;padding:3px 8px;color:#f3efe8;font-size:13px;text-align:center";
          bubbleHost.appendChild(el);
        }
        if (!ok || !playing || !viewport.placeWorld(el, camera, bx, by, bz)) {
          el.style.display = "none";
          continue;
        }
        if (el.textContent !== bubble.text) el.textContent = bubble.text;
      }
      for (const child of [...bubbleHost.children]) {
        const id = child.id.replace("bubble-", "");
        if (!seen.has(id)) child.remove();
      }
    }

    const ring = ringRef.current ?? makeSelectRing();
    if (!ringRef.current) {
      scene.add(ring);
      ringRef.current = ring;
    }
    const live = ringRef.current;
    const { sel, duel } = readTarget();
    let x = 0;
    let z = 0;
    let scale = 1;
    let show = false;
    if (playing && sel?.kind === "mob") {
      const mob = sel.id === "dummy" ? dummyRef.current : beastsRef.current.find((beast) => beast.id === sel.id) ?? null;
      if (mob?.alive) {
        x = mob.root.position.x;
        z = mob.root.position.z;
        scale = sel.id === "dummy" ? 1.05 : 1.25;
        show = true;
      } else setSelection(null);
    } else if (playing && sel?.kind === "meteor") {
      const rock = meteorRef.current.find((row) => row.id === sel.id && !row.broken);
      if (rock) {
        x = rock.x;
        z = rock.z;
        scale = 1.2;
        show = true;
      } else setSelection(null);
    } else if (playing && sel?.kind === "player") {
      const body = remotes.get(sel.id);
      if (body) {
        x = body.x;
        z = body.z;
        scale = 0.95;
        show = true;
      } else if (duel.phase === "idle") setSelection(null);
    }
    if (!show && playing) {
      const vein = useRpg.getState().vein;
      if (vein) {
        x = vein.x;
        z = vein.z;
        scale = 0.85;
        show = true;
      }
    }
    live.visible = show;
    if (show) {
      const dist = Math.max(4, camera.position.distanceTo(live.position));
      const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(lifeRef.current * 7.5));
      live.position.set(x, groundY(x, z) + 0.04, z);
      live.rotation.set(0, 0, 0);
      live.scale.setScalar(scale * pulse * Math.min(2.6, dist / 7));
      const mat = (live.children[0] as THREE.Mesh | undefined)?.material as THREE.MeshBasicMaterial | undefined;
      if (mat) {
        mat.color.setHex(0xffffff);
        mat.opacity = 0.55 + pulse * 0.45;
      }
    }
    const probe = globalThis as typeof globalThis & { __selRing?: { visible: boolean; x: number; z: number } };
    probe.__selRing = { visible: live.visible, x: live.position.x, z: live.position.z };
    };
    worldFrame = run;
    if (typeof document !== "undefined" && document.hidden) return;
    run(Math.min(delta, 0.05));
  });

  return (
    <>
      <hemisphereLight ref={hemiRef} args={["#d5e0e8", "#3a342c", 0.55]} />
      <directionalLight
        ref={lightRef}
        position={[8, 12, 5]}
        intensity={1.15}
        color="#fff1dc"
      />
    </>
  );
}

export function VillageScene() {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows={false}
        dpr={1}
        performance={{ min: 0.5 }}
        camera={{ fov: 42, near: 0.08, far: 720, position: [8, 7, 16] }}
        gl={{ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(1);
          gl.shadowMap.enabled = false;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.92;
          gl.setClearColor("#6f8ea3");
        }}
      >
        <World />
      </Canvas>
    </div>
  );
}
