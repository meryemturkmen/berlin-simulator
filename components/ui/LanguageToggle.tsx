"use client";

import { LANGUAGES, useSettings } from "@/game/store/settings";
import { useT } from "@/lib/i18n/useT";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const setLanguage = useSettings((state) => state.setLanguage);

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={`border-ink/15 inline-flex rounded-full border bg-white/70 p-1 backdrop-blur ${className}`}
    >
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={language === code}
          onClick={() => setLanguage(code)}
          className={`min-h-9 min-w-11 rounded-full px-3 text-sm font-semibold uppercase transition-colors ${
            language === code ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
