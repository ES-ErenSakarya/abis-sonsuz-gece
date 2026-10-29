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
  const hips = add("Hips", fit, 0, 0, 0.06);
  const spine = add("Spine", hips, 0, 0.16, -0.01);
  const spine1 = add("Spine1", spine, 0, 0.16, -0.01);
  const chest = add("Spine2", spine1, 0, 0.16, -0.01);
  const neck = add("Neck", chest, 0, 0.18, 0);
  add("Head", neck, 0, 0.16, 0.02);
  const leg = (side: number, upName: string, lowName: string, footName: string) => {
    const up = add(upName, hips, side * 0.18, -0.02, 0);
    up.rotation.z = Math.PI;
    const low = add(lowName, up, 0, 0.5, 0);
    low.rotation.y = Math.PI;
    add(footName, low, 0, 0.48, 0);
  };
  leg(1, "LeftUpLeg", "LeftLeg", "LeftFoot");
  leg(-1, "RightUpLeg", "RightLeg", "RightFoot");
  const face = new THREE.Vector3(0, 0, 1);
  const arm = (side: number, armName: string, foreName: string, handName: string) => {
    const shoulder = new THREE.Vector3(side * 0.22, 0.5, 0.02);
    const elbow = new THREE.Vector3(side * 0.34, 0.2, 0.03);
    const wrist = new THREE.Vector3(side * 0.42, -0.05, 0.05);
    const up = add(armName, chest, shoulder.x, shoulder.y - 0.48, shoulder.z - 0.03);
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
          const segs = probe.bones.map((bone, index) => {
            const start = probe.fit.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
            const child = bone.children.find((item) => (item as THREE.Bone).isBone) as THREE.Bone | undefined;
            const end = new THREE.Vector3();
            if (child) probe.fit.worldToLocal(child.getWorldPosition(end));
            else probe.fit.worldToLocal(bone.localToWorld(end.set(0, 0.14, 0)));
            if (start.distanceToSquared(end) < 1e-6) end.copy(start).add(new THREE.Vector3(0, 0.08, 0));
            return { index, start, end };
          });
          const mapped = (sample as THREE.MeshStandardMaterial | null)?.map ?? null;
          if (mapped) mapped.colorSpace = THREE.SRGBColorSpace;
          const material = new THREE.MeshStandardMaterial({
            map: mapped,
            color: mapped ? "#ffffff" : "#b7a48a",
            roughness: 0.62,
            metalness: 0.12,
            emissive: "#ffffff",
            emissiveMap: mapped,
            emissiveIntensity: 0.42,
            side: THREE.DoubleSide,
          });
          const point = new THREE.Vector3();
          for (const geo of sources) {
            const pos = geo.getAttribute("position");
            const indexAttr = new Uint16Array(pos.count * 4);
            const weightAttr = new Float32Array(pos.count * 4);
            for (let v = 0; v < pos.count; v++) {
              point.fromBufferAttribute(pos, v);
              let best = 0;
              let bestD = Infinity;
              let second = 0;
              let secondD = Infinity;
              for (let s = 0; s < segs.length; s++) {
                const seg = segs[s]!;
                const abx = seg.end.x - seg.start.x;
                const aby = seg.end.y - seg.start.y;
                const abz = seg.end.z - seg.start.z;
                const ab2 = abx * abx + aby * aby + abz * abz || 1e-6;
                let t = ((point.x - seg.start.x) * abx + (point.y - seg.start.y) * aby + (point.z - seg.start.z) * abz) / ab2;
                t = Math.max(0, Math.min(1, t));
                const dx = point.x - (seg.start.x + abx * t);
                const dy = point.y - (seg.start.y + aby * t);
                const dz = point.z - (seg.start.z + abz * t);
                const d = dx * dx + dy * dy + dz * dz;
                if (d < bestD) {
                  second = best;
                  secondD = bestD;
                  bestD = d;
                  best = s;
                } else if (d < secondD) {
                  secondD = d;
                  second = s;
                }
              }
              const w1 = 1 / (Math.sqrt(bestD) + 0.02);
              const w2 = 1 / (Math.sqrt(secondD) + 0.02);
              const sum = w1 + w2;
              const o = v * 4;
              indexAttr[o] = segs[best]!.index;
              indexAttr[o + 1] = segs[second]!.index;
              weightAttr[o] = w1 / sum;
              weightAttr[o + 1] = w2 / sum;
            }
            geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indexAttr, 4));
            geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weightAttr, 4));
            geo.computeVertexNormals();
            geo.computeBoundingSphere();
          }
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
      const posed = bones.map((bone) => ({ q: bone.quaternion.clone(), p: bone.position.clone(), s: bone.scale.clone() }));
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
        bone.quaternion.copy(posed[i]!.q);
        bone.position.copy(posed[i]!.p);
        bone.scale.copy(posed[i]!.s);
      });
      root.updateMatrixWorld(true);
      const ready = root.userData.onWarriorReady;
      if (typeof ready === "function") ready();
    })
    .catch(() => {});
  return root;
}
