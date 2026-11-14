"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useProfile } from "@/game/store/profile";
import { useT } from "@/lib/i18n/useT";
import { Skyline } from "./Skyline";

export function TitleScreen() {
  const t = useT();
  const hasAvatar = useProfile((state) => state.avatar !== null);
  const hydrate = useProfile((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-linear-to-b from-[#2b2a4c] via-[#b5607a] via-55% to-[#f6b872] text-white">
      {/* Low sun behind the skyline */}
      <div
        aria-hidden="true"
        className="absolute bottom-[8dvh] left-1/2 size-[40vmin] -translate-x-1/2 rounded-full bg-radial from-[#ffe9b0] via-[#ffc978]/70 to-transparent blur-sm"
      />
      <Skyline className="pointer-events-none absolute inset-x-0 bottom-0 h-[46dvh] w-full" />

      <header className="relative z-10 flex justify-end p-4 sm:p-6">
        <LanguageToggle />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center px-6 pt-[8dvh] text-center sm:pt-[10dvh]">
        <p className="mb-3 text-sm font-semibold tracking-[0.3em] text-[#ffd9a8] uppercase">
          Mitte · Kreuzberg · Charlottenburg
        </p>
        <h1 className="font-display text-6xl leading-none font-semibold tracking-tight text-balance drop-shadow-[0_3px_18px_rgba(30,20,60,0.5)] sm:text-8xl">
          Berlin Simulator
        </h1>
        <p className="mt-5 max-w-md text-lg text-pretty text-white/90 sm:text-xl">
          {t("title.tagline")}
        </p>

        <div className="mt-9 flex flex-col items-center gap-4">
          <Link
            href={hasAvatar ? "/play" : "/avatar"}
            className="text-ink min-w-56 rounded-full bg-white px-12 py-4 text-xl font-bold shadow-[0_10px_40px_rgba(30,20,60,0.35)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            {t("title.play")}
          </Link>
          <div className="flex gap-3 text-base font-medium">
            {hasAvatar && (
              <Link
                href="/avatar"
                className="inline-flex min-h-11 items-center px-2 underline-offset-4 hover:underline"
              >
                {t("title.editAvatar")}
              </Link>
            )}
            <Link
              href="/about"
              className="inline-flex min-h-11 items-center px-2 underline-offset-4 hover:underline"
            >
              {t("title.about")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
