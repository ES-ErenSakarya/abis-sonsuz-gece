import * as THREE from "three";

type Shot = {
  mesh: THREE.Object3D;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  live: boolean;
  kind: "arrow" | "bolt";
  dmg: number;
  crit: boolean;
  home: string;
};

type Boom = { mesh: THREE.Group; life: number; light: THREE.MeshBasicMaterial; ring: THREE.MeshBasicMaterial };

export type ShotTarget = { id: string; x: number; y: number; z: number; alive: boolean };

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

function arrowMesh() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.62, 5), new THREE.MeshLambertMaterial({ color: "#6b4a2a" }));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 6), new THREE.MeshLambertMaterial({ color: "#d5dbe3" }));
  tip.position.y = 0.36;
  const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.004), new THREE.MeshLambertMaterial({ color: "#f2efe6" }));
  fletch.position.y = -0.26;
  g.add(shaft, tip, fletch);
  g.visible = false;
  return g;
}

function boltMesh() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 6),
    new THREE.MeshBasicMaterial({ color: "#9fd0ff", transparent: true, opacity: 0.95 }),
  );
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshBasicMaterial({ color: "#3d6cb0", transparent: true, opacity: 0.35, depthWrite: false }),
  );
  g.add(core, glow);
  g.visible = false;
  return g;
}

function boomMesh() {
  const mesh = new THREE.Group();
  const light = new THREE.MeshBasicMaterial({ color: "#ffb15a", transparent: true, opacity: 0, depthWrite: false });
  const ringMat = new THREE.MeshBasicMaterial({ color: "#7eb6ff", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), light);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.32, 16), ringMat);
  ring.rotation.x = -Math.PI / 2;
  mesh.add(core, ring);
  mesh.visible = false;
  return { mesh, life: 1, light, ring: ringMat };
}

export function createCombat(scene: THREE.Scene) {
  const root = new THREE.Group();
  const arrows = Array.from({ length: 8 }, () => {
    const mesh = arrowMesh();
    root.add(mesh);
    return { mesh, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1.25, live: false, kind: "arrow" as const, dmg: 0, crit: false, home: "" };
  });
  const bolts = Array.from({ length: 5 }, () => {
    const mesh = boltMesh();
    root.add(mesh);
    return { mesh, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 0.9, live: false, kind: "bolt" as const, dmg: 0, crit: false, home: "" };
  });
  const booms = Array.from({ length: 5 }, () => {
    const boom = boomMesh();
    root.add(boom.mesh);
    return boom;
  });
  scene.add(root);

  const take = (pool: Shot[]) => pool.find((s) => !s.live) ?? pool[0]!;

  const launch = (pool: Shot[], origin: THREE.Vector3, dir: THREE.Vector3, speed: number, dmg: number, crit: boolean, home = "") => {
    const shot = take(pool);
    const n = _dir.copy(dir);
    if (n.lengthSq() < 1e-6) n.set(0, 0, -1);
    n.normalize();
    shot.x = origin.x + n.x * 0.35;
    shot.y = origin.y + n.y * 0.15;
    shot.z = origin.z + n.z * 0.35;
    shot.vx = n.x * speed;
    shot.vy = n.y * speed;
    shot.vz = n.z * speed;
    shot.life = 0;
    shot.live = true;
    shot.dmg = dmg;
    shot.crit = crit;
    shot.home = home;
    shot.mesh.visible = true;
    shot.mesh.position.set(shot.x, shot.y, shot.z);
  };

  const explode = (x: number, y: number, z: number) => {
    const boom = booms.find((b) => b.life >= 1) ?? booms[0]!;
    boom.life = 0;
    boom.mesh.visible = true;
    boom.mesh.position.set(x, y, z);
    boom.mesh.scale.setScalar(0.2);
    boom.light.opacity = 0.9;
    boom.ring.opacity = 0.7;
  };

  return {
    explode(x: number, y: number, z: number) {
      explode(x, y, z);
    },
    slash(x: number, y: number, z: number, yaw: number, mag: boolean) {
      const boom = booms.find((b) => b.life >= 1) ?? booms[0]!;
      boom.life = 0;
      boom.mesh.visible = true;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      boom.mesh.position.set(x + fx * 0.9, y, z + fz * 0.9);
      boom.mesh.scale.setScalar(0.2);
      boom.light.color.set(mag ? "#9fd0ff" : "#ffb15a");
      boom.light.opacity = 0.9;
      boom.ring.opacity = 0.7;
    },
    fireArrow(origin: THREE.Vector3, dir: THREE.Vector3, dmg: number, crit: boolean, home = "") {
      launch(arrows, origin, dir, 26, dmg, crit, home);
    },
    fireBolt(origin: THREE.Vector3, dir: THREE.Vector3, dmg: number, crit: boolean, home = "") {
      launch(bolts, origin, dir, 16, dmg, crit, home);
    },
    tick(dt: number, targets: ShotTarget[], onHit: (id: string, dmg: number, crit: boolean, x: number, y: number, z: number) => void) {
      const step = (shot: Shot) => {
        if (!shot.live) return;
        if (shot.home) {
          const target = targets.find((row) => row.id === shot.home && row.alive);
          if (target) {
            const dx = target.x - shot.x;
            const dy = target.y - shot.y;
            const dz = target.z - shot.z;
            const len = Math.hypot(dx, dy, dz) || 1;
            const speed = Math.hypot(shot.vx, shot.vy, shot.vz) || 26;
            const steer = 1 - Math.exp(-18 * dt);
            shot.vx += ((dx / len) * speed - shot.vx) * steer;
            shot.vy += ((dy / len) * speed - shot.vy) * steer;
            shot.vz += ((dz / len) * speed - shot.vz) * steer;
          }
        }
        shot.life += dt;
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        shot.z += shot.vz * dt;
        shot.mesh.position.set(shot.x, shot.y, shot.z);
        if (shot.kind === "arrow") {
          _dir.set(shot.vx, shot.vy, shot.vz).normalize();
          shot.mesh.quaternion.setFromUnitVectors(_up, _dir);
        }
        for (const target of targets) {
          if (!shot.live || !target.alive) continue;
          if (shot.home && target.id !== shot.home) continue;
          const dx = shot.x - target.x;
          const dy = shot.y - target.y;
          const dz = shot.z - target.z;
          if (dx * dx + dy * dy + dz * dz > 0.75) continue;
          shot.live = false;
          shot.mesh.visible = false;
          onHit(target.id, shot.dmg, shot.crit, shot.x, shot.y, shot.z);
          if (shot.kind === "bolt") explode(shot.x, shot.y, shot.z);
          return;
        }
        if (shot.life < shot.max) return;
        if (shot.kind === "bolt") explode(shot.x, shot.y, shot.z);
        shot.live = false;
        shot.mesh.visible = false;
      };
      for (const shot of arrows) step(shot);
      for (const shot of bolts) step(shot);
      for (const boom of booms) {
        if (boom.life >= 1) continue;
        boom.life += dt / 0.36;
        const k = Math.min(1, boom.life);
        boom.mesh.scale.setScalar(0.25 + k * 1.7);
        boom.light.opacity = (1 - k) * 0.9;
        boom.ring.opacity = (1 - k) * 0.65;
        if (boom.life >= 1) boom.mesh.visible = false;
      }
    },
    dispose() {
      scene.remove(root);
    },
  };
}
