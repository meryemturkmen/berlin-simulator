"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import {
  BOTTOMS,
  BUILDS,
  CLOTHING_COLORS,
  DEFAULT_AVATAR,
  HAIR_COLORS,
  HAIR_STYLES,
  SHOES,
  SHOE_COLORS,
  SKIN_TONES,
  TOPS,
  avatarSchema,
  randomLook,
  type AvatarConfig,
} from "@/game/avatar/schema";
import { useProfile } from "@/game/store/profile";
import type { MessageKey } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/useT";

const AvatarPreview = dynamic(() => import("./AvatarPreview"), { ssr: false });

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-ink-soft mb-2 text-sm font-semibold tracking-wide uppercase">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function Choices<T extends string>({
  name,
  options,
  value,
  onChange,
  labelFor,
}: {
  name: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labelFor: (value: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label key={option} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="peer sr-only"
          />
          <span className="border-ink/15 text-ink peer-checked:bg-ink peer-checked:text-paper peer-checked:border-ink peer-focus-visible:outline-coral hover:border-ink/40 inline-flex min-h-11 items-center rounded-full border bg-white px-4 text-base font-medium transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2">
            {labelFor(option)}
          </span>
        </label>
      ))}
    </div>
  );
}

function Swatches({
  name,
  label,
  colors,
  value,
  onChange,
}: {
  name: string;
  label: string;
  colors: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {colors.map((color, index) => (
        <label key={color} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={color}
            checked={value === color}
            onChange={() => onChange(color)}
            aria-label={`${label} ${index + 1}`}
            className="peer sr-only"
          />
          <span
            style={{ backgroundColor: color }}
            className="border-ink/20 peer-checked:ring-ink peer-focus-visible:outline-coral block size-10 rounded-full border ring-offset-2 ring-offset-white transition-transform peer-checked:scale-105 peer-checked:ring-3 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-4"
          />
        </label>
      ))}
    </div>
  );
}

export function AvatarEditor() {
  const t = useT();
  const router = useRouter();
  const formId = useId();
  const status = useProfile((state) => state.status);
  const saved = useProfile((state) => state.avatar);
  const hydrate = useProfile((state) => state.hydrate);
  const saveAvatar = useProfile((state) => state.saveAvatar);

  const [draft, setDraft] = useState<AvatarConfig | null>(null);
  const [showNameError, setShowNameError] = useState(false);
  const angleRef = useRef(0.35);
  const dragRef = useRef<{ x: number; angle: number } | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // The form starts from the saved avatar once storage has been read.
  const avatar = draft ?? (status === "ready" ? (saved ?? DEFAULT_AVATAR) : null);

  const update = (patch: Partial<AvatarConfig>) => {
    if (avatar) setDraft({ ...avatar, ...patch });
  };

  if (!avatar) {
    return <div className="bg-paper min-h-dvh" aria-busy="true" />;
  }

  const submit = async () => {
    const result = avatarSchema.safeParse(avatar);
    if (!result.success) {
      setShowNameError(true);
      document.getElementById(`${formId}-name`)?.focus();
      return;
    }
    await saveAvatar(result.data);
    router.push("/play");
  };

  const label =
    <T extends string>(prefix: string) =>
    (value: T) =>
      t(`${prefix}.${value}` as MessageKey);

  return (
    <main className="bg-paper flex h-dvh flex-col overflow-hidden lg:flex-row">
      <section
        aria-label={t("editor.preview")}
        className="relative h-[36dvh] shrink-0 bg-linear-to-b from-[#f9d9b8] via-[#f6e6cf] to-[#f7f0e3] lg:h-auto lg:flex-1"
      >
        <div
          data-testid="avatar-preview"
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { x: event.clientX, angle: angleRef.current };
          }}
          onPointerMove={(event) => {
            if (dragRef.current) {
              angleRef.current =
                dragRef.current.angle + (event.clientX - dragRef.current.x) * 0.012;
            }
          }}
          onPointerUp={() => (dragRef.current = null)}
          onPointerCancel={() => (dragRef.current = null)}
        >
          <AvatarPreview look={avatar} angleRef={angleRef} />
        </div>
        <LanguageToggle className="absolute top-3 right-3 lg:top-5 lg:right-auto lg:left-5" />
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label={t("editor.rotateLeft")}
            onClick={() => (angleRef.current -= Math.PI / 4)}
            className="border-ink/15 text-ink hover:bg-paper-dim size-11 rounded-full border bg-white/80 text-xl backdrop-blur"
          >
            ↺
          </button>
          <span className="text-ink-soft hidden text-sm sm:inline">{t("editor.previewHint")}</span>
          <button
            type="button"
            aria-label={t("editor.rotateRight")}
            onClick={() => (angleRef.current += Math.PI / 4)}
            className="border-ink/15 text-ink hover:bg-paper-dim size-11 rounded-full border bg-white/80 text-xl backdrop-blur"
          >
            ↻
          </button>
        </div>
      </section>

      <form
        className="border-ink/10 flex min-h-0 flex-1 flex-col border-t bg-white/60 lg:max-w-xl lg:border-t-0 lg:border-l"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 lg:px-8 lg:py-8">
          <h1 className="font-display text-3xl font-semibold lg:text-4xl">{t("editor.heading")}</h1>

          <div>
            <label
              htmlFor={`${formId}-name`}
              className="text-ink-soft mb-2 block text-sm font-semibold tracking-wide uppercase"
            >
              {t("editor.name")}
            </label>
            <input
              id={`${formId}-name`}
              type="text"
              value={avatar.name}
              maxLength={20}
              autoComplete="off"
              placeholder={t("editor.namePlaceholder")}
              aria-invalid={showNameError && avatar.name.trim() === ""}
              aria-describedby={`${formId}-name-hint`}
              onChange={(event) => {
                setShowNameError(false);
                update({ name: event.target.value });
              }}
              className="border-ink/20 aria-invalid:border-coral-deep min-h-12 w-full rounded-xl border bg-white px-4 text-lg"
            />
            <p
              id={`${formId}-name-hint`}
              className={`mt-1.5 text-sm ${showNameError ? "text-coral-deep font-medium" : "text-ink-soft"}`}
            >
              {t("editor.nameHint")}
            </p>
          </div>

          <Section label={t("editor.build")}>
            <Choices
              name="build"
              options={BUILDS}
              value={avatar.build}
              onChange={(build) => update({ build })}
              labelFor={label("build")}
            />
          </Section>

          <Section label={t("editor.skin")}>
            <Swatches
              name="skin"
              label={t("editor.skin")}
              colors={SKIN_TONES}
              value={avatar.skin}
              onChange={(skin) => update({ skin })}
            />
          </Section>

          <Section label={t("editor.hairStyle")}>
            <div className="space-y-3">
              <Choices
                name="hairStyle"
                options={HAIR_STYLES}
                value={avatar.hairStyle}
                onChange={(hairStyle) => update({ hairStyle })}
                labelFor={label("hair")}
              />
              <Swatches
                name="hairColor"
                label={t("editor.hairColor")}
                colors={HAIR_COLORS}
                value={avatar.hairColor}
                onChange={(hairColor) => update({ hairColor })}
              />
            </div>
          </Section>

          <Section label={t("editor.top")}>
            <div className="space-y-3">
              <Choices
                name="top"
                options={TOPS}
                value={avatar.top}
                onChange={(top) => update({ top })}
                labelFor={label("top")}
              />
              <Swatches
                name="topColor"
                label={`${t("editor.top")}: ${t("editor.color")}`}
                colors={CLOTHING_COLORS}
                value={avatar.topColor}
                onChange={(topColor) => update({ topColor })}
              />
            </div>
          </Section>

          <Section label={t("editor.bottom")}>
            <div className="space-y-3">
              <Choices
                name="bottom"
                options={BOTTOMS}
                value={avatar.bottom}
                onChange={(bottom) => update({ bottom })}
                labelFor={label("bottom")}
              />
              <Swatches
                name="bottomColor"
                label={`${t("editor.bottom")}: ${t("editor.color")}`}
                colors={CLOTHING_COLORS}
                value={avatar.bottomColor}
                onChange={(bottomColor) => update({ bottomColor })}
              />
            </div>
          </Section>

          <Section label={t("editor.shoes")}>
            <div className="space-y-3">
              <Choices
                name="shoes"
                options={SHOES}
                value={avatar.shoes}
                onChange={(shoes) => update({ shoes })}
                labelFor={label("shoes")}
              />
              <Swatches
                name="shoeColor"
                label={`${t("editor.shoes")}: ${t("editor.color")}`}
                colors={SHOE_COLORS}
                value={avatar.shoeColor}
                onChange={(shoeColor) => update({ shoeColor })}
              />
            </div>
          </Section>
        </div>

        <div className="border-ink/10 flex gap-3 border-t bg-white/90 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:px-8">
          <button
            type="button"
            onClick={() => update(randomLook())}
            className="border-ink/20 hover:bg-paper-dim min-h-12 rounded-full border bg-white px-5 text-base font-semibold"
          >
            🎲 {t("editor.random")}
          </button>
          <button
            type="submit"
            className="bg-coral hover:bg-coral-deep min-h-12 flex-1 rounded-full px-6 text-lg font-semibold text-white transition-colors"
          >
            {t("editor.start")}
          </button>
        </div>
      </form>
    </main>
  );
}
