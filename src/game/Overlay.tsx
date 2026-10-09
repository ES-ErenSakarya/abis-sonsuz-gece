import { useEffect, useRef, useState, useSyncExternalStore, type DragEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { bindControlsTest, input, queueHop, readSim } from "@/game/input";
import { useHud } from "@/game/hudStore";
import { HudAnchor, applyHudScale, hudAnchors, placeWindow } from "@/game/hudScale";
import { viewport } from "@/game/viewport";
import { armTouchHit } from "@/game/touchHit";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthScreens, CharacterScreens, leaveToCharacters } from "@/game/AccountScreens";
import { NetLive } from "@/game/NetLive";
import { answerDuel, answerSocial, addTradeItem, blockMate, closeTrade, endDuel, leaveParty, offerDuel, offerSocial, queuePick, removeFriend, setTradeOk, subscribeTarget, targetSnapshot } from "@/game/target";
import { chatFocused, chatSnapshot, sendChat, sendWhisper, setChatFocus, setWhisper, subscribeChat, whisperTarget } from "@/game/chat";
import { lootHint, queueGroundDrop, subscribeField, takeNearLoot } from "@/game/field";
import { captureSave, readCarry, setCarry } from "@/game/rpg";
import { saveCharacter } from "@/game/account";
import { useSession } from "@/game/session";
import { CATALOG, CLASS_TREES, className, displayName, ENHANCE, GATE_COST, itemStats, matForPlus, MENTORS, openBagCount, PAGE_SIZE, questGuide, SKILL_MAX, skillCdLeft, skillPreview, skillTier, SLOT_LABEL, STAT_HINT, STAT_LABEL, sumStats, upgradeChance, useRpg, weaponStyleOf, BAZAAR_OFFERS, CRAFTS, type CharTab, type EquipSlot, type Item, type ShopKind, type StatKey } from "@/game/rpg";
import { signOut } from "@/lib/auth/client";
import { loadGfx, readGfx, subscribeGfx, writeGfx } from "@/game/settings";
import { DUNGEON_BOUND, HOUSES, MAP_MARKS, REALMS, VILLAGE_BOUND, realmAt, realmGate, realmHerald } from "@/game/world";
import {
  copySelected,
  deleteSelected,
  editArmed,
  editVersion,
  editView,
  forgetEditable,
  isCreativeUser,
  nudgeByKey,
  nudgeSelected,
  publishLayout,
  resetAllLayout,
  resetSelected,
  scaleSelected,
  selectEditable,
  setEditArmed,
  setEditMask,
  setMoveStep,
  setRotStep,
  setSelectedNumbers,
  snapSelectedGround,
  subscribeEdit,
} from "@/game/creative";
import {
  addPatrolPoint,
  eraseStudio,
  forgetBlueprint,
  patchSpawner,
  placeBiome,
  placeBlueprint,
  placeGather,
  placeMarker,
  placePrefab,
  placeSpawner,
  placeWater,
  placeZone,
  PREFAB_THEMES,
  rememberPrice,
  saveBlueprint,
  setBrush,
  setHour,
  setPaintId,
  setPlaytest,
  setPower,
  setScatter,
  setStudioTool,
  setWaterKind,
  setWaterR,
  setZoneKind,
  setZoneLevel,
  setZoneR,
  studioCapturesLeft,
  studioPointer,
  studioRedo,
  studioUndo,
  studioVersion,
  studioView,
  subscribeStudio,
  toggleHit,
  toggleMan,
  toggleNav,
  pinMannequin,
} from "@/game/studio";
import { priceOf } from "@/game/studio";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

const MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function pocket(item: Item) {
  const bag = useRpg.getState().bag.slice();
  const hole = bag.findIndex((slot) => slot == null);
  if (hole < 0) {
    queueGroundDrop(item);
    useRpg.setState({ toast: "Çanta dolu" });
    return;
  }
  bag[hole] = item;
  useRpg.setState({ bag, toast: `${item.name} alındı` });
}

let keepCarry = false;
let dragSold = false;

function dragText(data: DataTransfer | null) {
  try {
    return data?.getData("text/plain") || "";
  } catch {
    return "";
  }
}

function sellDragged(raw: string) {
  if (dragSold) return;
  const token = readCarry();
  const rpg = useRpg.getState();
  let item: Item | null = null;
  let sell: (() => void) | null = null;
  if (token?.kind === "bag" || raw.startsWith("bag:")) {
    const from = token?.kind === "bag" ? token.index : Number(raw.slice(4));
    item = from >= 0 ? rpg.bag[from] ?? null : null;
    if (item) {
      const uid = item.uid;
      sell = () => {
        const now = useRpg.getState();
        if (now.bag[from]?.uid === uid) now.sellFromBag(from);
      };
    }
  } else if (token?.kind === "slot" || raw.startsWith("slot:")) {
    const slot = (token?.kind === "slot" ? token.slot : raw.slice(5)) as EquipSlot;
    item = slot ? rpg.equipped[slot] : null;
    if (item && slot) {
      const uid = item.uid;
      sell = () => {
        const now = useRpg.getState();
        if (now.equipped[slot]?.uid === uid) now.sellEquipped(slot);
      };
    }
  }
  if (!item || !sell) return;
  dragSold = true;
  if (item.id === "starter-chest" || item.kind === "bag") {
    useRpg.setState({ toast: "Bu eşya satılmaz" });
    return;
  }
  const name = item.name;
  const yes = sell;
  openAsk(`"${name}"\nEşyayı satmak istediğine emin misin?`, yes);
}

function dropBag(index: number) {
  const state = useRpg.getState();
  const item = state.bag[index];
  if (!item || item.id === "starter-chest") {
    useRpg.setState({ toast: item ? "Sandık yere atılmaz" : "" });
    return;
  }
  const bag = state.bag.slice();
  bag[index] = null;
  useRpg.setState({ bag, toast: `${item.name} yere bırakıldı` });
  queueGroundDrop(item);
}

function clearMove() {
  for (const code of MOVE_KEYS) input.keys.delete(code);
  input.keys.delete("Space");
}

let bootPlayed = false;

const REEL = [
  { name: "Ana Köy", sky: "#8ea4b8", land: "#6d7a56", water: "#3d6e86", wall: "#8a8176", note: "Çit, göl, ışınlayıcı" },
  { name: "İkinci Köy", sky: "#d2b48a", land: "#b08a58", water: "#6a84a0", wall: "#7a6858", note: "Bozkır avları" },
  { name: "Dolunay", sky: "#1b2436", land: "#243028", water: "#9eb6d0", wall: "#5c564e", note: "Ay ışığında orman" },
  { name: "Sonsuz Ay", sky: "#07060e", land: "#16141c", water: "#7ec4d8", wall: "#3a3844", note: "Harabe ve ruhlar" },
];

function paintReel(ctx: CanvasRenderingContext2D, w: number, h: number, map: (typeof REEL)[number], t: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, map.sky);
  sky.addColorStop(1, "#12110f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const drift = Math.sin(t * Math.PI * 2) * w * 0.04;
  ctx.fillStyle = map.land;
  ctx.beginPath();
  ctx.ellipse(w * 0.5 + drift, h * 0.72, w * 0.72, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = map.wall;
  ctx.lineWidth = Math.max(4, w * 0.008);
  ctx.beginPath();
  ctx.ellipse(w * 0.5 + drift, h * 0.62, w * 0.34, h * 0.16, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = map.water;
  ctx.beginPath();
  ctx.ellipse(w * 0.68 + drift, h * 0.66, w * 0.1, h * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6a5344";
  for (let i = 0; i < 5; i++) {
    const x = w * (0.28 + i * 0.08) + drift;
    const y = h * 0.56 + Math.sin(i + t * 6) * 6;
    ctx.fillRect(x, y, w * 0.045, h * 0.08);
    ctx.fillStyle = "#8d7358";
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + w * 0.022, y - h * 0.04);
    ctx.lineTo(x + w * 0.045 + 6, y);
    ctx.fill();
    ctx.fillStyle = "#6a5344";
  }
  ctx.fillStyle = "rgba(232,220,196,0.92)";
  ctx.font = `600 ${Math.max(22, w * 0.04)}px serif`;
  ctx.textAlign = "center";
  ctx.fillText(map.name, w * 0.5, h * 0.22);
  ctx.font = `${Math.max(13, w * 0.018)}px sans-serif`;
  ctx.fillStyle = "rgba(232,220,196,0.72)";
  ctx.fillText(map.note, w * 0.5, h * 0.22 + 28);
}

function MapReel() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const start = performance.now();
    const frame = () => {
      const now = performance.now();
      const w = Math.max(2, canvas.clientWidth);
      const h = Math.max(2, canvas.clientHeight);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const span = 8;
      const cycle = span * REEL.length;
      const local = ((now - start) / 1000 + cycle) % cycle;
      const index = Math.floor(local / span) % REEL.length;
      const u = (local % span) / span;
      const map = REEL[index] ?? REEL[0];
      const next = REEL[(index + 1) % REEL.length] ?? map;
      if (map) paintReel(ctx, w, h, map, u);
      if (next && u > 0.86) {
        ctx.globalAlpha = (u - 0.86) / 0.14;
        paintReel(ctx, w, h, next, 0);
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

function BootScreen({
  done,
  sessionWaiting,
  sceneReady,
  worldReady,
}: {
  done: boolean;
  sessionWaiting: boolean;
  sceneReady: boolean;
  worldReady: boolean;
}) {
  const pctRef = useRef(8);
  const [pct, setPct] = useState(8);
  const [gone, setGone] = useState(bootPlayed);
  useEffect(() => {
    if (bootPlayed) return;
    const cap = window.requestAnimationFrame(() => {
      bootPlayed = true;
      setGone(true);
    });
    return () => window.cancelAnimationFrame(cap);
  }, []);
  useEffect(() => {
    if (bootPlayed) return;
    let raf = 0;
    const tick = () => {
      const goal = done ? 100 : sessionWaiting ? 30 : !sceneReady ? 54 : !worldReady ? 76 : 92;
      const gap = goal - pctRef.current;
      if (gap > 0.2) pctRef.current = Math.min(goal, pctRef.current + Math.max(0.22, gap * 0.08));
      if (done) pctRef.current = Math.min(100, pctRef.current + 1.8);
      if (done && pctRef.current > 99.2) pctRef.current = 100;
      setPct(pctRef.current);
      if (pctRef.current >= 100) {
        bootPlayed = true;
        setGone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done, sceneReady, sessionWaiting, worldReady]);
  if (gone) return null;
  const shown = Math.min(100, Math.round(pct));
  return (
    <div className="absolute inset-0 z-50 bg-black" data-ui>
      <img src="/boot.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-[12%] flex flex-col items-center px-6">
        <p className="mb-1.5 text-[13px] font-semibold tracking-wide text-[#e7fdff]" style={{ textShadow: "0 0 10px #4df0ff" }}>
          {shown}%
        </p>
        <div className="h-3.5 w-[min(28rem,70vw)] overflow-hidden rounded-full border-2 border-[#3ad4e4] bg-black/75 p-px shadow-[0_0_18px_rgba(58,220,235,0.55)]">
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{
              width: `${shown}%`,
              background: "linear-gradient(90deg, #042f38 0%, #0c7f92 38%, #5eebf8 82%, #ffffff 100%)",
              boxShadow: "0 0 14px #6df6ff",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function Overlay({ sceneReady = false }: { sceneReady?: boolean }) {
  const playing = useHud((s) => s.playing);
  const zone = useHud((s) => s.zone);
  const { user, isPending } = useCurrentUserState();
  const [sessionSlow, setSessionSlow] = useState(false);
  useEffect(() => {
    if (!isPending) {
      setSessionSlow(false);
      return;
    }
    const id = window.setTimeout(() => setSessionSlow(true), 2500);
    return () => window.clearTimeout(id);
  }, [isPending]);
  const ready = useHud((s) => s.ready);
  const sessionWaiting = isPending && !sessionSlow;
  const [bootGiveUp, setBootGiveUp] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setBootGiveUp(true), 4500);
    return () => window.clearTimeout(id);
  }, []);
  const bootDone = bootGiveUp || !sessionWaiting;
  const activeId = useSession((s) => s.activeId);
  const nick = useRpg((s) => s.nick);
  const [mapOpen, setMapOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [questHud, setQuestHud] = useState(true);
  const [menu, setMenu] = useState<null | "root" | "opts">(null);
  const menuRef = useRef(menu);
  const friendsRef = useRef(false);
  menuRef.current = menu;
  friendsRef.current = friendsOpen;
  const drag = useRef<{ x: number; y: number } | null>(null);
  const lookPtr = useRef<number | null>(null);
  const lookBtn = useRef(0);
  const moved = useRef(0);
  const joy = useRef<{ id: number; ox: number; oy: number; travel: number } | null>(null);
  const knob = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => {
      applyHudScale();
      viewport.sync();
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    const releaseTouch = armTouchHit();
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      releaseTouch();
    };
  }, []);

  useEffect(() => {
    if (!playing || !activeId) return;
    const save = () => {
      void saveCharacter({ data: { id: activeId, save: captureSave() } }).catch(() => undefined);
    };
    const id = window.setInterval(save, 4000);
    const hide = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [playing, activeId]);

  useEffect(() => {
    bindControlsTest();
    const down = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (typing) {
        for (const code of MOVE_KEYS) input.keys.delete(code);
        input.keys.delete("Space");
        if (e.code === "Escape") {
          setChatFocus(false);
          if (e.target instanceof HTMLElement) e.target.blur();
        }
        return;
      }
      if (nudgeByKey(e.code)) {
        e.preventDefault();
        return;
      }
      if (MOVE_KEYS.has(e.code)) {
        input.keys.add(e.code);
        e.preventDefault();
        return;
      }
      input.keys.add(e.code);
      if (e.code === "Space") e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && editArmed()) {
        if (e.shiftKey) studioRedo();
        else studioUndo();
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyQ") {
        setQuestHud((open) => !open);
        e.preventDefault();
        return;
      }
      if (e.repeat) return;
      if (e.code === "Space") {
        const rpg = useRpg.getState();
        const style = weaponStyleOf(rpg.equipped.weapon?.id);
        if (rpg.chore?.kind === "fish" && rpg.chore.phase === "bite") rpg.reel();
        else if (!rpg.chore && style === "kazma") rpg.beginMine();
        else if (!rpg.chore && style === "olta") rpg.beginFish();
      }
      if (e.code === "Escape") {
        const panels = useRpg.getState();
        if (panels.invOpen || panels.charOpen || panels.shop) {
          panels.closePanels();
          e.preventDefault();
          return;
        }
        if (friendsRef.current) {
          setFriendsOpen(false);
          e.preventDefault();
          return;
        }
        if (menuRef.current) {
          setMenu(null);
          e.preventDefault();
          return;
        }
        setChatFocus(false);
        return;
      }
      if (e.code === "Enter") {
        setChatFocus(true);
        e.preventDefault();
        return;
      }
      if (e.code === "KeyI") useRpg.getState().toggleInv();
      if (e.code === "KeyC") useRpg.getState().showChar("stats");
      if (e.code === "KeyV") useRpg.getState().showChar("skills");
      if (e.code === "KeyB") useRpg.getState().showChar("quests");
      if (e.code === "KeyM") setMapOpen((open) => !open);
      if (e.code === "KeyN") setFriendsOpen((open) => !open);
      if (e.code === "KeyH") useRpg.getState().toggleRide();
      if (e.code.startsWith("Digit")) {
        const slot = Number(e.code.slice(5)) - 1;
        const id = useRpg.getState().hotbar[slot];
        if (id) useRpg.getState().castSkill(id);
      }
      if (e.code === "KeyE") {
        const here = readSim();
        const found = takeNearLoot(here.x, here.z);
        if (found) pocket(found);
      }
    };
    const up = (e: KeyboardEvent) => {
      input.keys.delete(e.code);
    };
    const blur = () => {
      input.keys.clear();
      input.joyX = 0;
      input.joyY = 0;
      input.look = false;
      input.sprint = false;
    };
    const blockMenu = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("contextmenu", blockMenu);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("contextmenu", blockMenu);
    };
  }, []);

  const paintPtr = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!playing) return;
    if ((e.target as HTMLElement).closest("[data-joy], [data-ui]")) return;
    if (e.button === 0 && studioCapturesLeft()) {
      paintPtr.current = e.pointerId;
      studioPointer(e.clientX, e.clientY, "down");
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    const mouseLook = e.pointerType !== "touch" && e.button === 2;
    const touchLook = e.pointerType === "touch";
    if (!mouseLook && !touchLook) return;
    lookPtr.current = e.pointerId;
    lookBtn.current = e.button;
    moved.current = 0;
    drag.current = { x: e.clientX, y: e.clientY };
    input.look = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (paintPtr.current === e.pointerId) {
      studioPointer(e.clientX, e.clientY, "move");
      return;
    }
    if (!drag.current || lookPtr.current !== e.pointerId) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    moved.current += Math.hypot(dx, dy);
    drag.current = { x: e.clientX, y: e.clientY };
    if (moved.current < 12) return;
    input.look = true;
    input.orbit -= dx * 0.0048;
    input.pitch = clamp(input.pitch + dy * 0.0042, -0.45, 1.15);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (paintPtr.current === e.pointerId) {
      studioPointer(e.clientX, e.clientY, "up");
      paintPtr.current = null;
      return;
    }
    if (lookPtr.current !== null && e.pointerId !== lookPtr.current) return;
    const started = lookPtr.current === e.pointerId;
    const click = started && lookBtn.current === 2 && moved.current < 8;
    const tapped = started && e.pointerType === "touch" && moved.current < 12;
    lookPtr.current = null;
    drag.current = null;
    input.look = false;
    if ((click || tapped) && useHud.getState().playing) queuePick(e.clientX, e.clientY);
  };
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!playing) return;
    input.dist = clamp(input.dist + e.deltaY * 0.004, 3.8, 10);
  };

  const joyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    joy.current = { id: e.pointerId, ox: rect.left + rect.width / 2, oy: rect.top + rect.height / 2, travel: rect.width * 0.34 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const joyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!joy.current || joy.current.id !== e.pointerId) return;
    const travel = joy.current.travel || 1;
    const dx = (e.clientX - joy.current.ox) / travel;
    const dy = (e.clientY - joy.current.oy) / travel;
    let x = clamp(dx, -1, 1);
    let y = clamp(-dy, -1, 1);
    const mag = Math.hypot(x, y);
    if (mag < 0.16) {
      x = 0;
      y = 0;
    } else {
      const scale = Math.min(1, (mag - 0.16) / (0.84 * Math.max(mag, 0.001)));
      x *= scale;
      y *= scale;
    }
    input.joyX = x;
    input.joyY = y;
    input.sprint = y > 0.82;
    e.currentTarget.classList.toggle("is-run", y > 0.82);
    if (knob.current) {
      knob.current.style.transform = `translate(${x * travel * 0.7}px, ${-y * travel * 0.7}px)`;
    }
  };
  const joyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    joy.current = null;
    input.joyX = 0;
    input.joyY = 0;
    input.sprint = false;
    e.currentTarget.classList.remove("is-run");
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
  };

  return (
    <div
      className="absolute inset-0 touch-none select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      {!playing ? <BootScreen done={bootDone} sessionWaiting={sessionWaiting} sceneReady={sceneReady} worldReady={ready} /> : null}
      {playing && activeId ? <NetLive nick={nick} /> : null}
      {playing ? (
        <>
          <div id="world-layer" className="world-layer">
            <div id="mob-bars" className="pointer-events-none absolute inset-0" />
            <div id="chat-bubbles" className="pointer-events-none absolute inset-0" />
            <div
              id="nameplate"
              className="pointer-events-none absolute hidden -translate-x-1/2 -translate-y-full whitespace-nowrap text-center text-sm font-medium text-fg"
              style={{ textShadow: "0 1px 2px #1c1916" }}
            />
            <div id="combat-floats" className="pointer-events-none absolute inset-0" />
          </div>
          <div id="hud-layer" className="hud-layer">
            <Vitals />
            <MobCardHud />
            <PartyWindow />
            <WorldMap zone={zone} big={mapOpen} onToggle={() => setMapOpen((open) => !open)} />
            {friendsOpen ? <FriendsWindow onClose={() => setFriendsOpen(false)} /> : null}
            <Prompt />
            <ToolHud />
            <QuestTracker open={questHud} />
            <Toast />
            <Hurt />
            <button
              type="button"
              data-ui
              className="hud-char pointer-events-auto absolute z-30 rounded-md border border-border bg-surface/90 px-3 py-2 text-sm text-fg"
              onClick={() => setMenu((open) => (open ? null : "root"))}
            >
              Ayarlar
            </button>
            <CreativeDock />
            {menu && !friendsOpen ? <SettingsMenu mode={menu} onMode={setMenu} onClose={() => setMenu(null)} onFriends={() => setFriendsOpen(true)} /> : null}
            <SelectBar />
            <SocialHud />
            <WhisperDock />
            <QuickButtons />
            <Panels />
            <CenterAsk />
            <DeathCard />
            <MapLoad />
            <div className="phone-dock">
              <div
                data-joy
                className="joy-stick hand-only absolute rounded-full border border-border bg-surface/80"
                onPointerDown={joyDown}
                onPointerMove={joyMove}
                onPointerUp={joyUp}
                onPointerCancel={joyUp}
              >
                <span className="joy-ring" aria-hidden="true" />
                <span className="joy-mark" aria-hidden="true">
                  koş
                </span>
                <div ref={knob} className="joy-knob absolute rounded-full bg-primary" />
              </div>
              <div className="phone-dock-mid">
                <ChatDock />
                <Hotbar />
              </div>
              <TouchCluster />
            </div>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 overflow-hidden">
          <MapReel />
          <div className="absolute inset-0 grid place-items-center overflow-x-hidden overflow-y-auto bg-black/40 px-4 py-6 touch-pan-y">
          {sessionWaiting ? null : !user ? (
            <AuthScreens />
          ) : (
            <CharacterScreens />
          )}
          </div>
        </div>
      )}
    </div>
  );
}

const MOVE_CHOICES = [
  { n: 0.001, label: "1 mm" },
  { n: 0.01, label: "1 cm" },
  { n: 0.1, label: "10 cm" },
  { n: 1, label: "1 m" },
];
const ROT_CHOICES = [
  { n: 0.01, label: "0.01°" },
  { n: 0.1, label: "0.1°" },
  { n: 1, label: "1°" },
  { n: 15, label: "15°" },
];

function CreativeDock() {
  const { user } = useCurrentUserState();
  const creative = isCreativeUser(user);
  useSyncExternalStore(subscribeEdit, editVersion, editVersion);
  const view = editView();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  if (!creative) return null;
  const pose = view.pose;
  const yawDeg = pose ? (pose.yaw * 180) / Math.PI : 0;
  const shown = view.list.filter((row) => row.label.toLowerCase().includes(filter.trim().toLowerCase()));
  const stepBtn = "rounded border border-border px-2 py-1 text-xs text-fg";
  return (
    <div className="pointer-events-auto absolute top-16 left-3 z-40 w-[min(20rem,92vw)]" data-ui>
      <button
        type="button"
        className="rounded-md border border-gold bg-surface/95 px-3 py-2 text-sm text-gold"
        onClick={() => {
          const next = !open;
          setOpen(next);
          setEditArmed(next);
          if (!next) setStudioTool("sec");
        }}
      >
        Yerleşim
      </button>
      {open ? (
        <div className="mt-2 max-h-[70vh] overflow-auto rounded-md border border-gold bg-bg/95 p-2 text-fg shadow-lg">
          <p className="text-xs text-muted">Sol tuş araziyi boyar. Sağ tık seçer. Ok taşır, Q/E döndürür, J zıplar. Ctrl+Z geri alır.</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {["hepsi", "bina", "npc", "ağaç", "kopya"].map((kind) => (
              <button key={kind} type="button" className={`${stepBtn} ${view.mask === kind ? "border-gold text-gold" : ""}`} onClick={() => setEditMask(kind)}>
                {kind}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {MOVE_CHOICES.map((row) => (
              <button key={row.n} type="button" className={`${stepBtn} ${view.moveStep === row.n ? "border-gold text-gold" : ""}`} onClick={() => setMoveStep(row.n)}>
                {row.label}
              </button>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {ROT_CHOICES.map((row) => (
              <button key={row.n} type="button" className={`${stepBtn} ${view.rotStep === row.n ? "border-gold text-gold" : ""}`} onClick={() => setRotStep(row.n)}>
                {row.label}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1">
            <button type="button" className={stepBtn} onClick={() => nudgeSelected(0, 0, -view.moveStep, 0)}>İleri</button>
            <button type="button" className={stepBtn} onClick={() => nudgeSelected(0, view.moveStep, 0, 0)}>Yukarı</button>
            <button type="button" className={stepBtn} onClick={() => nudgeSelected(0, 0, 0, view.rotStep)}>Sağa döndür</button>
            <button type="button" className={stepBtn} onClick={() => nudgeSelected(-view.moveStep, 0, 0, 0)}>Sol</button>
            <button type="button" className={stepBtn} onClick={() => nudgeSelected(0, -view.moveStep, 0, 0)}>Aşağı</button>
            <button type="button" className={stepBtn} onClick={() => nudgeSelected(0, 0, 0, -view.rotStep)}>Sola döndür</button>
            <button type="button" className={stepBtn} onClick={() => nudgeSelected(view.moveStep, 0, 0, 0)}>Sağ</button>
            <button type="button" className={stepBtn} onClick={() => nudgeSelected(0, 0, view.moveStep, 0)}>Geri</button>
            <button type="button" className={stepBtn} onClick={() => resetSelected()}>Sıfırla</button>
            <button type="button" className={stepBtn} onClick={() => copySelected()}>Kopyala</button>
            <button type="button" className={stepBtn} onClick={() => { if (eraseStudio(view.selected)) forgetEditable(view.selected); else deleteSelected(); }}>Sil</button>
            <button type="button" className={stepBtn} onClick={() => snapSelectedGround()}>Yere yapıştır</button>
            <button type="button" className={stepBtn} onClick={() => scaleSelected(0.9)}>Küçült</button>
            <button type="button" className={stepBtn} onClick={() => scaleSelected(1.1)}>Büyüt</button>
            <button type="button" className={stepBtn} onClick={() => studioUndo()}>Geri</button>
            <button type="button" className={stepBtn} onClick={() => studioRedo()}>İleri</button>
          </div>
          {pose ? (
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
              <label>X<input className="mt-1 w-full rounded border border-border bg-bg px-1 py-1" type="number" step={view.moveStep} value={Number(pose.x.toFixed(3))} onChange={(e) => setSelectedNumbers(Number(e.target.value), pose.y, pose.z, yawDeg)} /></label>
              <label>Y<input className="mt-1 w-full rounded border border-border bg-bg px-1 py-1" type="number" step={view.moveStep} value={Number(pose.y.toFixed(3))} onChange={(e) => setSelectedNumbers(pose.x, Number(e.target.value), pose.z, yawDeg)} /></label>
              <label>Z<input className="mt-1 w-full rounded border border-border bg-bg px-1 py-1" type="number" step={view.moveStep} value={Number(pose.z.toFixed(3))} onChange={(e) => setSelectedNumbers(pose.x, pose.y, Number(e.target.value), yawDeg)} /></label>
              <label>Açı°<input className="mt-1 w-full rounded border border-border bg-bg px-1 py-1" type="number" step={view.rotStep} value={Number(yawDeg.toFixed(3))} onChange={(e) => setSelectedNumbers(pose.x, pose.y, pose.z, Number(e.target.value))} /></label>
            </div>
          ) : <p className="mt-2 text-xs text-muted">Listeden ya da dünyadan bir yapı seç.</p>}
          <p className="mt-1 text-xs text-gold">{view.label} {view.dirty ? "· kayıt bekliyor" : ""}</p>
          {view.note ? <p className="text-xs text-muted">{view.note}</p> : null}
          <div className="mt-2 flex gap-1">
            <button type="button" className="rounded border border-gold px-2 py-1 text-xs text-gold" onClick={() => void publishLayout()}>Herkese kaydet</button>
            <button type="button" className={stepBtn} onClick={() => resetAllLayout()}>Hepsini sıfırla</button>
          </div>
          <StudioBar />
          <input className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 text-xs" placeholder="Ara" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="mt-1 max-h-40 overflow-auto">
            {shown.map((row) => (
              <button key={row.id} type="button" className={`block w-full truncate px-1 py-1 text-left text-xs ${view.selected === row.id ? "text-gold" : "text-fg"}`} onClick={() => selectEditable(row.id)}>
                {row.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const TERRAIN_TOOLS = [
  ["yukselt", "Yükselt"],
  ["alcalt", "Alçalt"],
  ["duz", "Düzle"],
  ["yumusat", "Yumuşat"],
  ["noise", "Engebe"],
  ["boya", "Boya"],
  ["serp", "Serp"],
  ["olc", "Ölç"],
  ["sec", "Seç"],
] as const;

const SPAWN_SPECS = [
  ["rat", "Sıçan"],
  ["wolf", "Kurt"],
  ["boar", "Domuz"],
  ["bear", "Ayı"],
  ["skel", "İskelet"],
  ["bandit", "Haydut"],
  ["golem", "Golem"],
  ["drake", "Ejder"],
  ["night", "Gece"],
] as const;

function StudioBar() {
  useSyncExternalStore(subscribeStudio, studioVersion, studioVersion);
  const view = studioView();
  const [tab, setTab] = useState<"arazi" | "obje" | "bolge" | "test">("arazi");
  const [theme, setTheme] = useState("Hepsi");
  const [query, setQuery] = useState("");
  const [zoneName, setZoneName] = useState("Bölge");
  const [printName, setPrintName] = useState("Kamp");
  const [biomeName, setBiomeName] = useState("Sis");
  const chip = "rounded border border-border px-2 py-1 text-xs text-fg";
  const on = "border-gold text-gold";
  const prefabs = view.prefabs.filter((id) => {
    const label = PREFAB_THEMES[id] ?? "";
    if (theme !== "Hepsi" && label !== theme) return false;
    return id.includes(query.trim().toLowerCase()) || label.toLowerCase().includes(query.trim().toLowerCase());
  });
  return (
    <div className="mt-3 border-t border-border pt-2">
      <div className="flex flex-wrap gap-1">
        {(["arazi", "obje", "bolge", "test"] as const).map((id) => (
          <button key={id} type="button" className={`${chip} ${tab === id ? on : ""}`} onClick={() => setTab(id)}>
            {id === "arazi" ? "Arazi" : id === "obje" ? "Obje" : id === "bolge" ? "Bölge" : "Test"}
          </button>
        ))}
      </div>
      {view.note ? <p className="mt-1 text-xs text-gold">{view.note}</p> : null}
      {view.dist > 0 ? <p className="text-xs text-muted">Mesafe {view.dist.toFixed(2)} m</p> : null}
      {tab === "arazi" ? (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1">
            {TERRAIN_TOOLS.map(([id, label]) => (
              <button key={id} type="button" className={`${chip} ${view.tool === id ? on : ""}`} onClick={() => setStudioTool(id)}>
                {label}
              </button>
            ))}
          </div>
          <label className="mt-2 block text-xs text-muted">Fırça {view.brush.toFixed(0)} m
            <input className="w-full" type="range" min={2} max={40} value={view.brush} onChange={(e) => setBrush(Number(e.target.value))} />
          </label>
          <label className="block text-xs text-muted">Güç {view.power.toFixed(2)}
            <input className="w-full" type="range" min={0.05} max={1.5} step={0.05} value={view.power} onChange={(e) => setPower(Number(e.target.value))} />
          </label>
          <div className="mt-1 flex flex-wrap gap-1">
            {["Çim", "Çamur", "Kaya", "Kum"].map((label, index) => (
              <button key={label} type="button" className={`${chip} ${view.paintId === index && view.tool === "boya" ? on : ""}`} onClick={() => setPaintId(index)}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {view.prefabs.filter((id) => ["agac", "cali", "kaya"].includes(id)).map((id) => (
              <button key={id} type="button" className={`${chip} ${view.scatter === id && view.tool === "serp" ? on : ""}`} onClick={() => setScatter(id)}>
                Serp {id}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(["gol", "nehir", "batak", "lav"] as const).map((kind) => (
              <button key={kind} type="button" className={`${chip} ${view.waterKind === kind ? on : ""}`} onClick={() => setWaterKind(kind)}>
                {kind}
              </button>
            ))}
            <button type="button" className={chip} onClick={() => placeWater()}>Su koy</button>
          </div>
          <label className="mt-1 block text-xs text-muted">Su yarıçapı {view.waterR}
            <input className="w-full" type="range" min={3} max={40} value={view.waterR} onChange={(e) => setWaterR(Number(e.target.value))} />
          </label>
        </div>
      ) : null}
      {tab === "obje" ? (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1">
            {["Hepsi", "Köy", "Harabe", "Çöl", "Doğa"].map((name) => (
              <button key={name} type="button" className={`${chip} ${theme === name ? on : ""}`} onClick={() => setTheme(name)}>
                {name}
              </button>
            ))}
          </div>
          <input className="mt-1 w-full rounded border border-border bg-bg px-2 py-1 text-xs" placeholder="Kütüphane ara" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="mt-1 flex flex-wrap gap-1">
            {prefabs.map((id) => (
              <button key={id} type="button" className={chip} onClick={() => placePrefab(id)}>
                {id}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1">
            <input className="w-full rounded border border-border bg-bg px-2 py-1 text-xs" value={printName} onChange={(e) => setPrintName(e.target.value)} />
            <button type="button" className={chip} onClick={() => saveBlueprint(printName)}>Şablon kaydet</button>
          </div>
          {view.blueprints.map((print) => (
            <div key={print.id} className="mt-1 flex gap-1 text-xs">
              <button type="button" className={chip} onClick={() => placeBlueprint(print.id)}>{print.name}</button>
              <button type="button" className={chip} onClick={() => forgetBlueprint(print.id)}>Sil</button>
            </div>
          ))}
        </div>
      ) : null}
      {tab === "bolge" ? (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1">
            {(["guvenli", "pvp", "seviye", "sehir"] as const).map((kind) => (
              <button key={kind} type="button" className={`${chip} ${view.zoneKind === kind ? on : ""}`} onClick={() => setZoneKind(kind)}>
                {kind}
              </button>
            ))}
          </div>
          <label className="mt-1 block text-xs text-muted">Yarıçap {view.zoneR}
            <input className="w-full" type="range" min={6} max={80} value={view.zoneR} onChange={(e) => setZoneR(Number(e.target.value))} />
          </label>
          <label className="block text-xs text-muted">Seviye {view.zoneLevel}
            <input className="w-full" type="range" min={1} max={55} value={view.zoneLevel} onChange={(e) => setZoneLevel(Number(e.target.value))} />
          </label>
          <div className="mt-1 flex gap-1">
            <input className="w-full rounded border border-border bg-bg px-2 py-1 text-xs" value={zoneName} onChange={(e) => setZoneName(e.target.value)} />
            <button type="button" className={chip} onClick={() => placeZone(zoneName)}>Bölge</button>
          </div>
          <p className="mt-2 text-xs text-muted">Spawner, kaynak, doğma</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {SPAWN_SPECS.map(([id, label]) => (
              <button key={id} type="button" className={chip} onClick={() => placeSpawner(id)}>{label}</button>
            ))}
          </div>
          {view.spawners.map((sp) => (
            <div key={sp.id} className="mt-1 rounded border border-border p-1 text-xs">
              <p>{sp.spec} · dolaş / aggro / süre / adet · devriye {sp.patrol.length}</p>
              <div className="mt-1 grid grid-cols-4 gap-1">
                <input type="number" className="rounded border border-border bg-bg px-1" value={sp.roam} onChange={(e) => patchSpawner(sp.id, { roam: Number(e.target.value) })} />
                <input type="number" className="rounded border border-border bg-bg px-1" value={sp.aggro} onChange={(e) => patchSpawner(sp.id, { aggro: Number(e.target.value) })} />
                <input type="number" className="rounded border border-border bg-bg px-1" value={sp.respawn} onChange={(e) => patchSpawner(sp.id, { respawn: Number(e.target.value) })} />
                <input type="number" className="rounded border border-border bg-bg px-1" value={sp.count} onChange={(e) => patchSpawner(sp.id, { count: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
              <button type="button" className={`${chip} mt-1`} onClick={() => addPatrolPoint(sp.id)}>Devriye noktası</button>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap gap-1">
            {(["maden", "bitki", "sandik", "gorev"] as const).map((kind) => (
              <button key={kind} type="button" className={chip} onClick={() => placeGather(kind)}>{kind}</button>
            ))}
            {(["dogma", "mezar", "taksi"] as const).map((kind) => (
              <button key={kind} type="button" className={chip} onClick={() => placeMarker(kind)}>{kind}</button>
            ))}
          </div>
        </div>
      ) : null}
      {tab === "test" ? (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1">
            <button type="button" className={`${chip} ${view.playtest ? on : ""}`} onClick={() => setPlaytest(!view.playtest)}>Oyuncu testi</button>
            <button type="button" className={`${chip} ${view.showNav ? on : ""}`} onClick={() => toggleNav(!view.showNav)}>Navmesh</button>
            <button type="button" className={`${chip} ${view.showHit ? on : ""}`} onClick={() => toggleHit(!view.showHit)}>Çarpışma</button>
            <button type="button" className={`${chip} ${view.showMan ? on : ""}`} onClick={() => toggleMan(!view.showMan)}>Manken</button>
            <button type="button" className={chip} onClick={() => pinMannequin()}>Mankeni buraya</button>
          </div>
          <label className="mt-2 block text-xs text-muted">Saat {view.hour ?? "mevsim"}
            <input className="w-full" type="range" min={0} max={24} value={view.hour ?? 12} onChange={(e) => setHour(Number(e.target.value))} />
          </label>
          <button type="button" className={`${chip} mt-1`} onClick={() => setHour(null)}>Saati bırak</button>
          <div className="mt-2 flex gap-1">
            <input className="w-full rounded border border-border bg-bg px-2 py-1 text-xs" value={biomeName} onChange={(e) => setBiomeName(e.target.value)} />
            <button type="button" className={chip} onClick={() => placeBiome(biomeName, "#9bb0c4")}>Sis bölgesi</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TouchCluster() {
  const weaponId = useRpg((s) => s.equipped.weapon?.id);
  const steed = useRpg((s) => s.steed);
  const riding = useRpg((s) => s.riding);
  const style = weaponStyleOf(weaponId);
  const label = style === "kazma" ? "Kaz" : style === "olta" ? "Tut" : "Vur";
  return (
    <div className="hand-cluster" data-ui>
      <div className="hand-actions">
        {steed ? (
          <button
            type="button"
            data-ui
            className="hand-hit mr-2 grid place-items-center rounded-full border border-border bg-surface/95 text-[11px] text-fg"
            data-press="down"
            onPointerDown={(e) => {
              e.stopPropagation();
              useRpg.getState().toggleRide();
            }}
          >
            {riding ? "İn" : "Bin"}
          </button>
        ) : null}
        <button
          type="button"
          data-ui
          className="hand-hit grid place-items-center rounded-full border border-gold bg-surface/95 text-[11px] font-medium text-gold"
          data-press="down"
          onPointerDown={(e) => {
            e.stopPropagation();
            const rpg = useRpg.getState();
            const heldStyle = weaponStyleOf(rpg.equipped.weapon?.id);
            if (rpg.chore?.kind === "fish" && rpg.chore.phase === "bite") {
              rpg.reel();
              return;
            }
            if (!rpg.chore && heldStyle === "kazma") {
              rpg.beginMine();
              return;
            }
            if (!rpg.chore && heldStyle === "olta") {
              rpg.beginFish();
              return;
            }
            input.keys.add("Space");
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            input.keys.delete("Space");
          }}
          onPointerCancel={() => input.keys.delete("Space")}
        >
          {label}
        </button>
      </div>
      <div className="hand-tools">
        <button type="button" data-ui className="hand-tool" onPointerDown={(e) => e.stopPropagation()} onClick={() => useRpg.getState().showChar("stats")}>
          Statü
        </button>
        <button type="button" data-ui className="hand-tool" onPointerDown={(e) => e.stopPropagation()} onClick={() => useRpg.getState().showChar("skills")}>
          Yetenek
        </button>
        <button type="button" data-ui className="hand-tool" onPointerDown={(e) => e.stopPropagation()} onClick={() => useRpg.getState().toggleInv()}>
          Çanta
        </button>
        <button type="button" data-ui className="hand-tool" onPointerDown={(e) => e.stopPropagation()} onClick={() => useRpg.getState().showChar("quests")}>
          Görev
        </button>
      </div>
    </div>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5">
      <span className="text-[10px] tracking-wide text-muted">{label}</span>
      <span className="h-2 min-w-0 overflow-hidden rounded-sm border border-border bg-bg">
        <span className={`block h-full ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-right text-[10px] leading-none tabular-nums text-fg">
        {Math.ceil(value)}/{Math.ceil(max)}
      </span>
    </div>
  );
}

function Vitals() {
  const hp = useRpg((s) => s.hp);
  const hpMax = useRpg((s) => s.hpMax);
  const mana = useRpg((s) => s.mana);
  const manaMax = useRpg((s) => s.manaMax);
  const sta = useRpg((s) => s.sta);
  const staMax = useRpg((s) => s.staMax);
  const level = useRpg((s) => s.level);
  const xp = useRpg((s) => s.xp);
  const xpTo = useRpg((s) => s.xpTo);
  const [xpTip, setXpTip] = useState(false);
  const progress = (xp / Math.max(1, xpTo)) * 4;
  const pct = Math.round((xp / Math.max(1, xpTo)) * 100);
  return (
    <div
      className="hud-vitals pointer-events-auto absolute z-20"
      data-xp={Math.floor(xp)}
      data-xp-to={xpTo}
      onPointerEnter={() => setXpTip(true)}
      onPointerLeave={() => setXpTip(false)}
    >
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface/90 p-2">
        <Bar label="CAN" value={hp} max={hpMax} tone="bg-hp" />
        <Bar label="MANA" value={mana} max={manaMax} tone="bg-mp" />
        <Bar label="STA" value={sta} max={staMax} tone="bg-sta" />
        <div className="relative mt-1 flex items-center gap-2" onMouseEnter={() => setXpTip(true)} onMouseLeave={() => setXpTip(false)}>
          <span className="grid h-7 min-w-7 place-items-center rounded-md border border-gold/70 px-1 text-[11px] text-gold" title="Seviye">
            {level}
          </span>
          {[0, 1, 2, 3].map((i) => (
            <Orb key={i} fill={progress - i} />
          ))}
          {xpTip ? (
            <span className="absolute -top-7 left-0 rounded-md border border-gold bg-bg px-2 py-0.5 text-[11px] text-gold">
              {pct}% · {Math.floor(xp)}/{xpTo}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Orb({ fill }: { fill: number }) {
  const amount = Math.max(0, Math.min(1, fill));
  return (
    <div className="xp-orb relative h-7 w-7" data-fill={amount.toFixed(3)} aria-hidden="true">
      <div className="absolute inset-0 overflow-hidden rounded-full border-2 border-[#c9a15b] bg-[#100e0c]">
        <div className="absolute inset-x-0 bottom-0 bg-[#e2b45a]" style={{ height: `${amount * 100}%` }} />
      </div>
    </div>
  );
}

function SelectBar() {
  const snap = useSyncExternalStore(subscribeTarget, targetSnapshot, targetSnapshot);
  const nick = useRpg((s) => s.nick);
  const level = useRpg((s) => s.level);
  const { sel, duel } = snap;
  if (duel.phase === "in") {
    return (
      <div data-ui className="pointer-events-auto absolute top-16 left-1/2 z-20 w-[min(18rem,90vw)] -translate-x-1/2 rounded-lg border border-gold/70 bg-surface/95 p-3 text-center">
        <p className="text-xs tracking-widest text-gold">VS</p>
        <p className="mt-1 text-sm text-fg">
          {duel.nick} · Sv.{duel.level} düello istiyor
        </p>
        <div className="mt-2 flex justify-center gap-2">
          <button type="button" className="rounded-md border border-gold bg-bg px-3 py-1.5 text-sm text-gold" onClick={() => answerDuel(true, nick, level)}>
            Kabul
          </button>
          <button type="button" className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-fg" onClick={() => answerDuel(false, nick, level)}>
            Reddet
          </button>
        </div>
      </div>
    );
  }
  if (duel.phase !== "live" && duel.phase !== "sent") return null;
  const label = sel ? (sel.kind === "mob" ? sel.name : `${sel.nick} · Sv.${sel.level}`) : `${duel.nick} · Sv.${duel.level}`;
  const vs = duel.phase === "live" ? "VS" : "Teklif gitti";
  return (
    <div data-ui className="pointer-events-auto absolute top-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-surface/95 px-3 py-2">
      <span className="text-xs tracking-widest text-gold">{vs}</span>
      <span className="text-sm text-fg">{label}</span>
      <button type="button" className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-muted" onClick={() => endDuel(nick, level)}>
        Bırak
      </button>
    </div>
  );
}

function SocialHud() {
  const snap = useSyncExternalStore(subscribeTarget, targetSnapshot, targetSnapshot);
  const { sel, duel, social } = snap;
  if (social.phase === "in") {
    const title = social.act === "trade" ? "Ticaret" : social.act === "friend" ? "Dost" : "Grup";
    return (
      <div data-ui className="pointer-events-auto absolute top-16 left-1/2 z-20 w-[min(18rem,90vw)] -translate-x-1/2 rounded-lg border border-border bg-surface/95 p-3 text-center">
        <p className="text-xs tracking-widest text-gold">{title}</p>
        <p className="mt-1 text-sm text-fg">{social.nick} teklif ediyor</p>
        <div className="mt-2 flex justify-center gap-2">
          <button type="button" className="rounded-md border border-gold bg-bg px-3 py-1.5 text-sm text-gold" onClick={() => answerSocial(true)}>
            Kabul
          </button>
          <button type="button" className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-fg" onClick={() => answerSocial(false)}>
            Reddet
          </button>
        </div>
      </div>
    );
  }
  if (social.phase === "live" && social.act === "trade") {
    const trade = snap.trade;
    const cell = (item: Item | null) => (
      <div className="flex min-h-12 items-center rounded-md border border-border bg-bg/80 px-2 text-xs text-fg">
        {item ? displayName(item) : <span className="text-muted">Boş</span>}
      </div>
    );
    return (
      <div
        data-ui
        className="hud-window pointer-events-auto absolute top-20 left-1/2 z-30 w-[min(40rem,96vw)] -translate-x-1/2 rounded-xl border border-border bg-surface/95 p-3"
        onPointerDown={(e) => e.stopPropagation()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const raw = e.dataTransfer.getData("text/plain");
          if (raw.startsWith("bag:")) addTradeItem(Number(raw.slice(4)));
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-gold">Ticaret · {social.nick}</p>
          <button type="button" className="text-xs text-muted" onClick={() => closeTrade()}>
            Kapat
          </button>
        </div>
        <p className="mb-2 text-[11px] text-muted">Envanterden eşyayı kendi pencerenin üstüne sürükle. İki taraf da kabul edince takas olur.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs text-gold">Sen</p>
            <div className="flex flex-col gap-1">
              {trade.mine.length === 0 ? cell(null) : trade.mine.map((item) => <div key={item.uid}>{cell(item)}</div>)}
            </div>
            <button
              type="button"
              className={trade.mineOk ? "mt-2 w-full rounded-md border border-gold bg-gold/15 px-2 py-1.5 text-sm text-gold" : "mt-2 w-full rounded-md border border-border px-2 py-1.5 text-sm"}
              onClick={() => setTradeOk(!trade.mineOk)}
            >
              {trade.mineOk ? "Kabul edildi" : "Kabul"}
            </button>
          </div>
          <div>
            <p className="mb-1 text-xs text-gold">{social.nick}</p>
            <div className="flex flex-col gap-1">
              {trade.theirs.length === 0 ? cell(null) : trade.theirs.map((item) => <div key={item.uid}>{cell(item)}</div>)}
            </div>
            <p className="mt-2 rounded-md border border-border px-2 py-1.5 text-center text-sm text-muted">{trade.theirsOk ? "Kabul etti" : "Bekliyor"}</p>
          </div>
        </div>
      </div>
    );
  }
  if (duel.phase === "in" || duel.phase === "live" || social.phase === "sent") return null;
  if (!sel || sel.kind !== "player") return null;
  const known = snap.friends.some((mate) => mate.id === sel.id);
  const grouped = snap.party.some((mate) => mate.id === sel.id);
  const act = (label: string, run: () => void, off = false) => (
    <button type="button" disabled={off} className="rounded-md px-2.5 py-1.5 text-sm text-fg hover:bg-bg disabled:cursor-default disabled:opacity-35" onClick={run}>
      {label}
    </button>
  );
  return (
    <div data-ui className="hud-target pointer-events-auto absolute top-16 left-1/2 z-40 flex max-w-[96vw] -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-lg border border-border bg-surface/95 px-1 py-1">
      <span className="px-2 text-xs text-gold">{sel.nick}</span>
      <button
        type="button"
        disabled={known}
        className={known ? "rounded-md border border-border px-2.5 py-1.5 text-sm text-muted opacity-50" : "hud-friend rounded-md border border-gold bg-gold/15 px-2.5 py-1.5 text-sm text-gold"}
        onClick={() => offerSocial("friend")}
      >
        {known ? "Dostun" : "Dost ekle"}
      </button>
      {act(grouped ? "Grupta" : "Grup", () => offerSocial("party"), grouped)}
      {act("Ticaret", () => offerSocial("trade"))}
      {act("Düello", () => offerDuel(useRpg.getState().nick, useRpg.getState().level))}
      {act("Fısıltı", () => setWhisper({ id: sel.id, nick: sel.nick }))}
    </div>
  );
}

function ChatDock() {
  const lines = useSyncExternalStore(subscribeChat, chatSnapshot, chatSnapshot);
  const box = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const open = chatFocused();
  useEffect(() => {
    if (open) box.current?.focus();
  }, [open]);
  if (!open) return null;
  const recent = lines.filter((line) => !line.whisper).slice(-4);
  return (
    <div data-ui className="hud-chat pointer-events-auto absolute left-1/2 z-20 -translate-x-1/2" onPointerDown={(e) => e.stopPropagation()}>
      {recent.length > 0 ? (
        <div className="chat-log mb-1 max-h-24 overflow-hidden rounded-md bg-bg/75 px-2 py-1.5">
          {recent.map((line) => (
            <p key={line.id} className="truncate text-xs text-fg">
              <span className="text-muted">{line.nick}: </span>
              {line.text}
            </p>
          ))}
        </div>
      ) : null}
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          sendChat(draft);
          setDraft("");
          setChatFocus(false);
          box.current?.blur();
        }}
      >
        <input
          ref={box}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => {
            clearMove();
            setChatFocus(true);
          }}
          placeholder="Mesaj"
          maxLength={80}
          className="min-w-0 flex-1 rounded-md border border-border bg-bg/95 px-2 py-1.5 text-sm text-fg outline-none"
        />
        <button type="submit" className="rounded-md border border-border bg-surface px-2 text-sm text-gold">
          Yaz
        </button>
      </form>
    </div>
  );
}

const whisperPin = new HudAnchor("top-left", 0.04, 0.12);

function WhisperDock() {
  const to = whisperTarget();
  const lines = useSyncExternalStore(subscribeChat, chatSnapshot, chatSnapshot);
  const box = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [pos, setPos] = useState(() => {
    const w = typeof window === "undefined" ? 1280 : window.innerWidth;
    const h = typeof window === "undefined" ? 800 : window.innerHeight;
    return whisperPin.place(w, h);
  });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  useEffect(() => {
    const fit = () => setPos(whisperPin.place(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, []);
  if (!to) return null;
  const recent = lines.filter((line) => line.whisper).slice(-12);
  return (
    <div
      data-ui
      className="hud-window hud-whisper pointer-events-auto absolute z-30 rounded-xl border border-gold/40 bg-surface/95 p-3 shadow-lg"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="mb-2 flex cursor-grab items-center justify-between active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button,input")) return;
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const w = window.innerWidth;
          const h = window.innerHeight;
          const next = {
            x: Math.max(w * 0.01, Math.min(w * 0.7, e.clientX - drag.current.dx)),
            y: Math.max(h * 0.01, Math.min(h * 0.8, e.clientY - drag.current.dy)),
          };
          whisperPin.stick(next.x, next.y, w, h);
          setPos(next);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <p className="text-sm text-gold">Fısıltı · {to.nick}</p>
        <button type="button" className="text-xs text-muted" onClick={() => setWhisper(null)}>
          Kapat
        </button>
      </div>
      <div className="mb-2 max-h-48 space-y-1 overflow-auto">
        {recent.length === 0 ? <p className="text-xs text-muted">Henüz fısıltı yok</p> : null}
        {recent.map((line) => (
          <p key={line.id} className="text-sm text-fg">
            <span className="text-gold">{line.nick}: </span>
            {line.text}
          </p>
        ))}
      </div>
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          sendWhisper(draft);
          setDraft("");
        }}
      >
        <input
          value={draft}
          ref={box}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={clearMove}
          placeholder="Fısıltı yaz"
          maxLength={120}
          className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-2 text-sm text-fg outline-none"
        />
        <button type="submit" className="rounded-md border border-border px-3 text-sm text-gold">
          Gönder
        </button>
      </form>
    </div>
  );
}

function Hotbar() {
  const hotbar = useRpg((s) => s.hotbar);
  const skills = useRpg((s) => s.skills);
  const classId = useRpg((s) => s.classId);
  const base = useRpg((s) => s.base);
  const invested = useRpg((s) => s.invested);
  const equipped = useRpg((s) => s.equipped);
  const level = useRpg((s) => s.level);
  const totals = sumStats({ base, invested, equipped, level, skills });
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const names = new Map(CLASS_TREES[classId].flatMap((tree) => tree.skills.map((sk) => [sk.id, sk] as const)));
  const shown = tip ? names.get(tip.id) : undefined;
  const preview = tip ? skillPreview(tip.id, skills[tip.id] ?? 0, totals) : null;
  return (
    <div data-ui className="hud-hotbar pointer-events-auto absolute z-20 flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
      {hotbar.map((id, index) => (
        <button
          key={index}
          type="button"
          className="hud-slot relative grid place-items-center rounded-md border border-border bg-surface/95"
          onClick={() => id && useRpg.getState().castSkill(id)}
          onMouseEnter={(e) => id && setTip({ id, x: e.clientX, y: e.clientY })}
          onMouseMove={(e) => id && setTip({ id, x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setTip(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            useRpg.getState().setHotbar(index, null);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const raw = e.dataTransfer.getData("text/plain");
            if (raw.startsWith("skill:")) useRpg.getState().setHotbar(index, raw.slice(6));
          }}
        >
          <span className="absolute top-0.5 left-1 text-[9px] text-muted">{index + 1}</span>
          {id ? <SkillMark id={id} /> : null}
        </button>
      ))}
      {shown && preview && tip ? (
        <div className="pointer-events-none absolute bottom-14 left-1/2 z-30 w-56 -translate-x-1/2 rounded-md border border-border bg-surface/95 p-2 text-left text-xs text-fg shadow-lg">
          <p className="text-gold">{shown.name}</p>
          <p className="mt-1 text-muted">{shown.desc}</p>
          <p className="mt-1">{preview.buff ? "Hasar yok" : `Hasar ${preview.dmg}`}</p>
          <p className="text-muted">Seviye {skillTier(skills[tip.id] ?? 0)} · {skillCdLeft(tip.id) > 0.05 ? `${skillCdLeft(tip.id).toFixed(1)} sn` : "Hazır"}</p>
        </div>
      ) : null}
    </div>
  );
}

function QuickButtons() {
  const unspent = useRpg((s) => s.unspent);
  const points = useRpg((s) => s.skillPoints);
  return (
    <>
      {unspent > 0 ? (
        <button type="button" data-ui className="hud-plus left-4" onClick={() => useRpg.getState().showChar("stats")}>
          <b>+</b>
          <span>Statü Geliştir</span>
        </button>
      ) : null}
      {points > 0 ? (
        <button type="button" data-ui className="hud-plus right-4" onClick={() => useRpg.getState().showChar("skills")}>
          <b>+</b>
          <span>Beceri Geliştir</span>
        </button>
      ) : null}
    </>
  );
}

function QuestTracker({ open }: { open: boolean }) {
  const quests = useRpg((s) => s.quests);
  const active = quests.filter((quest) => !quest.claimed);
  const [tip, setTip] = useState<{ item: Item; x: number; y: number } | null>(null);
  const [way, setWay] = useState("");
  useEffect(() => {
    let frame = 0;
    let last = "";
    const loop = () => {
      const here = readSim();
      const guide = questGuide(here.x, here.z);
      const next = guide?.label ?? "";
      if (next !== last) {
        last = next;
        setWay(next);
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, []);
  if (!open) return null;
  return (
    <div className="hud-quests pointer-events-auto absolute z-10 rounded-md border border-border bg-surface/80 px-3 py-2">
      <p className="text-[10px] tracking-widest text-gold">Görevler</p>
      {way ? <p className="mt-1 text-[11px] text-gold">Yön: {way}</p> : null}
      {active.length === 0 ? <p className="mt-1 text-[11px] text-muted">Görev yok</p> : null}
      {active.map((quest) => {
        const preview = quest.rewardName
          ? ({
              uid: quest.id,
              id: quest.id,
              name: quest.rewardName,
              slot: "ring",
              level: quest.minLevel,
              plus: 0,
              str: 4,
              hp: 8,
              ats: 0,
              mvs: 0,
              ctp: 1,
              desc: "Ödül. %5 şansla + basılı gelir.",
            } as Item)
          : null;
        return (
          <div key={quest.id} className="mt-1.5">
            <p className="text-xs text-fg">{quest.title}{quest.minLevel ? ` · Sv.${quest.minLevel}` : ""}</p>
            <p className="text-[11px] text-muted">{quest.done ? "Ödül için görevliye dön" : `${Math.min(quest.have, quest.need)}/${quest.need}`}</p>
            <p className="text-[11px] text-gold">
              {quest.xpReward ?? 0} XP · {quest.goldReward ?? 0} altın
            </p>
            {preview ? (
              <p
                className="text-[11px] text-fg"
                onMouseEnter={(e) => setTip({ item: preview, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setTip({ item: preview, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setTip(null)}
              >
                Ödül: {preview.name}
              </p>
            ) : null}
          </div>
        );
      })}
      {tip ? <Tip item={tip.item} x={tip.x} y={tip.y} /> : null}
    </div>
  );
}

function SettingsMenu({ mode, onMode, onClose, onFriends }: { mode: "root" | "opts"; onMode: (mode: "root" | "opts") => void; onClose: () => void; onFriends: () => void }) {
  const gfx = useSyncExternalStore(subscribeGfx, readGfx, readGfx);
  const panelOpen = useRpg((s) => s.charOpen || s.invOpen || Boolean(s.shop));
  useEffect(() => {
    loadGfx();
  }, []);
  if (panelOpen) return null;
  const go = (run: () => void) => {
    onClose();
    run();
  };
  return (
    <div data-ui className="settings-menu hud-window pointer-events-auto absolute top-1/2 left-1/2 z-50 w-[min(18rem,86vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface/95 p-3" onPointerDown={(e) => e.stopPropagation()}>
      {mode === "root" ? (
        <div className="flex flex-col gap-1.5">
          <p className="mb-1 text-xs tracking-widest text-gold">Ayarlar</p>
          <button type="button" className="rounded-md border border-border px-3 py-2 text-left text-sm" onClick={() => go(onFriends)}>
            Dostlar
          </button>
          <button type="button" className="rounded-md border border-border px-3 py-2 text-left text-sm" onClick={() => onMode("opts")}>
            Oyun Seçenekleri
          </button>
          <button type="button" className="rounded-md border border-border px-3 py-2 text-left text-sm" onClick={() => go(() => leaveToCharacters())}>
            Karakter Değişikliği
          </button>
          <button type="button" className="rounded-md border border-border px-3 py-2 text-left text-sm" onClick={() => go(() => void signOut("/"))}>
            Çıkış
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-left text-sm"
            onClick={() =>
              go(() => {
                window.close();
                useRpg.setState({ toast: "Sekme kapanmazsa tarayıcıdan kapat" });
              })
            }
          >
            Oyun Sonu
          </button>
          <button type="button" className="rounded-md border border-gold px-3 py-2 text-left text-sm text-gold" onClick={onClose}>
            İptal
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-xs tracking-widest text-gold">Oyun Seçenekleri</p>
          <label className="flex items-center justify-between gap-2">
            FPS
            <select className="rounded-md border border-border bg-bg px-2 py-1" value={gfx.fps} onChange={(e) => writeGfx({ fps: Number(e.target.value) })}>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={120}>120</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            Görüntü
            <select className="rounded-md border border-border bg-bg px-2 py-1" value={gfx.quality} onChange={(e) => writeGfx({ quality: Number(e.target.value), auto: false })}>
              <option value={0.7}>Düşük</option>
              <option value={1}>Orta</option>
              <option value={1.25}>Yüksek</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            Otomatik grafik
            <input type="checkbox" checked={gfx.auto} onChange={(e) => writeGfx({ auto: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between gap-2">
            Ses
            <input type="range" min={0} max={1} step={0.05} value={gfx.volume} onChange={(e) => writeGfx({ volume: Number(e.target.value) })} />
          </label>
          <button type="button" className="rounded-md border border-border px-3 py-1.5 text-left" onClick={onClose}>
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}

function PartyWindow() {
  const snap = useSyncExternalStore(subscribeTarget, targetSnapshot, targetSnapshot);
  const nick = useRpg((s) => s.nick);
  const level = useRpg((s) => s.level);
  if (!snap.party.length) return null;
  const rows = [{ id: "me", nick: `${nick} (sen)`, level }, ...snap.party];
  return (
    <div data-ui className="hud-party pointer-events-auto absolute z-20 rounded-lg border border-border bg-surface/95 p-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs tracking-wide text-gold">Guruptakiler</p>
        <button type="button" className="rounded border border-border px-1 text-[10px]" onClick={() => leaveParty()}>
          Ayrıl
        </button>
      </div>
      {rows.map((mate) => (
        <p key={mate.id + mate.nick} className="truncate text-xs text-fg">
          {mate.nick} <span className="text-muted">Sv.{mate.level}</span>
        </p>
      ))}
    </div>
  );
}

function FriendsWindow({ onClose }: { onClose: () => void }) {
  const snap = useSyncExternalStore(subscribeTarget, targetSnapshot, targetSnapshot);
  return (
    <div data-ui className="hud-friends pointer-events-auto absolute right-4 bottom-40 z-20 w-[min(18rem,86vw)] rounded-lg border border-border bg-surface/95 p-2 md:bottom-24">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs tracking-wide text-gold">Arkadaşlar</p>
        <button type="button" className="text-xs text-muted" onClick={onClose}>
          Kapat
        </button>
      </div>
      {snap.friends.length === 0 ? <p className="text-xs text-muted">Henüz dost yok</p> : null}
      {snap.friends.map((mate) => (
        <div key={mate.id} className="mt-1 flex items-center justify-between gap-1">
          <p className="min-w-0 truncate text-xs text-fg">
            {mate.nick} <span className="text-muted">Sv.{mate.level}</span>
          </p>
          <span className="flex shrink-0 gap-1">
            <button type="button" className="rounded border border-border px-1 text-[10px]" onClick={() => setWhisper({ id: mate.id, nick: mate.nick })}>
              Fısıltı
            </button>
            <button type="button" className="rounded border border-border px-1 text-[10px]" onClick={() => removeFriend(mate.id)}>
              Sil
            </button>
            <button type="button" className="rounded border border-border px-1 text-[10px] text-hp" onClick={() => blockMate(mate)}>
              Engelle
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function WorldMap({ zone, big, onToggle }: { zone: string; big: boolean; onToggle: () => void }) {
  const [sim, setSim] = useState(() => readSim());
  const [blink, setBlink] = useState(0);
  const [coords, setCoords] = useState(false);
  const [mark, setMark] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    const sync = () => setView({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);
  const realm = realmAt(sim.x, sim.z);
  useEffect(() => {
    let frame = 0;
    let lastBlink = 0;
    const loop = (t: number) => {
      const next = readSim();
      setSim((prev) =>
        Math.abs(prev.x - next.x) < 0.08 && Math.abs(prev.z - next.z) < 0.08 && Math.abs(prev.yaw - next.yaw) < 0.03 ? prev : next,
      );
      if (t - lastBlink > 90) {
        lastBlink = t;
        setBlink(t);
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const bound = realm.id === "koy" ? VILLAGE_BOUND : DUNGEON_BOUND;
  const anchor = hudAnchors(view.w, view.h);
  const side = Math.min(view.w, view.h);
  const size = Math.round(side * (big ? Math.min(0.62, anchor.mapS * 2.6) : anchor.mapS));
  const half = bound + 14;
  const lx = sim.x - realm.x;
  const lz = sim.z - realm.z;
  const px = ((lx / half) * 0.5 + 0.5) * size;
  const py = ((lz / half) * 0.5 + 0.5) * size;
  const deg = (Math.atan2(-Math.sin(sim.yaw), Math.cos(sim.yaw)) * 180) / Math.PI;
  const guide = questGuide(sim.x, sim.z);
  const spots = [
    ...MAP_MARKS.filter((spot) => Math.hypot(spot.x - realm.x, spot.z - realm.z) < bound),
    ...(realm.id === "koy"
      ? []
      : [
          { name: "Görevli", ...realmHerald(realm.id) },
          { name: "Işınlayıcı", ...realmGate(realm.id) },
        ]),
  ];
  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const s = size;
    canvas.width = s;
    canvas.height = s;
    g.fillStyle = "#141816";
    g.fillRect(0, 0, s, s);
    const cx = s / 2;
    const cy = s / 2;
    const k = s / (half * 2);
    const fill = realm.id === "dolunay" ? "#3d4e62" : realm.id === "ay" ? "#2c2638" : realm.id === "koy2" ? "#5d6e48" : "#6d7c58";
    g.beginPath();
    g.arc(cx, cy, bound * k, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = Math.max(2, 3.2 * k);
    g.strokeStyle = "#d9d0c2";
    g.stroke();
    if (realm.id === "koy") {
      g.beginPath();
      g.arc(cx, cy, 16.5 * k, 0, Math.PI * 2);
      g.fillStyle = "#c8c1b4";
      g.fill();
      g.fillStyle = "#5a5148";
      for (const h of HOUSES) {
        g.fillRect(cx + (h.x - h.w / 2) * k, cy + (h.z - h.d / 2) * k, Math.max(2, h.w * k), Math.max(2, h.d * k));
      }
      g.strokeStyle = "#d7c4a4";
      g.lineWidth = Math.max(1.5, 4.2 * k);
      g.beginPath();
      g.moveTo(cx, cy - 80 * k);
      g.lineTo(cx, cy - 16 * k);
      g.moveTo(cx, cy + 16 * k);
      g.lineTo(cx, cy + 80 * k);
      g.moveTo(cx - 80 * k, cy);
      g.lineTo(cx - 16 * k, cy);
      g.moveTo(cx + 16 * k, cy);
      g.lineTo(cx + 80 * k, cy);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, 80 * k, 0, Math.PI * 2);
      g.strokeStyle = "#c4a574";
      g.lineWidth = Math.max(1, 1.6 * k);
      g.stroke();
    }
    g.fillStyle = "#e6c36a";
    for (const spot of spots) {
      g.beginPath();
      g.arc(cx + (spot.x - realm.x) * k, cy + (spot.z - realm.z) * k, Math.max(2.2, 2.4 * (s / 148)), 0, Math.PI * 2);
      g.fill();
    }
    if (guide) {
      const gx = cx + (guide.x - realm.x) * k;
      const gz = cy + (guide.z - realm.z) * k;
      const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(blink / 180));
      g.beginPath();
      g.arc(gx, gz, 5 + pulse * 7, 0, Math.PI * 2);
      g.fillStyle = `rgba(255, 92, 58, ${0.22 + pulse * 0.28})`;
      g.fill();
      g.beginPath();
      g.arc(gx, gz, 3.4, 0, Math.PI * 2);
      g.fillStyle = "#ffd27a";
      g.fill();
    }
  }, [size, sim.x, sim.z, blink, realm.id, half, bound, guide, spots]);
  return (
    <div data-ui className={big ? "hud-map is-big pointer-events-auto absolute left-1/2 z-30 -translate-x-1/2" : "hud-map pointer-events-auto absolute z-20"}>
      <button type="button" className="block" onClick={onToggle} aria-label="Harita">
        <span className="relative block overflow-hidden rounded-lg border border-border" style={{ width: size, height: size }}>
          <canvas ref={canvasRef} className="block h-full w-full" />
          <span
            className="absolute z-10 h-0 w-0"
            style={{
              left: px,
              top: py,
              transform: `translate(-50%, -50%) rotate(${deg}deg)`,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderBottom: "11px solid #7eb6ff",
            }}
            onMouseEnter={(e) => {
              e.stopPropagation();
              setCoords(true);
            }}
            onMouseLeave={() => setCoords(false)}
          />
          {spots.map((spot) => {
            const left = (((spot.x - realm.x) / half) * 0.5 + 0.5) * size;
            const top = (((spot.z - realm.z) / half) * 0.5 + 0.5) * size;
            return (
              <span
                key={spot.name}
                className="absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2"
                style={{ left, top }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setMark(spot.name);
                }}
                onMouseLeave={() => setMark(null)}
                onPointerDown={(e) => e.stopPropagation()}
              />
            );
          })}
          {mark ? (
            <span className="absolute top-1 left-1 z-20 rounded bg-bg/90 px-1 text-[10px] text-gold">{mark}</span>
          ) : null}
          {coords ? (
            <span className="absolute bottom-1 left-1 rounded bg-bg/90 px-1 text-[10px] text-fg">
              X {sim.x.toFixed(0)} Z {sim.z.toFixed(0)}
            </span>
          ) : null}
        </span>
      </button>
      <p className="mt-1 rounded-md border border-border bg-surface/90 px-2 py-1 text-center text-xs text-gold">{zone}</p>
    </div>
  );
}

function Prompt() {
  const near = useRpg((s) => s.near);
  const vein = useRpg((s) => s.vein);
  const weaponId = useRpg((s) => s.equipped.weapon?.id);
  const chore = useRpg((s) => s.chore);
  const steed = useRpg((s) => s.steed);
  const riding = useRpg((s) => s.riding);
  const hint = useSyncExternalStore(subscribeField, lootHint, lootHint);
  const cls = "hud-prompt absolute bottom-[18%] left-1/2 -translate-x-1/2 rounded-lg border border-border bg-surface/90 px-3 py-2 text-sm text-fg";
  if (chore) return null;
  if (hint) return <p className={cls}>{hint}</p>;
  const style = weaponStyleOf(weaponId);
  if (near === "vein") {
    if (style !== "kazma") return <p className={cls}>Kazmak için kazma giymelisin</p>;
    if (!vein) return <p className={cls}>Taşı seç</p>;
    const here = readSim();
    if (Math.hypot(here.x - vein.x, here.z - vein.z) > 2.3) return <p className={cls}>Seçtiğin taşa yaklaş</p>;
    return <p className={cls}>Space — kaz</p>;
  }
  if (near === "fish") {
    if (style !== "olta") return <p className={cls}>Oltayı kuşan</p>;
    return <p className={cls}>Balık tut</p>;
  }
  if (steed) return <p className={cls}>{riding ? "H — attan in" : "H — ata bin"}</p>;
  return null;
}

function ToolHud() {
  const chore = useRpg((s) => s.chore);
  if (!chore) return null;
  if (chore.kind === "mine") {
    const pct = Math.max(0, Math.min(100, (chore.t / 10) * 100));
    return (
      <div className="absolute bottom-[22%] left-1/2 w-56 -translate-x-1/2">
        <p className="mb-1 text-center text-xs text-gold">Kazılıyor · {chore.given}/3 maden</p>
        <div className="h-2 overflow-hidden rounded-sm border border-border bg-bg">
          <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  if (chore.phase === "wait") {
    const pct = Math.max(0, Math.min(100, (chore.t / Math.max(0.2, chore.wait)) * 100));
    return (
      <div className="absolute bottom-[22%] left-1/2 w-56 -translate-x-1/2">
        <p className="mb-1 text-center text-xs text-gold">Balık Bekleniyor</p>
        <div className="h-2 overflow-hidden rounded-sm border border-border bg-bg">
          <div className="h-full bg-gold/70" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  const zoneLeft = Math.max(0, (chore.zone - chore.zoneW / 2) * 100);
  const zoneWidth = chore.zoneW * 100;
  return (
    <div className="absolute bottom-[22%] left-1/2 w-64 -translate-x-1/2">
      <p className="mb-1 text-center text-sm text-gold">Kancaya bir balık takıldı</p>
      <div className="relative h-3 overflow-hidden rounded-sm border border-border bg-bg">
        <div className="absolute top-0 h-full bg-gold/80" style={{ left: `${zoneLeft}%`, width: `${zoneWidth}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-fg" style={{ left: `${Math.max(0, Math.min(100, chore.needle * 100))}%` }} />
      </div>
    </div>
  );
}

function MobCardHud() {
  const snap = useSyncExternalStore(subscribeTarget, targetSnapshot, targetSnapshot);
  const card = snap.card;
  if (!card) return null;
  const pct = Math.max(0, Math.min(100, (card.hp / Math.max(1, card.hpMax)) * 100));
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-30 w-[min(22rem,92vw)] -translate-x-1/2 rounded-lg border border-border bg-surface/95 px-3 py-2 text-center text-fg">
      <p className="text-[10px] tracking-widest text-gold">Mob Bilgileri</p>
      <p className="font-display text-gold">{card.name}</p>
      <p className="text-xs">Sv.{card.level} · Can {Math.ceil(card.hp)}/{Math.ceil(card.hpMax)}</p>
      <div className="mx-auto mt-1 h-2 overflow-hidden rounded-sm border border-border bg-bg">
        <div className="h-full bg-hp" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted">Şansa bağlı düşenler: {card.drops.length ? card.drops.join(" · ") : "—"}</p>
    </div>
  );
}

function Toast() {
  const toast = useRpg((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => {
      if (useRpg.getState().toast === toast) useRpg.setState({ toast: "" });
    }, 2200);
    return () => window.clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  return <p className="absolute top-[22%] left-1/2 -translate-x-1/2 rounded-lg border border-gold bg-surface/95 px-3 py-2 text-sm text-fg">{toast}</p>;
}

function Hurt() {
  const hurt = useRpg((s) => s.hurt);
  if (hurt <= 0) return null;
  return <div className="absolute inset-0 bg-hp/25" style={{ opacity: hurt }} />;
}

function Panels() {
  const invOpen = useRpg((s) => s.invOpen);
  const charOpen = useRpg((s) => s.charOpen);
  const shop = useRpg((s) => s.shop);
  if (!invOpen && !charOpen && !shop) return null;
  return (
    <div className="pointer-events-none absolute inset-0" data-ui>
      {invOpen ? <Inventory /> : null}
      {shop === "smith" ? (
        <div className="shop-layer pointer-events-none absolute inset-0 grid place-items-center p-3">
          <SmithShop />
        </div>
      ) : null}
      {charOpen ? <Character /> : null}
      {shop && shop !== "smith" && shop !== "depot" && shop !== "guard" && shop !== "herald" && shop !== "gate" && shop !== "stall" && shop !== "bazaar" && shop !== "craft" ? (
        <div className="shop-layer pointer-events-none absolute inset-0 grid place-items-center p-3">
          <TradeShop kind={shop} />
        </div>
      ) : null}
      {shop === "bazaar" ? (
        <div className="shop-layer pointer-events-none absolute inset-0 grid place-items-center p-3">
          <BazaarShop />
        </div>
      ) : null}
      {shop === "craft" ? (
        <div className="shop-layer pointer-events-none absolute inset-0 grid place-items-center p-3">
          <CraftShop />
        </div>
      ) : null}
      {shop === "guard" || shop === "herald" ? (
        <div className="shop-layer pointer-events-none absolute inset-0 grid place-items-center p-3">
          <QuestBoard />
        </div>
      ) : null}
      {shop === "gate" ? (
        <div className="shop-layer pointer-events-none absolute inset-0 grid place-items-center p-3">
          <GateBoard />
        </div>
      ) : null}
      {shop === "stall" ? (
        <div className="shop-layer pointer-events-none absolute inset-0 grid place-items-center p-3">
          <StallShop />
        </div>
      ) : null}
      {shop === "depot" ? (
        <div className="shop-layer pointer-events-none absolute inset-0 grid place-items-center p-3">
          <DepotShop />
        </div>
      ) : null}
    </div>
  );
}

function Shell({ title, children, className, vendor = false }: { title: string; children: ReactNode; className?: string; vendor?: boolean }) {
  return (
    <section
      data-ui
      {...(vendor ? { "data-vendor": "" } : {})}
      className={`pointer-events-auto max-h-[78dvh] overflow-x-hidden overflow-y-auto break-words rounded-xl border border-border/80 bg-surface/95 p-3 text-fg hud-window ${className ?? "w-[min(26rem,92vw)]"}`}
      onPointerDown={(e) => e.stopPropagation()}
      onDragOver={vendor ? (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      } : undefined}
      onDrop={vendor ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        keepCarry = true;
        sellDragged(dragText(e.dataTransfer));
      } : undefined}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg text-gold">{title}</h2>
        <button type="button" className="rounded-md border border-border px-2 py-1 text-sm" onClick={() => useRpg.getState().closeShop()}>
          Kapat
        </button>
      </div>
      {children}
    </section>
  );
}

function Tip({ item, x, y }: { item: Item; x: number; y: number }) {
  const s = itemStats(item);
  const rows = [
    s.str ? `STR ${s.str}` : "",
    s.hp ? `HP ${s.hp}` : "",
    s.ats ? `ATS ${s.ats}` : "",
    s.mvs ? `MVS ${s.mvs}` : "",
    s.ctp ? `CTP ${s.ctp}%` : "",
  ].filter(Boolean);
  const sw = window.innerWidth;
  const sh = window.innerHeight;
  const left = Math.min(x + sw * 0.01, sw * 0.78);
  const top = Math.min(y + sh * 0.02, sh * 0.72);
  return createPortal(
    <div className="pointer-events-none fixed z-[80] w-[18vw] min-w-[9rem] max-w-[16rem] rounded-md border border-gold bg-bg/95 p-2 text-xs text-fg shadow-lg" style={{ left, top }}>
      <p className="text-sm text-gold">{displayName(item)}</p>
      <p className="text-muted">
        {SLOT_LABEL[item.slot] ?? "Eşya"} · Sv.{item.level}
        {item.plus > 0 ? ` · +${item.plus}` : ""}
      </p>
      {rows.length ? <p>{rows.join(" · ")}</p> : null}
      {item.count && item.count > 1 ? <p>Adet {item.count}</p> : null}
      {item.req ? <p className="text-muted">Gerekli seviye {item.req}</p> : null}
      {item.desc ? <p className="mt-1 text-muted">{item.desc}</p> : null}
      {item.enchants?.length ? (
        <div className="mt-1 border-t border-border pt-1">
          {item.enchants.map((row, i) => (
            <p key={`${row.name}-${i}`} className="text-gold">
              {row.name} {row.stat === "hp" || row.stat === "mana" ? `+${row.value}` : `%${row.value}`}
            </p>
          ))}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function ItemMark({ item }: { item: Item | null }) {
  if (!item) return null;
  const pala = item.id.includes("pala");
  const bow = item.id.includes("bow");
  const staff = item.id.includes("staff");
  const dagger = item.id.includes("dagger");
  return (
    <svg viewBox="0 0 24 24" className="mb-0.5 h-6 w-6 text-gold" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {pala ? (
        <path d="M12 2v16M9 18h6M12 18v4" />
      ) : bow ? (
        <path d="M8 4c7 4 7 12 0 16M8 4c3 5 3 11 0 16" />
      ) : staff ? (
        <path d="M12 3v18M12 6l3 2M12 6l-3 2" />
      ) : dagger ? (
        <path d="M12 3l2 8h-4l2-8zM10 13h4v6h-4z" />
      ) : item.slot === "weapon" ? (
        <path d="M12 3v12M9 15h6M12 15v6" />
      ) : item.slot === "armor" ? (
        <path d="M6 6h12l-1 13H7L6 6z" />
      ) : item.slot === "helmet" ? (
        <path d="M6 14a6 6 0 0 1 12 0v3H6z" />
      ) : item.slot === "boots" ? (
        <path d="M8 4h5v9H7l-1 5h11" />
      ) : item.slot === "gloves" ? (
        <path d="M8 15V7m3 8V5m3 10V7m3 8v-5" />
      ) : (
        <circle cx="12" cy="12" r="4" />
      )}
    </svg>
  );
}

const PAPER: { slot: EquipSlot; area: string }[] = [
  { slot: "weapon", area: "1 / 1 / 3 / 2" },
  { slot: "helmet", area: "1 / 2 / 2 / 3" },
  { slot: "earring", area: "1 / 3 / 2 / 4" },
  { slot: "necklace", area: "1 / 4 / 2 / 5" },
  { slot: "armor", area: "1 / 5 / 2 / 6" },
  { slot: "gloves", area: "2 / 2 / 3 / 3" },
  { slot: "bracelet", area: "2 / 3 / 3 / 4" },
  { slot: "ring", area: "2 / 4 / 3 / 5" },
  { slot: "belt", area: "2 / 5 / 3 / 6" },
  { slot: "boots", area: "3 / 3 / 4 / 4" },
];

const invPin = new HudAnchor("top-center", 0, 0.08);

type HudAsk = { text: string; yes: () => void; no?: () => void };
let pushAsk: ((ask: HudAsk) => void) | null = null;
function openAsk(text: string, yes: () => void, no?: () => void) {
  pushAsk?.({ text, yes, no });
}

function CenterAsk() {
  const [ask, setAsk] = useState<HudAsk | null>(null);
  useEffect(() => {
    pushAsk = setAsk;
    return () => {
      if (pushAsk === setAsk) pushAsk = null;
    };
  }, []);
  if (!ask) return null;
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[80] grid place-items-center bg-black/55 p-4"
      data-ui
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-[min(22rem,88vw)] rounded-xl border border-gold bg-surface p-4 text-center text-fg">
        <p className="whitespace-pre-line text-sm leading-snug">{ask.text}</p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            className="rounded-md border border-gold px-4 py-2 text-sm text-gold"
            onClick={() => {
              const run = ask.yes;
              setAsk(null);
              run();
            }}
          >
            Evet
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm"
            onClick={() => {
              const run = ask.no;
              setAsk(null);
              run?.();
            }}
          >
            Hayır
          </button>
        </div>
      </div>
    </div>
  );
}

function Inventory({ docked = false }: { docked?: boolean }) {
  const bag = useRpg((s) => s.bag);
  const equipped = useRpg((s) => s.equipped);
  const gold = useRpg((s) => s.gold);
  const bagStage = useRpg((s) => s.bagStage);
  const open = openBagCount(bagStage);
  const [page, setPage] = useState(0);
  const [tip, setTip] = useState<{ item: Item; x: number; y: number } | null>(null);
  const [pos, setPos] = useState(() => {
    const w = typeof window === "undefined" ? 1280 : window.innerWidth;
    const h = typeof window === "undefined" ? 800 : window.innerHeight;
    const placed = placeWindow(invPin, w, h);
    return { x: placed.x, y: placed.y };
  });
  useEffect(() => {
    const fit = () => {
      const placed = placeWindow(invPin, window.innerWidth, window.innerHeight);
      setPos({ x: placed.x, y: placed.y });
    };
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, []);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const show = (item: Item | null, ev: MouseEvent) => {
    if (!item) return;
    setTip({ item, x: ev.clientX, y: ev.clientY });
  };
  const move = (clientX: number, clientY: number) => {
    if (!drag.current) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const placed = placeWindow(invPin, w, h);
    const next = {
      x: Math.max(w * 0.01, Math.min(w - placed.boxW, clientX - drag.current.dx)),
      y: Math.max(h * 0.01, Math.min(h * 0.9, clientY - drag.current.dy)),
    };
    invPin.stick(next.x, next.y, w, h, placed.boxW, 0);
    setPos(next);
  };
  const start = page * PAGE_SIZE;
  const release = (index: number, event: DragEvent<HTMLButtonElement>) => {
    const panel = (event.currentTarget as HTMLElement).closest("[data-inv]");
    const rect = panel?.getBoundingClientRect();
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const ontoSmith = Boolean(under?.closest("[data-smith]"));
    const ontoVendor = Boolean(under?.closest("[data-vendor]"));
    const outside = !!rect && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
    if (ontoVendor) {
      keepCarry = true;
      sellDragged(dragText(event.dataTransfer));
    }
    if (outside && !keepCarry && !ontoSmith && !ontoVendor) {
      openAsk("Eşyayı yere atmak istiyor musunuz?", () => dropBag(index));
    }
    keepCarry = false;
    dragSold = false;
    setCarry(null);
  };
  return (
    <section
      data-ui
      data-inv
      className={`inv-sheet hud-window pointer-events-auto overflow-x-hidden overflow-y-auto break-words p-3 text-fg ${docked ? "relative" : "absolute"}`}
      style={docked ? undefined : { left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="mb-3 flex cursor-grab items-center justify-between active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => move(e.clientX, e.clientY)}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <h2 className="font-display text-lg text-gold">Envanter</h2>
        <button type="button" className="rounded-md border border-border px-2 py-1 text-sm" onClick={() => useRpg.setState({ invOpen: false })}>
          Kapat
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <div className="equip-board">
          {PAPER.map(({ slot, area }) => {
            const it = equipped[slot];
            return (
              <button
                key={slot}
                type="button"
                draggable={!!it}
                style={{ gridArea: area }}
                className={`octo-slot ${slot === "weapon" ? "is-tall" : ""}`}
                onMouseEnter={(e) => show(it, e)}
                onMouseMove={(e) => show(it, e)}
                onMouseLeave={() => setTip(null)}
                onClick={() => it && useRpg.getState().unequip(slot)}
                onDragStart={(e) => {
                  setCarry({ kind: "slot", slot });
                  e.dataTransfer.setData("text/plain", `slot:${slot}`);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={(e) => {
                  const under = document.elementFromPoint(e.clientX, e.clientY);
                  if (under?.closest("[data-vendor]")) {
                    keepCarry = true;
                    sellDragged(dragText(e.dataTransfer));
                  }
                  dragSold = false;
                  keepCarry = false;
                  setCarry(null);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const token = readCarry();
                  const raw = e.dataTransfer.getData("text/plain");
                  const index = token?.kind === "bag" ? token.index : raw.startsWith("bag:") ? Number(raw.slice(4)) : -1;
                  if (index >= 0) useRpg.getState().equipFromBag(index);
                  setCarry(null);
                }}
              >
                <ItemMark item={it} />
                <span className="block text-muted">{SLOT_LABEL[slot]}</span>
                <span className="block truncate">{it ? displayName(it) : "—"}</span>
              </button>
            );
          })}
        </div>
        <div>
          <div className="mb-1.5 flex gap-1">
            {[0, 1, 2].map((n) => (
              <button
                key={n}
                type="button"
                className={n === page ? "bag-tab is-on" : "bag-tab"}
                onClick={() => setPage(n)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const token = readCarry();
                  const raw = e.dataTransfer.getData("text/plain");
                  if (token?.kind === "bag" || raw.startsWith("bag:")) {
                    const from = token?.kind === "bag" ? token.index : Number(raw.slice(4));
                    useRpg.getState().moveToPage(from, n);
                  } else if (token?.kind === "slot" || raw.startsWith("slot:")) {
                    const slot = token?.kind === "slot" ? token.slot : (raw.slice(5) as EquipSlot);
                    const start = n * PAGE_SIZE;
                    const bagNow = useRpg.getState().bag;
                    let dest = -1;
                    for (let i = 0; i < PAGE_SIZE; i++) {
                      if (bagNow[start + i] == null) {
                        dest = start + i;
                        break;
                      }
                    }
                    if (dest >= 0) useRpg.getState().placeEquip(slot, dest);
                    else useRpg.setState({ toast: "Bu pencere dolu" });
                  }
                  setCarry(null);
                  setPage(n);
                }}
              >
                {["I", "II", "III"][n]}
              </button>
            ))}
          </div>
          <div className="bag-grid">
            {Array.from({ length: PAGE_SIZE }, (_, i) => {
              const index = start + i;
              const it = bag[index] ?? null;
              const locked = index >= open;
              return (
                <button
                  key={index}
                  type="button"
                  draggable={!!it && !locked}
                  className={locked ? "octo-slot is-lock" : "octo-slot"}
                  onMouseEnter={(e) => show(it, e)}
                  onMouseMove={(e) => show(it, e)}
                  onMouseLeave={() => setTip(null)}
                  onClick={() => {
                    if (locked) useRpg.setState({ toast: "Envanter Genişletme ile açılır" });
                    else if (it && (it.id === "kazma" || it.id === "olta")) useRpg.getState().equipFromBag(index);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (locked || !it) return;
                    useRpg.getState().equipFromBag(index);
                  }}
                  onDragStart={(e) => {
                    setCarry({ kind: "bag", index });
                    e.dataTransfer.setData("text/plain", `bag:${index}`);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={(e) => release(index, e)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const token = readCarry();
                    const raw = e.dataTransfer.getData("text/plain");
                    if (token?.kind === "smith" || raw.startsWith("smith:")) {
                      const which = token?.kind === "smith" ? token.which : raw.slice(6);
                      useRpg.getState().takeSmith(which, locked ? null : index);
                      setCarry(null);
                      return;
                    }
                    const from = token?.kind === "bag" ? token.index : raw.startsWith("bag:") ? Number(raw.slice(4)) : -1;
                    const carried = from >= 0 ? useRpg.getState().bag[from] : null;
                    if (carried && (carried.id === "mistik-efsun" || carried.id === "mistik-degistirici") && it) {
                      useRpg.getState().imbue(from, index);
                      setCarry(null);
                      return;
                    }
                    if (locked) {
                      const item = from >= 0 ? useRpg.getState().bag[from] : null;
                      if (item?.id === "bag-expand") useRpg.getState().useBagItem(from);
                      else useRpg.setState({ toast: "Kilitli yuvaya Envanter Genişletme sürükle" });
                      setCarry(null);
                      return;
                    }
                    if (token?.kind === "bag" || raw.startsWith("bag:")) {
                      const from = token?.kind === "bag" ? token.index : Number(raw.slice(4));
                      useRpg.getState().swapBag(from, index);
                    } else if (token?.kind === "slot" || raw.startsWith("slot:")) {
                      const slot = token?.kind === "slot" ? token.slot : (raw.slice(5) as EquipSlot);
                      useRpg.getState().placeEquip(slot, index);
                    }
                    setCarry(null);
                  }}
                >
                  {locked ? (
                    <span>Kilit</span>
                  ) : it ? (
                    <>
                      <ItemMark item={it} />
                      <span className="truncate">{displayName(it)}{it.count && it.count > 1 ? ` x${it.count}` : ""}</span>
                    </>
                  ) : (
                    ""
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-3 border-t border-border pt-2 text-right text-sm text-gold">{gold} Altın</p>
      <p className="mt-1 text-[11px] text-muted">Sağ tık kuşanır. Dükkan penceresine bırakınca satılır. Boş yere bırakınca yere atma sorulur.</p>
      {tip ? <Tip item={tip.item} x={tip.x} y={tip.y} /> : null}
    </section>
  );
}

const charPin = new HudAnchor("top-left", 0.02, 0.16);

function Character() {
  const level = useRpg((s) => s.level);
  const xp = useRpg((s) => s.xp);
  const xpTo = useRpg((s) => s.xpTo);
  const unspent = useRpg((s) => s.unspent);
  const base = useRpg((s) => s.base);
  const invested = useRpg((s) => s.invested);
  const equipped = useRpg((s) => s.equipped);
  const skills = useRpg((s) => s.skills);
  const skillPoints = useRpg((s) => s.skillPoints);
  const chosenTree = useRpg((s) => s.chosenTree);
  const charTab = useRpg((s) => s.charTab);
  const quests = useRpg((s) => s.quests);
  const classId = useRpg((s) => s.classId);
  const totals = sumStats({ base, invested, equipped, level, skills });
  const [pos, setPos] = useState(() => charPin.place(typeof window === "undefined" ? 1280 : window.innerWidth, typeof window === "undefined" ? 800 : window.innerHeight));
  useEffect(() => {
    const fit = () => setPos(charPin.place(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, []);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const move = (clientX: number, clientY: number) => {
    if (!drag.current) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const wide = charTab === "skills" && !useRpg.getState().chosenTree;
    const placed = placeWindow(charPin, w, h, wide);
    const next = {
      x: Math.max(w * 0.01, Math.min(w - placed.boxW, clientX - drag.current.dx)),
      y: Math.max(h * 0.01, Math.min(h * 0.88, clientY - drag.current.dy)),
    };
    charPin.stick(next.x, next.y, w, h);
    setPos(next);
  };
  const trees = CLASS_TREES[classId];
  const tabs: CharTab[] = ["stats", "skills", "quests"];
  return (
    <section
      data-ui
      className={`hud-window pointer-events-auto absolute overflow-x-hidden overflow-y-auto rounded-xl border border-border/80 bg-surface/95 p-3 text-fg ${charTab === "skills" && !chosenTree ? "skill-wide" : ""}`}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="mb-3 flex cursor-grab items-center justify-between active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => move(e.clientX, e.clientY)}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <p className="font-display text-lg text-gold">{charTab === "stats" ? "Statü" : charTab === "skills" ? "Yetenek" : "Görevler"}</p>
        <button type="button" className="text-xs text-muted" onClick={() => useRpg.setState({ charOpen: false })}>
          Kapat
        </button>
      </div>
      {charTab === "stats" ? (
        <p className="mb-3 text-xs text-muted">
          {className(classId)} · Sv. {level} · {Math.floor(xp)}/{xpTo} · Puan {unspent}
        </p>
      ) : charTab === "skills" ? (
        <p className="mb-3 text-xs text-muted">{level < 5 ? "Yetenekler 5. seviyede açılır." : `Yetenek puanı ${skillPoints}`}</p>
      ) : null}
      {charTab === "quests" ? (
        <div className="flex flex-col gap-2">
          {quests.filter((quest) => !quest.claimed).length === 0 ? <p className="text-xs text-muted">Görevler ilerledikçe kendiliğinden açılır.</p> : null}
          {quests.filter((quest) => !quest.claimed).map((quest) => (
            <div key={quest.id} className="rounded-md border border-border bg-bg/70 px-2 py-1.5 text-xs">
              <p className="text-gold">{quest.title}{quest.minLevel ? ` · Sv.${quest.minLevel}` : ""}</p>
              <p className="text-muted">{quest.detail}</p>
              <p>{quest.done ? "Muhafıza dön, ödülü al" : `${Math.min(quest.have, quest.need)}/${quest.need}`}</p>
            </div>
          ))}
        </div>
      ) : charTab === "skills" ? (
        <div className={chosenTree ? "skill-board grid min-w-0 grid-cols-1 items-start gap-3" : "skill-board grid min-w-0 grid-cols-2 items-start gap-3"}>
          {trees.map((tree, index) => {
            const key = `${classId}:${index}`;
            if (chosenTree && chosenTree !== key) return null;
            return (
              <div key={tree.name}>
                <p className="mb-1 text-xs text-gold">{tree.name}{chosenTree === key ? " · seçili" : ""}</p>
                <div className="flex flex-col gap-1">
                  {tree.skills.map((sk) => {
                    const rank = skills[sk.id] ?? 0;
                    const preview = skillPreview(sk.id, rank, totals);
                    const tip = preview.buff
                      ? `${sk.desc} Seviye ${skillTier(rank)}`
                      : `${sk.desc} Hasar ${preview.dmg}. Sonraki ${preview.next}.`;
                    return (
                      <div
                        key={sk.id}
                        draggable={rank > 0}
                        title={tip}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", `skill:${sk.id}`);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-border bg-bg/70 px-2 py-1.5 text-xs"
                      >
                        <SkillMark id={sk.id} />
                        <span className="min-w-0">
                          {sk.name}
                          <span className="block text-[10px] text-muted">{tip}</span>
                        </span>
                        <b className="tabular-nums text-gold">{skillTier(rank)}</b>
                        <button
                          type="button"
                          disabled={level < 5 || skillPoints <= 0 || rank >= SKILL_MAX}
                          className="h-7 w-7 rounded-md border border-border text-gold disabled:opacity-30"
                          onClick={() => useRpg.getState().learnSkill(sk.id)}
                        >
                          +
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className={chosenTree ? "text-[11px] text-muted" : "col-span-2 text-[11px] text-muted"}>İlk + bir ağacı kilitler. Öğrenileni alt çubuğa sürükle.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {(["str", "mag", "hp", "mana", "ats", "mvs"] as StatKey[]).map((key) => (
            <div key={key} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 text-sm" title={STAT_HINT[key]}>
              <StatMark stat={key} />
              <span className="min-w-0 truncate text-fg/90">{STAT_LABEL[key]}</span>
              <b className="tabular-nums" title="Toplam">{totals[key]}</b>
              <b className="w-8 rounded border border-border text-center text-xs tabular-nums text-gold" title="Bu statüye verilen puan">{invested[key] ?? 0}</b>
              <button type="button" disabled={unspent <= 0 || (invested[key] ?? 0) >= 90} className="h-7 w-7 rounded-md border border-border text-gold disabled:opacity-30" onClick={() => useRpg.getState().spend(key)}>
                +
              </button>
            </div>
          ))}
          <p className="text-[11px] text-muted">Verilen toplam {Object.values(invested).reduce((sum, n) => sum + (n || 0), 0)} · her statü en fazla 90 · seviye tavanı 99</p>
        </div>
      )}
      <div className="mt-3 flex gap-1 border-t border-border pt-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={charTab === tab ? "rounded-md border border-gold px-2 py-1 text-xs text-gold" : "rounded-md border border-border px-2 py-1 text-xs text-muted"}
            onClick={() => useRpg.setState({ charTab: tab, charOpen: true })}
          >
            {tab === "stats" ? "Statü" : tab === "skills" ? "Yetenekler" : "Görevler"}
          </button>
        ))}
      </div>
    </section>
  );
}

function skillWaitLabel(id: string, rank: number) {
  const left = skillCdLeft(id);
  if (left > 0.05) return `${left.toFixed(1)} sn`;
  return rank > 0 ? "hazır" : "—";
}

function SkillMark({ id }: { id: string }) {
  const n = id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const hue = n % 360;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="1" y="1" width="20" height="20" rx="4" fill={`hsl(${hue} 28% 18%)`} stroke={`hsl(${hue} 42% 62%)`} />
      <path d={n % 2 ? "M11 4 L16 16 L6 16 Z" : "M5 11 h12 M11 5 v12"} stroke={`hsl(${hue} 55% 72%)`} strokeWidth="1.6" fill="none" />
    </svg>
  );
}

function StatMark({ stat }: { stat: StatKey }) {
  const glyph = stat === "str" ? "⚔" : stat === "mag" ? "✶" : stat === "hp" ? "♥" : stat === "mana" ? "✦" : stat === "ats" ? "»" : "→";
  return <span className="grid h-6 w-6 place-items-center rounded-md border border-gold/50 text-[11px] text-gold">{glyph}</span>;
}

function shopRows(kind: ShopKind, classId: ReturnType<typeof useRpg.getState>["classId"]) {
  return CATALOG.filter((row) => {
    if (!("shop" in row) || row.shop !== kind) return false;
    return true;
  });
}

const TABS: Record<string, { id: string; label: string; test: (id: string, slot: string) => boolean }[]> = {
  weapon: [{ id: "silah", label: "Silahlar", test: () => true }],
  armor: [
    { id: "zirh", label: "Zırh", test: (_id, slot) => slot === "armor" || slot === "helmet" || slot === "boots" || slot === "gloves" || slot === "belt" },
    { id: "taki", label: "Takı", test: (_id, slot) => slot === "earring" || slot === "necklace" || slot === "bracelet" || slot === "ring" },
  ],
  market: [
    { id: "iksir", label: "İksir", test: (id) => id.startsWith("pot-") },
    { id: "diger", label: "Diğer", test: (id) => !id.startsWith("pot-") },
  ],
  stable: [{ id: "binek", label: "Binek", test: () => true }],
  fisher: [{ id: "olta", label: "Olta", test: () => true }],
  miner: [{ id: "kazma", label: "Kazma", test: () => true }],
};

const SHOP_TITLE: Record<string, string> = {
  market: "Satıcı",
  armor: "Zırhçı",
  weapon: "Silahçı",
  stable: "Seyis",
  fisher: "Balıkçı",
  miner: "Madenci",
};

function QuestBoard() {
  const quests = useRpg((s) => s.quests);
  const shop = useRpg((s) => s.shop);
  const mentor = useRpg((s) => s.mentor);
  const map = shop === "herald" ? mentor || "koy2" : "koy";
  const realm = REALMS.find((row) => row.id === map);
  const open = quests.find((quest) => !quest.claimed && (quest.map === map || quest.map == null));
  return (
    <Shell title={realm?.name ?? "Görev"} className="w-[min(24rem,92vw)]">
      {open?.done ? (
        <div className="rounded-md border border-border bg-bg p-2 text-sm break-words">
          <p className="text-gold">{open.title}</p>
          <p className="text-muted">{open.detail}</p>
          <button type="button" className="mt-2 rounded-md border border-gold px-3 py-2 text-gold" onClick={() => useRpg.getState().claimQuest()}>
            Görevi tamamla
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">Teslim edilecek görev yok. Görevler ilerledikçe kendiliğinden verilir.</p>
      )}
    </Shell>
  );
}

function GateBoard() {
  const here = readSim();
  const gold = useRpg((s) => s.gold);
  const realm = realmAt(here.x, here.z);
  return (
    <Shell title="Işınlayıcı" className="w-[min(24rem,92vw)]">
      <p className="mb-2 text-xs text-muted">Şu an: {realm.name} · {gold} altın</p>
      <div className="flex flex-col gap-2">
        {REALMS.map((row) => (
          <button
            key={row.id}
            type="button"
            className="rounded-md border border-border px-3 py-2 text-left text-sm disabled:opacity-40"
            disabled={row.id === realm.id}
            onClick={() =>
              openAsk(`Bu map için ${GATE_COST[row.id]} Gold harcamanız gerekiyor, emin misiniz?`, () => {
                useRpg.getState().travel(row.id);
              })
            }
          >
            <span className="text-gold">{row.name}</span>
            <span className="ml-2 text-muted">
              Sv.{row.min}–{row.max} · {GATE_COST[row.id]} altın
            </span>
          </button>
        ))}
      </div>
    </Shell>
  );
}

function StallShop() {
  const stall = useRpg((s) => s.stall) ?? [];
  const [price, setPrice] = useState("100");
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <Shell title="Pazar" className="w-[min(28rem,96vw)]">
      <p className="mb-2 text-xs text-muted">Envanterden eşyayı buraya sürükle, fiyatı kendin yaz. Tezgah karakterinin yanında durur. Bir süre sonra bir gezgin en ucuz ilanı satın alır.</p>
      <div
        className="mb-2 min-h-16 rounded-md border border-dashed border-border bg-bg p-2 text-sm"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const token = readCarry();
          const raw = e.dataTransfer.getData("text/plain");
          const from = token?.kind === "bag" ? token.index : raw.startsWith("bag:") ? Number(raw.slice(4)) : -1;
          if (from >= 0) useRpg.getState().listStall(from, Number(price));
          setCarry(null);
        }}
      >
        Eşyayı buraya bırak
      </div>
      <label className="mb-2 flex items-center gap-2 text-sm">
        Fiyat
        <input className="w-24 rounded-md border border-border bg-bg px-2 py-1" value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button type="button" className="rounded-md border border-gold px-3 py-2 text-sm text-gold" onClick={() => setPrice(price)}>
          Satışa koy
        </button>
        <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => { setCarry(null); setPicked(null); }}>
          İptal
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {stall.map((row) => (
          <div key={row.uid}>
            <button type="button" className="w-full rounded-md border border-border px-2 py-2 text-left text-sm" onClick={() => setPicked(picked === row.uid ? null : row.uid)}>
              {row.item.name} · {row.price} altın
            </button>
            {picked === row.uid ? (
              <div className="mt-1 flex gap-2">
                <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => setPicked(null)}>
                  İptal
                </button>
                <button type="button" className="rounded-md border border-gold px-2 py-1 text-xs text-gold" onClick={() => { useRpg.getState().unlistStall(row.uid); setPicked(null); }}>
                  Satıştan kaldır
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Shell>
  );
}

function DeathCard() {
  const down = useRpg((s) => s.down);
  if (!down) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/55 p-4" data-ui>
      <div className="w-[min(24rem,92vw)] rounded-xl border border-border bg-surface p-4 text-center">
        <p className="font-display text-lg text-gold">Yendin</p>
        <p className="mt-1 text-sm text-muted">Burada başlarsan canın sıfırdan yavaş dolar. Köyde başlarsan bu haritanın girişine dönersin.</p>
        <div className="mt-3 flex justify-center gap-2">
          <button type="button" className="rounded-md border border-gold px-3 py-2 text-sm text-gold" onClick={() => useRpg.getState().reviveHere()}>
            Burada Başla
          </button>
          <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => useRpg.getState().reviveTown()}>
            Köyde Başla
          </button>
        </div>
      </div>
    </div>
  );
}

function MapLoad() {
  const name = useRpg((s) => s.mapLoad);
  const [pct, setPct] = useState(8);
  useEffect(() => {
    if (!name) return;
    setPct(8);
    const timer = window.setInterval(() => setPct((value) => Math.min(100, value + 7)), 90);
    return () => window.clearInterval(timer);
  }, [name]);
  if (!name) return null;
  return (
    <div className="absolute inset-0 z-50 bg-black" data-ui>
      <img src="/boot.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-[12%] flex flex-col items-center px-6">
        <p className="mb-1 text-sm text-[#e7fdff]">{name} yükleniyor</p>
        <p className="mb-1.5 text-[13px] font-semibold text-[#e7fdff]">{Math.min(100, pct)}%</p>
        <div className="h-3.5 w-[min(28rem,70vw)] overflow-hidden rounded-full border-2 border-[#3ad4e4] bg-black/75 p-px">
          <div className="h-full rounded-full bg-[#3ad4e4]" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>
    </div>
  );
}

function BazaarShop() {
  const gold = useRpg((s) => s.gold);
  const stall = useRpg((s) => s.stall) ?? [];
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState("hepsi");
  const [tip, setTip] = useState<{ item: Item; x: number; y: number } | null>(null);
  const q = query.trim().toLocaleLowerCase("tr");
  const mine = stall.filter((row) => {
    if (slot !== "hepsi" && row.item.slot !== slot) return false;
    if (!q) return true;
    return row.item.name.toLocaleLowerCase("tr").includes(q);
  });
  const offers = BAZAAR_OFFERS.filter((row) => {
    if (slot !== "hepsi" && row.slot !== slot) return false;
    if (!q) return true;
    return row.name.toLocaleLowerCase("tr").includes(q);
  });
  const slots = ["hepsi", "weapon", "armor", "helmet", "belt", "earring", "necklace", "bracelet", "boots", "ring", "gloves"];
  return (
    <Shell title="Hızlı Pazar" className="w-[min(32rem,96vw)]">
      <p className="mb-2 text-sm text-gold">{gold} Altın</p>
      <input className="mb-2 w-full rounded-md border border-border bg-bg px-2 py-1 text-sm" placeholder="Ara" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mb-2 flex flex-wrap gap-1">
        {slots.map((id) => (
          <button key={id} type="button" className={slot === id ? "rounded-md border border-gold px-2 py-1 text-xs text-gold" : "rounded-md border border-border px-2 py-1 text-xs text-muted"} onClick={() => setSlot(id)}>
            {id === "hepsi" ? "Hepsi" : SLOT_LABEL[id as EquipSlot] ?? id}
          </button>
        ))}
      </div>
      <div className="flex max-h-[46dvh] flex-col gap-2 overflow-x-hidden overflow-y-auto">
        {mine.map((row) => (
          <div key={row.uid} className="rounded-md border border-border bg-bg px-2 py-2 text-sm" onMouseEnter={(e) => setTip({ item: row.item, x: e.clientX, y: e.clientY })} onMouseMove={(e) => setTip({ item: row.item, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)}>
            <p className="break-words text-gold">{row.item.name}</p>
            <p className="text-xs text-muted">Senin ilanın · {row.price} altın</p>
          </div>
        ))}
        {offers.map((row) => {
          const preview = {
            uid: row.id,
            id: row.id,
            name: row.name,
            slot: row.slot as EquipSlot,
            level: row.level,
            plus: 0,
            str: row.str,
            hp: row.hp,
            ats: row.ats,
            mvs: row.mvs,
            ctp: 0,
            desc: row.forClass === "hepsi" ? "Bütün Karakterler Kuşanabilir" : row.forClass === "savasci" ? "Savaşçı" : row.forClass === "okcu" ? "Okçu" : row.forClass === "buyucu" ? "Büyücü" : "Ninja",
            req: row.level,
          } as Item;
          return (
            <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-border bg-bg px-2 py-2 text-sm" onMouseEnter={(e) => setTip({ item: preview, x: e.clientX, y: e.clientY })} onMouseMove={(e) => setTip({ item: preview, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)}>
              <span className="min-w-0 break-words">
                {row.name}
                <span className="block text-[11px] text-muted">{preview.desc} · Sv.{row.level}</span>
              </span>
              <span className="text-gold">{row.price}g</span>
              <button type="button" disabled={gold < row.price} className="rounded-md border border-border px-2 py-1 disabled:opacity-40" onClick={() => useRpg.getState().buyOffer(row.id)}>
                Al
              </button>
            </div>
          );
        })}
      </div>
      {tip ? <Tip item={tip.item} x={tip.x} y={tip.y} /> : null}
    </Shell>
  );
}

function CraftShop() {
  const gold = useRpg((s) => s.gold);
  const level = useRpg((s) => s.level);
  const bag = useRpg((s) => s.bag);
  const count = (id: string) => bag.reduce((sum, item) => sum + (item?.id === id ? item.count ?? 1 : 0), 0);
  return (
    <Shell title="Üretim" className="w-[min(32rem,96vw)]">
      <p className="mb-2 text-sm text-gold">{gold} Altın · Sv.{level}</p>
      <p className="mb-2 text-xs text-muted">30. seviyeden sonra maden, boss ganimeti ve altınla üretilir.</p>
      <div className="flex max-h-[50dvh] flex-col gap-2 overflow-x-hidden overflow-y-auto">
        {CRAFTS.map((row) => {
          const ores = row.ores.map((pair) => {
            const id = String(pair[0]);
            const need = Number(pair[1]);
            return `${need} ${id.replace("-cevher", "")} (${count(id)})`;
          }).join(" · ");
          const ready = level >= 30 && gold >= row.gold && row.ores.every((pair) => count(String(pair[0])) >= Number(pair[1]));
          return (
            <div key={row.id} className="rounded-md border border-border bg-bg px-2 py-2 text-sm">
              <p className="break-words text-gold">{row.name}</p>
              <p className="text-[11px] text-muted">{row.forClass === "hepsi" ? "Bütün Karakterler Kuşanabilir" : row.forClass === "savasci" ? "Savaşçı" : row.forClass === "okcu" ? "Okçu" : row.forClass === "buyucu" ? "Büyücü" : "Ninja"} · Sv.{row.req}</p>
              <p className="break-words text-xs">{ores} · {row.gold} altın</p>
              <button type="button" disabled={!ready} className="mt-1 rounded-md border border-gold px-3 py-1 text-xs text-gold disabled:opacity-40" onClick={() => useRpg.getState().craftItem(row.id)}>
                Üret
              </button>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function TradeShop({ kind }: { kind: Exclude<ShopKind, "smith" | "depot" | "guard" | "herald" | "gate" | "stall" | "craft" | "bazaar"> }) {
  const gold = useRpg((s) => s.gold);
  const classId = useRpg((s) => s.classId);
  const { user } = useCurrentUserState();
  const creative = isCreativeUser(user);
  useSyncExternalStore(subscribeStudio, studioVersion, studioVersion);
  const tabs = TABS[kind] ?? [];
  const [tab, setTab] = useState(tabs[0]?.id ?? "");
  const [tip, setTip] = useState<{ item: Item; x: number; y: number } | null>(null);
  const current = tabs.find((row) => row.id === tab) ?? tabs[0];
  const rows = shopRows(kind, classId).filter((row) => !current || current.test(row.id, row.slot));
  return (
    <Shell title={SHOP_TITLE[kind] ?? "Dükkan"} className="w-[min(32rem,96vw)]" vendor>
      <p className="mb-2 text-sm text-gold">{gold} Altın</p>
      <p className="mb-2 text-xs text-muted">Eşyayı bu pencereye bırak. Altına çevrilir.</p>
      <div className="mb-2 flex flex-wrap gap-1">
        {tabs.map((row) => (
          <button key={row.id} type="button" className={tab === row.id ? "rounded-md border border-gold px-2 py-1 text-xs text-gold" : "rounded-md border border-border px-2 py-1 text-xs text-muted"} onClick={() => setTab(row.id)}>
            {row.label}
          </button>
        ))}
      </div>
      <div className="flex max-h-[50dvh] flex-col gap-2 overflow-auto">
        {rows.map((row) => {
          const preview = { ...row, uid: row.id, level: 1, plus: 0 } as Item;
          const price = priceOf(row.id, row.price ?? 0);
          return (
            <div
              key={row.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-border bg-bg px-2 py-2 text-sm"
              onMouseEnter={(e) => setTip({ item: preview, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setTip({ item: preview, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTip(null)}
            >
              <ItemMark item={preview} />
              <span className="min-w-0 break-words">
                {row.name} {row.req ? <span className="text-muted">Sv.{row.req}</span> : null}
                {row.desc ? <span className="block text-[11px] text-muted">{row.desc}</span> : null}
              </span>
              <span className="text-gold">
                {creative ? (
                  <input
                    type="number"
                    className="w-16 rounded border border-border bg-bg px-1 text-gold"
                    value={price}
                    onChange={(e) => rememberPrice(row.id, Math.max(0, Number(e.target.value) || 0))}
                  />
                ) : (
                  `${price}g`
                )}
              </span>
              <button type="button" disabled={gold < price} className="rounded-md border border-border px-3 py-2 disabled:opacity-40" onClick={() => useRpg.getState().buy(row.id)}>
                Al
              </button>
            </div>
          );
        })}
      </div>
      {tip ? <Tip item={tip.item} x={tip.x} y={tip.y} /> : null}
    </Shell>
  );
}

function DepotShop() {
  const bag = useRpg((s) => s.bag);
  const depot = useRpg((s) => s.depot);
  const stage = useRpg((s) => s.bagStage);
  const [page, setPage] = useState(0);
  const [tip, setTip] = useState<{ item: Item; x: number; y: number } | null>(null);
  const open = openBagCount(stage);
  const start = page * PAGE_SIZE;
  return (
    <Shell title="Depo" className="w-[min(40rem,96vw)]">
      <p className="mb-2 text-xs text-muted">Açık çantanı sürükle. Depo ayrı durur.</p>
      <div className="mb-2 flex gap-1">
        {[0, 1, 2].map((n) => (
          <button key={n} type="button" className={n === page ? "rounded-md border border-gold px-2 py-1 text-xs text-gold" : "rounded-md border border-border px-2 py-1 text-xs"} onClick={() => setPage(n)}>
            Pencere {n + 1}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-gold">Çanta</p>
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: PAGE_SIZE }, (_, i) => {
              const index = start + i;
              const item = index < open ? bag[index] ?? null : null;
              const locked = index >= open;
              return (
                <button
                  key={index}
                  type="button"
                  draggable={!!item}
                  className="min-h-11 rounded-md border border-border bg-bg p-1 text-left text-[10px]"
                  onDragStart={(e) => {
                    if (!item) return;
                    setCarry({ kind: "bag", index });
                    e.dataTransfer.setData("text/plain", `bag:${index}`);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const raw = e.dataTransfer.getData("text/plain");
                    if (raw.startsWith("depot:")) useRpg.getState().withdraw(Number(raw.slice(6)));
                  }}
                  onClick={() => item && useRpg.getState().deposit(index)}
                  onMouseEnter={(e) => item && setTip({ item, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTip(null)}
                >
                  {locked ? "Kilit" : item ? `${displayName(item)}${item.count && item.count > 1 ? ` x${item.count}` : ""}` : ""}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs text-gold">Depo</p>
          <div className="grid grid-cols-4 gap-1" onDragOver={(e) => e.preventDefault()}>
            {depot.map((item, index) => (
              <button
                key={index}
                type="button"
                draggable={!!item}
                className="min-h-11 rounded-md border border-border bg-bg p-1 text-left text-[10px]"
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", `depot:${index}`);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const token = readCarry();
                  const raw = e.dataTransfer.getData("text/plain");
                  const from = token?.kind === "bag" ? token.index : raw.startsWith("bag:") ? Number(raw.slice(4)) : -1;
                  if (from >= 0) useRpg.getState().deposit(from);
                }}
                onClick={() => item && useRpg.getState().withdraw(index)}
                onMouseEnter={(e) => item && setTip({ item, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setTip(null)}
              >
                {item ? displayName(item) : ""}
              </button>
            ))}
          </div>
        </div>
      </div>
      {tip ? <Tip item={tip.item} x={tip.x} y={tip.y} /> : null}
    </Shell>
  );
}

function SmithShop() {
  const gold = useRpg((s) => s.gold);
  const item = useRpg((s) => s.smithItem);
  const stone = useRpg((s) => s.smithStone);
  const mat = useRpg((s) => s.smithMat);
  const need = item ? matForPlus(item.plus) : null;
  const cost = item && item.plus < 10 ? (ENHANCE[item.plus] ?? 1550) : 0;
  const chance = item && item.plus < 10 ? upgradeChance(item.plus, Boolean(stone)) : 0;
  const take = (which: "item" | "stone" | "mat", raw: string) => {
    const carried = readCarry();
    const from = raw.startsWith("bag:") ? Number(raw.slice(4)) : carried?.kind === "bag" ? carried.index : -1;
    if (from < 0) return;
    useRpg.getState().setSmith(which, from);
  };
  return (
    <Shell title="Demirci" className="w-[min(36rem,96vw)]">
      <p className="mb-2 text-sm text-gold">{gold} Altın</p>
      <p className="mb-2 text-xs text-muted">Eşya, güç taşı ve malzeme ayrı durur. Malzeme moblardan düşer. Envanter penceresini başlığından tutup kaydırabilirsin.</p>
      <div className="grid grid-cols-3 gap-2">
        <SmithSlot which="item" title="+ Basılacak" item={item} onDrop={(raw) => take("item", raw)} />
        <SmithSlot which="stone" title="Güç Taşı" item={stone} onDrop={(raw) => take("stone", raw)} />
        <SmithSlot which="mat" title={need ? need.name : "Malzeme"} item={mat} onDrop={(raw) => take("mat", raw)} />
      </div>
      <p className="mt-3 text-xs text-muted">
        {cost ? `${cost} altın` : "—"}
        {stone ? " · Güç taşı +35" : " · Taşsız"}
        {need ? ` · ${need.name} gerekir` : ""}
      </p>
      <p className="text-xs text-gold">{item && item.plus < 10 ? `Şans %${chance}` : ""}</p>
      <button type="button" className="mt-2 rounded-md border border-gold px-3 py-2 text-sm text-gold" onClick={() => useRpg.getState().forge()}>
        İşle
      </button>
    </Shell>
  );
}

function SmithSlot({ which, title, item, onDrop }: { which: "item" | "stone" | "mat"; title: string; item: Item | null; onDrop: (raw: string) => void }) {
  return (
    <div
      data-smith
      draggable={!!item}
      className="min-h-16 rounded-md border border-dashed border-border bg-bg p-2 text-xs"
      onDragStart={(e) => {
        if (!item) {
          e.preventDefault();
          return;
        }
        setCarry({ kind: "smith", which });
        e.dataTransfer.setData("text/plain", `smith:${which}`);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        const token = readCarry();
        if (token?.kind === "smith" && token.which === which) useRpg.getState().takeSmith(which, null);
        setCarry(null);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        keepCarry = true;
        onDrop(e.dataTransfer.getData("text/plain"));
      }}
    >
      <p className="text-muted">{title}</p>
      <p>{item ? `${displayName(item)}${item.count ? ` x${item.count}` : ""}` : "Boş"}</p>
    </div>
  );
}
