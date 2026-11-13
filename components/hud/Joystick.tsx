"use client";

import { useRef, useState } from "react";
import { input } from "@/game/input";

const RADIUS = 52;

/** Virtual thumbstick for touch devices. Writes straight into the shared input state. */
export function Joystick() {
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const release = () => {
    origin.current = null;
    input.joyX = 0;
    input.joyY = 0;
    setKnob({ x: 0, y: 0 });
  };

  return (
    <div
      data-testid="joystick"
      className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-5 size-36 touch-none rounded-full border-2 border-white/50 bg-white/20 backdrop-blur-sm"
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const rect = event.currentTarget.getBoundingClientRect();
        origin.current = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          id: event.pointerId,
        };
      }}
      onPointerMove={(event) => {
        const start = origin.current;
        if (!start || start.id !== event.pointerId) return;
        event.stopPropagation();
        let dx = event.clientX - start.x;
        let dy = event.clientY - start.y;
        const length = Math.hypot(dx, dy);
        if (length > RADIUS) {
          dx = (dx / length) * RADIUS;
          dy = (dy / length) * RADIUS;
        }
        input.joyX = dx / RADIUS;
        input.joyY = -dy / RADIUS;
        setKnob({ x: dx, y: dy });
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 size-16 rounded-full bg-white/85 shadow-lg"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
