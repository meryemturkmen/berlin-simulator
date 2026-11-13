import type { Quality } from "@/game/store/settings";

export interface DeviceInfo {
  /** WebGL renderer string, e.g. "ANGLE (Apple, Apple M2, OpenGL 4.1)". */
  renderer: string;
  touch: boolean;
  cores: number;
  /** Approximate RAM in GB as reported by the browser, if available. */
  memory?: number;
}

export interface QualitySettings {
  /** Shadow map edge length in pixels; 0 turns shadows off. */
  shadowMapSize: number;
  maxPixelRatio: number;
  /** Fraction of scenery trees drawn. */
  treeDensity: number;
  clouds: boolean;
  /** Number of background pedestrians. */
  crowd: number;
}

export const QUALITY_SETTINGS: Record<Quality, QualitySettings> = {
  low: { shadowMapSize: 0, maxPixelRatio: 1, treeDensity: 0.6, clouds: false, crowd: 4 },
  medium: { shadowMapSize: 1024, maxPixelRatio: 1.5, treeDensity: 1, clouds: true, crowd: 8 },
  high: { shadowMapSize: 2048, maxPixelRatio: 2, treeDensity: 1, clouds: true, crowd: 12 },
};

const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|software|basic render/i;

/** Picks a starting quality level from what the device reports about itself. */
export function chooseQuality(device: DeviceInfo): Quality {
  if (SOFTWARE_RENDERERS.test(device.renderer)) return "low";
  if (device.cores <= 2 || (device.memory !== undefined && device.memory <= 2)) return "low";
  if (device.touch) return "medium";
  if (device.cores <= 4 || (device.memory !== undefined && device.memory <= 4)) return "medium";
  return "high";
}

/** One step down, for when the measured frame rate stays low. */
export function lowerQuality(quality: Quality): Quality {
  return quality === "high" ? "medium" : "low";
}

let detected: Quality | null = null;

/** Detects the device once per session. Browser only. */
export function detectQuality(): Quality {
  if (detected) return detected;
  let renderer = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (gl) {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    // No WebGL info available: fall through with an empty renderer string.
  }
  detected = chooseQuality({
    renderer,
    touch: window.matchMedia("(pointer: coarse)").matches,
    cores: navigator.hardwareConcurrency || 4,
    memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  });
  return detected;
}
