import * as THREE from "three";

/** Screen layer. World points go through the camera. HUD never does. */
export class Viewport {
  width = 1;
  height = 1;
  private readonly ndc = new THREE.Vector3();

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  sync() {
    const layer = document.getElementById("world-layer");
    if (layer && layer.clientWidth > 1 && layer.clientHeight > 1) {
      this.resize(layer.clientWidth, layer.clientHeight);
      return;
    }
    this.resize(window.innerWidth, window.innerHeight);
  }

  /** World coordinate → pixels on the world layer. `behind` is past the camera. */
  worldToScreen(camera: THREE.Camera, x: number, y: number, z: number) {
    this.sync();
    this.ndc.set(x, y, z).project(camera);
    return {
      x: (this.ndc.x * 0.5 + 0.5) * this.width,
      y: (-this.ndc.y * 0.5 + 0.5) * this.height,
      behind: this.ndc.z > 1,
    };
  }

  /** Pin a world-following label. Returns false when the point is behind the camera. */
  placeWorld(el: HTMLElement, camera: THREE.Camera, x: number, y: number, z: number) {
    const hit = this.worldToScreen(camera, x, y, z);
    if (hit.behind) {
      el.style.display = "none";
      return false;
    }
    el.style.display = "block";
    el.style.left = `${hit.x}px`;
    el.style.top = `${hit.y}px`;
    return true;
  }
}

export const viewport = new Viewport();
