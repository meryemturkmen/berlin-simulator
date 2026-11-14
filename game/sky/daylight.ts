import * as THREE from "three";

/** Real seconds for one full in-game day. */
export const DAY_LENGTH_SECONDS = 12 * 60;
const SUNRISE = 6;
const SUNSET = 20.5;

interface Stop {
  /** Sun elevation, sin of the angle above the horizon (-1 to 1). */
  at: number;
  top: string;
  horizon: string;
  /** Color and strength of the sun (or moon) light. */
  sun: string;
  sunIntensity: number;
  /** Color and strength of the fill light from sky and ground. */
  fill: string;
  ambient: number;
}

// Keyed by sun elevation so sunrise and sunset share the same warm colors.
// Intensities are tuned for ACES filmic tone mapping: a strong, warm key light
// and a cooler sky fill, so shadows read clearly without going black.
const STOPS: Stop[] = [
  {
    at: -1,
    top: "#070c24",
    horizon: "#182040",
    sun: "#8ea6ff",
    sunIntensity: 0.5,
    fill: "#5d70c0",
    ambient: 0.95,
  },
  {
    at: -0.22,
    top: "#0a1230",
    horizon: "#20294f",
    sun: "#8ea6ff",
    sunIntensity: 0.45,
    fill: "#6577c4",
    ambient: 1.0,
  },
  {
    at: -0.08,
    top: "#1f2a5e",
    horizon: "#9b6382",
    sun: "#ff9b7a",
    sunIntensity: 0.4,
    fill: "#9f8fc4",
    ambient: 1.25,
  },
  {
    at: 0.02,
    top: "#3d5596",
    horizon: "#f09a68",
    sun: "#ff8a4a",
    sunIntensity: 2.2,
    fill: "#d9a99a",
    ambient: 1.35,
  },
  {
    at: 0.16,
    top: "#4a82c4",
    horizon: "#f3cf9f",
    sun: "#ffbb7a",
    sunIntensity: 3.4,
    fill: "#cfd3e0",
    ambient: 1.5,
  },
  {
    at: 0.4,
    top: "#3c82cc",
    horizon: "#bfd8ea",
    sun: "#ffecd0",
    sunIntensity: 4.0,
    fill: "#c6d6ee",
    ambient: 1.6,
  },
  {
    at: 1,
    top: "#2f78c8",
    horizon: "#b4d2e8",
    sun: "#fff3e0",
    sunIntensity: 4.3,
    fill: "#c4d6f0",
    ambient: 1.65,
  },
];

const colorA = new THREE.Color();
const colorB = new THREE.Color();

/**
 * Live lighting state, written once per frame by <DayNight> and read by sky,
 * lights and materials. Uniform objects are shared so shaders update for free.
 */
export const daylight = {
  /** Hour of day, 0 to 24. */
  hour: 15,
  /** Multiplier on the passage of time (0 pauses). */
  speed: 1,
  elevation: 1,
  /** Unit vector toward the sun, or toward the moon at night. */
  lightDirection: new THREE.Vector3(0.4, 0.8, 0.4),
  sunDirection: new THREE.Vector3(0.4, 0.8, 0.4),
  top: new THREE.Color(),
  horizon: new THREE.Color(),
  sun: new THREE.Color(),
  fill: new THREE.Color(),
  sunIntensity: 2.5,
  ambient: 1,
  uniforms: {
    /** 0 by day, 1 at night: drives lit windows, lamps and stars. */
    uNight: { value: 0 },
    uTime: { value: 0 },
  },
};

export function sunElevation(hour: number): number {
  const dayLength = SUNSET - SUNRISE;
  if (hour >= SUNRISE && hour <= SUNSET) {
    return Math.sin(((hour - SUNRISE) / dayLength) * Math.PI);
  }
  const nightLength = 24 - dayLength;
  const sinceSunset = (hour - SUNSET + 24) % 24;
  return -Math.sin((sinceSunset / nightLength) * Math.PI) * 0.6;
}

/** True during the warm minutes around sunset. */
export function isSunsetHour(hour: number): boolean {
  return hour >= SUNSET - 1.2 && hour <= SUNSET + 0.25;
}

export function formatClock(hour: number): string {
  const total = Math.floor((((hour % 24) + 24) % 24) * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(Math.floor((total % 60) / 10) * 10).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Advances the clock and recomputes all derived lighting values. */
export function updateDaylight(deltaSeconds: number) {
  const state = daylight;
  state.hour = (state.hour + (deltaSeconds * state.speed * 24) / DAY_LENGTH_SECONDS) % 24;
  state.uniforms.uTime.value += deltaSeconds;

  const elevation = sunElevation(state.hour);
  state.elevation = elevation;

  // East (+X) at sunrise, over the south (+Z), west (-X) at sunset.
  const dayProgress = (state.hour - SUNRISE) / (SUNSET - SUNRISE);
  const angle = dayProgress * Math.PI;
  state.sunDirection
    .set(Math.cos(angle), elevation, 0.55 * Math.max(0, Math.sin(angle)) + 0.2)
    .normalize();
  if (elevation > -0.05) {
    state.lightDirection.copy(state.sunDirection);
    // Keep shadows from stretching to infinity at the horizon.
    state.lightDirection.y = Math.max(state.lightDirection.y, 0.2);
    state.lightDirection.normalize();
  } else {
    state.lightDirection.set(-0.35, 0.8, -0.45).normalize();
  }

  let lower = STOPS[0];
  let upper = STOPS[STOPS.length - 1];
  for (let index = 0; index + 1 < STOPS.length; index++) {
    if (elevation >= STOPS[index].at && elevation <= STOPS[index + 1].at) {
      lower = STOPS[index];
      upper = STOPS[index + 1];
      break;
    }
  }
  const t = upper.at === lower.at ? 0 : (elevation - lower.at) / (upper.at - lower.at);
  const mix = (target: THREE.Color, a: string, b: string) =>
    target.copy(colorA.set(a)).lerp(colorB.set(b), t);
  mix(state.top, lower.top, upper.top);
  mix(state.horizon, lower.horizon, upper.horizon);
  mix(state.sun, lower.sun, upper.sun);
  mix(state.fill, lower.fill, upper.fill);
  state.sunIntensity = THREE.MathUtils.lerp(lower.sunIntensity, upper.sunIntensity, t);
  state.ambient = THREE.MathUtils.lerp(lower.ambient, upper.ambient, t);
  state.uniforms.uNight.value = THREE.MathUtils.smoothstep(-elevation, -0.06, 0.14);
}
