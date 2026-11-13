import { describe, expect, it } from "vitest";
import {
  daylight,
  formatClock,
  isSunsetHour,
  sunElevation,
  updateDaylight,
} from "@/game/sky/daylight";

describe("daylight", () => {
  it("has the sun up at noon and down at midnight", () => {
    expect(sunElevation(13)).toBeGreaterThan(0.9);
    expect(sunElevation(0)).toBeLessThan(-0.3);
    expect(sunElevation(6)).toBeCloseTo(0, 5);
    expect(sunElevation(20.5)).toBeCloseTo(0, 5);
  });

  it("is continuous across midnight", () => {
    expect(sunElevation(23.999)).toBeCloseTo(sunElevation(0.001), 2);
  });

  it("knows the sunset window", () => {
    expect(isSunsetHour(20)).toBe(true);
    expect(isSunsetHour(15)).toBe(false);
    expect(isSunsetHour(22)).toBe(false);
  });

  it("formats the clock in ten-minute steps", () => {
    expect(formatClock(16.5)).toBe("16:30");
    expect(formatClock(9.99)).toBe("09:50");
    expect(formatClock(24.25)).toBe("00:10");
  });

  it("advances time, wraps at 24 h and switches night lighting on", () => {
    daylight.speed = 1;
    daylight.hour = 23.9;
    updateDaylight(60); // one real minute is two in-game hours
    expect(daylight.hour).toBeCloseTo(1.9, 5);
    expect(daylight.uniforms.uNight.value).toBe(1);

    daylight.hour = 12;
    updateDaylight(0);
    expect(daylight.uniforms.uNight.value).toBe(0);
    expect(daylight.sunIntensity).toBeGreaterThan(1);
    expect(daylight.lightDirection.y).toBeGreaterThan(0.5);
  });
});
