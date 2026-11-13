import * as THREE from "three";
import { daylight } from "./sky/daylight";

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
  camera: { yaw: 0, pitch: 0.24, distance: 5.4 },
  /** Set once the first frame with an active player has been simulated. */
  ready: false,
  /** Smoothed frames per second. */
  fps: 60,
  /** One-shot request to move the player, consumed by the controller. */
  teleport: null as { x: number; z: number; heading: number } | null,
};

export interface DebugSnapshot {
  ready: boolean;
  player: { x: number; y: number; z: number; speed: number };
  place: string | null;
  fps: number;
  quality: string | null;
  hour: number;
}

export interface DebugControls {
  /** Moves the player to a point on the ground, facing `heading`. */
  teleport: (x: number, z: number, heading?: number) => void;
  setHour: (hour: number, speed?: number) => void;
  setCamera: (yaw: number, pitch?: number, distance?: number) => void;
}

declare global {
  interface Window {
    /** Read-only probe used by the Playwright smoke tests. */
    __berlin?: () => DebugSnapshot;
    /** Staging helpers for tests and the screenshot script. */
    __berlinDebug?: DebugControls;
  }
}

let currentPlace: string | null = null;
let currentQuality: string | null = null;

export function setDebugQuality(quality: string) {
  currentQuality = quality;
}

export function setDebugPlace(place: string | null) {
  currentPlace = place;
}

export function installDebugProbe() {
  if (typeof window === "undefined") return;
  window.__berlinDebug = {
    teleport(x, z, heading = runtime.player.heading) {
      runtime.teleport = { x, z, heading };
    },
    setHour(hour, speed) {
      daylight.hour = hour;
      if (speed !== undefined) daylight.speed = speed;
    },
    setCamera(yaw, pitch = runtime.camera.pitch, distance = runtime.camera.distance) {
      Object.assign(runtime.camera, { yaw, pitch, distance });
    },
  };
  window.__berlin = () => ({
    ready: runtime.ready,
    player: {
      x: runtime.player.position.x,
      y: runtime.player.position.y,
      z: runtime.player.position.z,
      speed: runtime.player.speed,
    },
    place: currentPlace,
    fps: runtime.fps,
    quality: currentQuality,
    hour: daylight.hour,
  });
}
