import { useHud } from "@/game/hudStore";
import { blocked, inWater, PLAYER_R, SPAWN } from "@/game/world";

type Bag = {
  keys: Set<string>;
  injected: Set<string> | null;
  joyX: number;
  joyY: number;
  orbit: number;
  pitch: number;
  dist: number;
  look: boolean;
  sprint: boolean;
  x: number;
  z: number;
  yaw: number;
  cameraYaw: number;
  speed: number;
  phase: number;
  menuAngle: number;
  wishX: number;
  wishZ: number;
};

function bag(): Bag {
  const scope = globalThis as typeof globalThis & { __demirBag?: Bag };
  if (!scope.__demirBag) {
    scope.__demirBag = {
      keys: new Set<string>(),
      injected: null,
      joyX: 0,
      joyY: 0,
      orbit: 0,
      pitch: 0,
      dist: 4.7,
      look: false,
      sprint: false,
      x: SPAWN.x,
      z: SPAWN.z,
      yaw: 0,
      cameraYaw: 0,
      speed: 0,
      phase: 0,
      menuAngle: 0.85,
      wishX: 0,
      wishZ: 0,
    };
  }
  return scope.__demirBag;
}

export const input = {
  get keys() {
    return bag().keys;
  },
  get injected() {
    return bag().injected;
  },
  set injected(value: Set<string> | null) {
    bag().injected = value;
  },
  get joyX() {
    return bag().joyX;
  },
  set joyX(value: number) {
    bag().joyX = value;
  },
  get joyY() {
    return bag().joyY;
  },
  set joyY(value: number) {
    bag().joyY = value;
  },
  get orbit() {
    return bag().orbit;
  },
  set orbit(value: number) {
    bag().orbit = value;
  },
  get pitch() {
    return bag().pitch;
  },
  set pitch(value: number) {
    bag().pitch = value;
  },
  get dist() {
    return bag().dist;
  },
  set dist(value: number) {
    bag().dist = value;
  },
  get look() {
    return bag().look;
  },
  set look(value: boolean) {
    bag().look = value;
  },
  get sprint() {
    return bag().sprint;
  },
  set sprint(value: boolean) {
    bag().sprint = value;
  },
};

export const sim = {
  get x() {
    return bag().x;
  },
  set x(value: number) {
    bag().x = value;
  },
  get z() {
    return bag().z;
  },
  set z(value: number) {
    bag().z = value;
  },
  get yaw() {
    return bag().yaw;
  },
  set yaw(value: number) {
    bag().yaw = value;
  },
  get cameraYaw() {
    return bag().cameraYaw;
  },
  set cameraYaw(value: number) {
    bag().cameraYaw = value;
  },
  get speed() {
    return bag().speed;
  },
  set speed(value: number) {
    bag().speed = value;
  },
  get phase() {
    return bag().phase;
  },
  set phase(value: number) {
    bag().phase = value;
  },
  get menuAngle() {
    return bag().menuAngle;
  },
  set menuAngle(value: number) {
    bag().menuAngle = value;
  },
  get wishX() {
    return bag().wishX || 0;
  },
  set wishX(value: number) {
    bag().wishX = value;
  },
  get wishZ() {
    return bag().wishZ || 0;
  },
  set wishZ(value: number) {
    bag().wishZ = value;
  },
};

export function readSim() {
  const scope = globalThis as typeof globalThis & { __demirBag?: { x: number; z: number; yaw: number } };
  const row = scope.__demirBag;
  return { x: row?.x ?? 0, z: row?.z ?? 0, yaw: row?.yaw ?? 0 };
}

let hop: { x: number; z: number } | null = null;
export function queueHop(x: number, z: number) {
  hop = { x, z };
}
export function takeHop() {
  const next = hop;
  hop = null;
  return next;
}

export function held(code: string) {
  if (input.injected) return input.injected.has(code);
  return input.keys.has(code);
}

export function axes() {
  let fwd = 0;
  let str = 0;
  if (held("KeyW") || held("ArrowUp")) fwd += 1;
  if (held("KeyS") || held("ArrowDown")) fwd -= 1;
  if (held("KeyD") || held("ArrowRight")) str += 1;
  if (held("KeyA") || held("ArrowLeft")) str -= 1;
  fwd += input.joyY;
  str += input.joyX;
  return { fwd, str };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX?: () => number;
      getZ?: () => number;
      getOrbit?: () => number;
      setKeys?: (codes: string[]) => void;
      setPos?: (x: number, z: number) => void;
    };
  }
}

export function bindControlsTest() {
  window.__controlsTest = {
    getYaw: () => bag().yaw,
    getSpeed: () => bag().speed,
    getX: () => bag().x,
    getZ: () => bag().z,
    getOrbit: () => bag().orbit,
    setKeys: (codes: string[]) => {
      bag().injected = new Set(codes);
    },
    setPos: (x: number, z: number) => {
      const state = bag();
      state.x = x;
      state.z = z;
      state.wishX = 0;
      state.wishZ = 0;
      state.speed = 0;
    },
  };
}

let wind: AudioContext | null = null;
let windGain: GainNode | null = null;

export function setWindVolume(volume: number) {
  if (windGain) windGain.gain.value = Math.max(0, Math.min(1, volume)) * 0.04;
}

let enterGate: { name: string; where: { x?: number; z?: number } | null } | null = null;
const enterWatch = new Set<() => void>();

export function peekEnter() {
  return enterGate?.name ?? "";
}

export function subscribeEnter(fn: () => void) {
  enterWatch.add(fn);
  return () => {
    enterWatch.delete(fn);
  };
}

export function armEnter(name: string, where?: { x?: number; z?: number } | null) {
  enterGate = { name: name || "Karakter", where: where ?? null };
  enterWatch.forEach((fn) => fn());
}

export function releaseEnter() {
  const gate = enterGate;
  if (!gate) return;
  enterGate = null;
  enterWatch.forEach((fn) => fn());
  beginPlay(gate.where);
}

export function beginPlay(where?: { x?: number; z?: number } | null) {
  const state = bag();
  const has =
    !!where && typeof where.x === "number" && typeof where.z === "number" && Number.isFinite(where.x) && Number.isFinite(where.z);
  let x = has ? where.x! : SPAWN.x;
  let z = has ? where.z! : SPAWN.z;
  if (blocked(x, z, PLAYER_R) || inWater(x, z, 0.15)) {
    x = SPAWN.x;
    z = SPAWN.z;
  }
  state.x = x;
  state.z = z;
  state.yaw = 0;
  state.cameraYaw = 0;
  state.speed = 0;
  state.phase = 0;
  state.orbit = 0;
  state.pitch = 0.38;
  state.dist = 5.6;
  state.look = false;
  state.sprint = false;
  state.wishX = 0;
  state.wishZ = 0;
  state.injected = null;
  state.joyX = 0;
  state.joyY = 0;
  useHud.getState().setPlaying(true);
  if (wind) {
    void wind.resume();
    return;
  }
  const ctx = new AudioContext();
  wind = ctx;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.98 + white * 0.02;
    data[i] = last * 4.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 380;
  const gain = ctx.createGain();
  windGain = gain;
  gain.gain.value = 0.018;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  void ctx.resume();
}

export function releaseMoveKeys() {
  const keys = bag().keys;
  for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "Space"]) keys.delete(code);
  bag().sprint = false;
}

let bagDrag = false;

export function setBagDrag(on: boolean) {
  bagDrag = on;
}

export function bagDragging() {
  return bagDrag;
}
