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
// Intensities are tuned for no tone mapping: a sunlit surface lands near its
// palette color, a shaded one at roughly 60 % of it.
const STOPS: Stop[] = [
  {
    at: -1,
    top: "#0b1233",
    horizon: "#232d57",
    sun: "#9db3ff",
    sunIntensity: 0.55,
    fill: "#7387d6",
    ambient: 1.25,
  },
  {
    at: -0.22,
    top: "#0f1740",
    horizon: "#2c3566",
    sun: "#9db3ff",
    sunIntensity: 0.5,
    fill: "#7a8ad8",
    ambient: 1.3,
  },
  {
    at: -0.08,
    top: "#2b3472",
    horizon: "#b56d8e",
    sun: "#ff9b7a",
    sunIntensity: 0.3,
    fill: "#b9a0d6",
    ambient: 1.5,
  },
  {
    at: 0.02,
    top: "#4a5fa8",
    horizon: "#ffa26e",
    sun: "#ff9457",
    sunIntensity: 1.0,
    fill: "#ffc7a8",
    ambient: 1.6,
  },
  {
    at: 0.16,
    top: "#5b93d6",
    horizon: "#ffdcab",
    sun: "#ffc890",
    sunIntensity: 1.45,
    fill: "#ffe6cf",
    ambient: 1.75,
  },
  {
    at: 0.4,
    top: "#4b98e2",
    horizon: "#cfe7f6",
    sun: "#fff1d8",
    sunIntensity: 1.55,
    fill: "#f1f6ff",
    ambient: 1.9,
  },
  {
    at: 1,
    top: "#3f8fe0",
    horizon: "#c4e2f5",
    sun: "#fff6e6",
    sunIntensity: 1.6,
    fill: "#f4f8ff",
    ambient: 1.95,
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
