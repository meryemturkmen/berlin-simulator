"use client";

import { useEffect } from "react";

/**
 * Raw player input, shared between the keyboard, the touch joystick and the
 * camera drag handler. Plain mutable state: it is read once per frame by the
 * player controller, so it must not trigger React renders.
 */
export const input = {
  keys: new Set<string>(),
  /** Joystick vector, each axis in [-1, 1]. Y is forward. */
  joyX: 0,
  joyY: 0,
  /** Camera rotation accumulated since the last frame, in radians. */
  lookYaw: 0,
  lookPitch: 0,
  /** Zoom steps accumulated since the last frame. Positive zooms out. */
  zoom: 0,
};

const MOVE_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
]);

export interface MoveIntent {
  x: number;
  y: number;
  run: boolean;
}

/** Combined movement intent. The vector length is at most 1. */
export function readMove(target: MoveIntent): MoveIntent {
  const { keys } = input;
  let x =
    (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
    (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  let y =
    (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
    (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  let run = keys.has("ShiftLeft") || keys.has("ShiftRight");

  if (x === 0 && y === 0) {
    x = input.joyX;
    y = input.joyY;
    // Pushing the stick to the edge runs.
    run = Math.hypot(x, y) > 0.92;
  }
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  target.x = x;
  target.y = y;
  target.run = run;
  return target;
}

export function resetInput() {
  input.keys.clear();
  input.joyX = 0;
  input.joyY = 0;
  input.lookYaw = 0;
  input.lookPitch = 0;
  input.zoom = 0;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  );
}

/** Tracks movement keys while mounted. Typing in a text field never moves the player. */
export function useKeyboardInput() {
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!MOVE_KEYS.has(event.code) || isTyping(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      input.keys.add(event.code);
      if (event.code.startsWith("Arrow")) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => input.keys.delete(event.code);
    const clear = () => input.keys.clear();

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      resetInput();
    };
  }, []);
}
