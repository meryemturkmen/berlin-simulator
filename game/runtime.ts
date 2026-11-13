import * as THREE from "three";

/**
 * Per-frame game state that lives outside React. Systems read and write it in
 * useFrame; nothing here causes a render.
 */
export const runtime = {
  player: {
    position: new THREE.Vector3(),
    /** Facing direction in radians around Y. 0 looks toward +Z. */
    heading: 0,
    speed: 0,
    grounded: false,
  },
  camera: { yaw: 0, pitch: 0.32, distance: 5.2 },
  /** Set once the first frame with an active player has been simulated. */
  ready: false,
};

export interface DebugSnapshot {
  ready: boolean;
  player: { x: number; y: number; z: number; speed: number };
  place: string | null;
}

declare global {
  interface Window {
    /** Read-only probe used by the Playwright smoke tests. */
    __berlin?: () => DebugSnapshot;
  }
}

let currentPlace: string | null = null;

export function setDebugPlace(place: string | null) {
  currentPlace = place;
}

export function installDebugProbe() {
  if (typeof window === "undefined") return;
  window.__berlin = () => ({
    ready: runtime.ready,
    player: {
      x: runtime.player.position.x,
      y: runtime.player.position.y,
      z: runtime.player.position.z,
      speed: runtime.player.speed,
    },
    place: currentPlace,
  });
}
