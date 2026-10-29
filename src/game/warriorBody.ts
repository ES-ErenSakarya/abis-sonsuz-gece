import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function quatAlongY(dir: THREE.Vector3, face: THREE.Vector3) {
  const y = dir.clone();
  if (y.lengthSq() < 1e-8) y.set(0, 1, 0);
  y.normalize();
  const z = face.clone();
  z.addScaledVector(y, -z.dot(y));
  if (z.lengthSq() < 1e-8) z.set(1, 0, 0);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  z.crossVectors(x, y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function buildWarriorBones() {
  const root = new THREE.Group();
  root.name = "class-avatar";
  root.userData.classMesh = true;
  root.userData.glbBody = true;
  root.userData.bulk = 1.05;
  root.rotation.y = Math.PI;
  const fit = new THREE.Group();
  fit.name = "warrior-fit";
  fit.scale.setScalar(0.9);
  fit.position.y = 0.9;
  root.add(fit);
  const bones: THREE.Bone[] = [];
  const add = (name: string, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const part = new THREE.Bone();
    part.name = name;
    part.position.set(x, y, z);
    parent.add(part);
    bones.push(part);
    return part;
  };
  const hips = add("Hips", fit, 0, 0, 0.05);
  const spine = add("Spine", hips, 0, 0.18, 0);
  const spine1 = add("Spine1", spine, 0, 0.16, 0);
  const chest = add("Spine2", spine1, 0, 0.14, 0);
  const neck = add("Neck", chest, 0, 0.18, 0);
  add("Head", neck, 0, 0.16, 0.02);
  const leg = (side: number, upName: string, lowName: string, footName: string) => {
    const up = add(upName, hips, side * 0.2, -0.02, 0.01);
    up.rotation.z = Math.PI;
    const low = add(lowName, up, 0, 0.52, 0);
    low.rotation.y = Math.PI;
    add(footName, low, 0, 0.44, 0);
  };
  leg(1, "LeftUpLeg", "LeftLeg", "LeftFoot");
  leg(-1, "RightUpLeg", "RightLeg", "RightFoot");
  const face = new THREE.Vector3(0, 0, 1);
  const arm = (side: number, armName: string, foreName: string, handName: string) => {
    const shoulder = new THREE.Vector3(side * 0.24, 0.5, 0.02);
    const elbow = new THREE.Vector3(side * 0.33, 0.26, 0.025);
    const wrist = new THREE.Vector3(side * 0.39, -0.04, 0.05);
    const up = add(armName, chest, shoulder.x, shoulder.y - 0.48, shoulder.z - 0.05);
    const dir = elbow.clone().sub(shoulder);
    const len1 = dir.length() || 0.28;
    up.quaternion.copy(quatAlongY(dir, face));
    const fore = add(foreName, up, 0, len1, 0);
    const dir2 = wrist.clone().sub(elbow);
    const len2 = dir2.length() || 0.24;
    fore.quaternion.copy(up.quaternion.clone().invert()).multiply(quatAlongY(dir2, face));
    add(handName, fore, 0, len2, 0);
  };
  arm(1, "LeftArm", "LeftForeArm", "LeftHand");
  arm(-1, "RightArm", "RightForeArm", "RightHand");
  return { root, fit, bones };
}

type WarriorPack = { geos: THREE.BufferGeometry[]; material: THREE.Material };

let warriorBodyPromise: Promise<WarriorPack> | null = null;

function loadWarriorBody() {
  if (warriorBodyPromise) return warriorBodyPromise;
  warriorBodyPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      "/models/warrior.glb",
      (gltf) => {
        try {
          gltf.scene.updateMatrixWorld(true);
          const sources: THREE.BufferGeometry[] = [];
          let sample: THREE.Material | null = null;
          gltf.scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh || !mesh.geometry) return;
            const geo = mesh.geometry.clone();
            geo.applyMatrix4(mesh.matrixWorld);
            sources.push(geo);
            if (!sample) sample = mesh.material as THREE.Material;
          });
          const probe = buildWarriorBones();
          probe.root.updateMatrixWorld(true);
          const idOf: Record<string, number> = {};
          probe.bones.forEach((bone, index) => {
            idOf[bone.name] = index;
          });
          const mapped = (sample as THREE.MeshStandardMaterial | null)?.map ?? null;
          if (mapped) mapped.colorSpace = THREE.SRGBColorSpace;
          const material = new THREE.MeshStandardMaterial({
            map: mapped,
            color: mapped ? "#ffffff" : "#b7a48a",
            roughness: 0.58,
            metalness: 0.18,
            emissive: "#ffffff",
            emissiveMap: mapped,
            emissiveIntensity: 0.22,
            side: THREE.DoubleSide,
          });
          const paint = (geo: THREE.BufferGeometry) => {
            const pos = geo.getAttribute("position");
            const indexAttr = new Uint16Array(pos.count * 4);
            const weightAttr = new Float32Array(pos.count * 4);
            const put = (v: number, a: number, aw: number, b = -1, bw = 0) => {
              const o = v * 4;
              const sum = aw + Math.max(0, bw);
              indexAttr[o] = a;
              weightAttr[o] = aw / sum;
              if (b >= 0 && bw > 0.04) {
                indexAttr[o + 1] = b;
                weightAttr[o + 1] = bw / sum;
              }
            };
            for (let v = 0; v < pos.count; v++) {
              const x = pos.getX(v);
              const y = pos.getY(v);
              const z = pos.getZ(v);
              const ax = Math.abs(x);
              const side = x < 0 ? "Right" : "Left";
              const up = idOf[`${side}UpLeg`]!;
              const low = idOf[`${side}Leg`]!;
              const foot = idOf[`${side}Foot`]!;
              const arm = idOf[`${side}Arm`]!;
              const fore = idOf[`${side}ForeArm`]!;
              const hand = idOf[`${side}Hand`]!;
              const hips = idOf.Hips!;
              const spine = idOf.Spine!;
              const spine1 = idOf.Spine1!;
              const chest = idOf.Spine2!;
              const neck = idOf.Neck!;
              const head = idOf.Head!;
              if (y > 0.74 && ax < 0.18) {
                put(v, head, 1);
              } else if (y > 0.62 && ax < 0.14) {
                const k = (y - 0.62) / 0.14;
                put(v, neck, 1 - k, head, k);
              } else if (y > -0.18 && y < 0.58 && ax > (y > 0.38 ? 0.3 : 0.27)) {
                const shoulderY = 0.5;
                const elbowY = 0.26;
                const wristY = -0.04;
                if (y > elbowY + 0.06) {
                  const k = THREE.MathUtils.clamp((shoulderY - y) / (shoulderY - elbowY), 0, 1);
                  put(v, arm, 1 - k * 0.45, k > 0.55 ? fore : chest, k > 0.55 ? (k - 0.55) : 0.2);
                } else if (y > wristY + 0.08) {
                  const k = THREE.MathUtils.clamp((elbowY - y) / (elbowY - wristY), 0, 1);
                  put(v, k < 0.72 ? fore : hand, 1, k < 0.72 ? arm : fore, k < 0.25 || k > 0.72 ? 0.35 : 0);
                } else {
                  put(v, hand, 0.82, fore, 0.18);
                }
              } else if (y < -0.3 && ax > 0.06) {
                if (y > -0.48) put(v, up, 0.75, hips, 0.25);
                else if (y > -0.62) put(v, low, 0.55, up, 0.45);
                else if (y > -0.86) put(v, low, 0.85, foot, 0.15);
                else put(v, foot, 0.8, low, 0.2);
              } else if (y < 0.1 && y > -0.42) {
                put(v, hips, 0.78, spine, 0.22);
              } else if (y > 0.5) {
                put(v, chest, 0.7, neck, 0.3);
              } else if (y > 0.32) {
                put(v, spine1, 0.6, chest, 0.4);
              } else if (y > 0.14) {
                put(v, spine, 0.55, spine1, 0.45);
              } else {
                put(v, hips, 0.6, spine, 0.4);
              }
              void z;
            }
            geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indexAttr, 4));
            geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weightAttr, 4));
            geo.computeBoundingSphere();
          };
          for (const geo of sources) paint(geo);
          resolve({ geos: sources, material });
        } catch (err) {
          reject(err);
        }
      },
      undefined,
      reject,
    );
  });
  return warriorBodyPromise;
}

export function createWarriorRig() {
  const { root, fit, bones } = buildWarriorBones();
  const bind = bones.map((bone) => ({ q: bone.quaternion.clone(), p: bone.position.clone() }));
  let alive = true;
  root.userData.releaseBody = () => {
    alive = false;
  };
  void loadWarriorBody()
    .then((pack) => {
      if (!alive) return;
      bones.forEach((bone, i) => {
        bone.quaternion.copy(bind[i]!.q);
        bone.position.copy(bind[i]!.p);
        bone.scale.set(1, 1, 1);
      });
      root.updateMatrixWorld(true);
      const skeleton = new THREE.Skeleton(bones);
      for (const source of pack.geos) {
        const mesh = new THREE.SkinnedMesh(source.clone(), pack.material.clone());
        mesh.name = "warrior-body";
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        fit.add(mesh);
        mesh.bind(skeleton);
      }
      bones.forEach((bone, i) => {
        bone.quaternion.copy(bind[i]!.q);
        bone.position.copy(bind[i]!.p);
        bone.scale.set(1, 1, 1);
      });
      root.updateMatrixWorld(true);
      const ready = root.userData.onWarriorReady;
      if (typeof ready === "function") ready();
    })
    .catch(() => {});
  return root;
}
