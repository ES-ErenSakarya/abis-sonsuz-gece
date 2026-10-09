/** Finger targets. Hit size is a fraction of the short screen side, not a fixed pixel. */

const TOUCH_QUERY = "(pointer: coarse), (hover: none)";

export function touchHitSize(screenW: number, screenH: number) {
  return Math.min(Math.max(1, screenW), Math.max(1, screenH)) * 0.12;
}

export function armTouchHit() {
  const mark = () => {
    const coarse = window.matchMedia(TOUCH_QUERY).matches;
    const finger = navigator.maxTouchPoints > 0;
    const tight = window.innerWidth <= 1100 || window.innerHeight <= 680;
    document.documentElement.toggleAttribute("data-touch", coarse || (finger && tight));
  };
  let pressed: HTMLElement | null = null;
  const nearest = (x: number, y: number) => {
    const layer = document.getElementById("hud-layer");
    if (!layer) return null;
    const reach = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--touch-hit")) || touchHitSize(window.innerWidth, window.innerHeight)) * 0.5;
    let best: HTMLElement | null = null;
    let bestD = reach;
    for (const node of layer.querySelectorAll("button, .octo-slot, .bag-tab")) {
      const el = node as HTMLElement;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const cx = Math.max(rect.left, Math.min(x, rect.right));
      const cy = Math.max(rect.top, Math.min(y, rect.bottom));
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < bestD) {
        bestD = dist;
        best = el;
      }
    }
    return best;
  };
  const onStart = (event: TouchEvent) => {
    if (!document.documentElement.hasAttribute("data-touch") || event.touches.length !== 1) return;
    const target = event.target as Element | null;
    if (target?.closest("button, .octo-slot, .bag-tab, input, textarea, a")) return;
    const point = event.touches[0];
    const best = nearest(point.clientX, point.clientY);
    if (!best) return;
    if (best.dataset.press === "down") {
      pressed = best;
      best.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: point.clientX, clientY: point.clientY, pointerType: "touch" }));
      return;
    }
    best.click();
  };
  const onEnd = (event: TouchEvent) => {
    const held = pressed;
    pressed = null;
    if (!held) return;
    const point = event.changedTouches[0];
    held.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, clientX: point?.clientX ?? 0, clientY: point?.clientY ?? 0, pointerType: "touch" }));
  };
  mark();
  const query = window.matchMedia(TOUCH_QUERY);
  query.addEventListener("change", mark);
  window.addEventListener("resize", mark);
  window.addEventListener("orientationchange", mark);
  document.addEventListener("touchstart", onStart, { capture: true, passive: true });
  document.addEventListener("touchend", onEnd, { capture: true, passive: true });
  document.addEventListener("touchcancel", onEnd, { capture: true, passive: true });
  return () => {
    query.removeEventListener("change", mark);
    window.removeEventListener("resize", mark);
    window.removeEventListener("orientationchange", mark);
    document.removeEventListener("touchstart", onStart, { capture: true });
    document.removeEventListener("touchend", onEnd, { capture: true });
    document.removeEventListener("touchcancel", onEnd, { capture: true });
  };
}
