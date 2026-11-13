"use client";

import { useCallback, useEffect } from "react";
import { useSettings } from "@/game/store/settings";
import { translate, type MessageKey } from "./messages";

/** Returns a translate function bound to the current UI language. */
export function useT() {
  const language = useSettings((state) => state.language);
  const hydrate = useSettings((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(language, key, params),
    [language],
  );
}
