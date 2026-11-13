"use client";

import { useEffect, useState } from "react";
import { detectQuality, lowerQuality, QUALITY_SETTINGS } from "@/lib/quality";
import { runtime } from "./runtime";
import { useSettings, type Quality } from "./store/settings";

/**
 * Effective quality level: the manual setting, or an automatic level that
 * starts from device detection and steps down if the frame rate stays low.
 */
export function useQuality() {
  const setting = useSettings((state) => state.quality);
  const [auto, setAuto] = useState<Quality>(() => detectQuality());

  useEffect(() => {
    if (setting !== "auto") return;
    let slowSamples = 0;
    const timer = window.setInterval(() => {
      if (!runtime.ready || document.hidden) return;
      slowSamples = runtime.fps < 24 ? slowSamples + 1 : 0;
      // Five slow seconds in a row: drop one level and start counting again.
      if (slowSamples >= 5) {
        slowSamples = 0;
        setAuto((current) => lowerQuality(current));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [setting]);

  const level = setting === "auto" ? auto : setting;
  return { level, ...QUALITY_SETTINGS[level] };
}
